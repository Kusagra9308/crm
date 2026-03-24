const stages = [
    "Appointment Scheduled",
    "Qualified to Buy",
    "Presentation Scheduled",
    "Decision Maker Bought-In",
    "Contract Sent"
];

async function verifyStageWeight() {
    console.log('--- AI Stage Weight Audit ---');
    console.log('Testing how Stage progression affects AI Score...\n');

    const pythonUrl = "http://127.0.0.1:8000";
    const basePayload = {
        amount: 10000,
        note_count: 2,
        deal_age: 10,
        demo_completed: false,
        champion_identified: false
    };

    let previousScore = -1;
    let success = true;

    for (const stage of stages) {
        try {
            const res = await fetch(`${pythonUrl}/predict`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...basePayload, stage }),
            });

            if (!res.ok) throw new Error(`API Error: ${res.statusText}`);

            const { ai_score } = await res.json();
            const status = previousScore === -1 ? '-' : ai_score > previousScore ? '✅ Increase' : '❌ Stagnant/Decrease';
            
            console.log(`Stage: ${stage.padEnd(25)} | AI Scored: ${ai_score.toString().padStart(6)} | ${status}`);
            
            if (previousScore !== -1 && ai_score <= previousScore) {
                success = false;
            }
            previousScore = ai_score;
        } catch (err) {
            console.error(`Error testing stage "${stage}":`, err);
            success = false;
        }
    }

    console.log('\n--- Audit Result ---');
    if (success) {
        console.log('✅ PASS: Stage progression dynamically increases win probability.');
    } else {
        console.log('⚠️  FAIL/WARN: Some stages did not show a clear increase. Model might need retraining.');
    }
    process.exit(0);
}

verifyStageWeight();
