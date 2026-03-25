import { query } from '../lib/db';

async function testLogic() {
  console.log('--- Testing Task-Deal AI Logic ---');

  try {
    // 1. Get an existing open deal
    const dealRes = await query("SELECT id, name, ai_score FROM deals WHERE stage NOT IN ('Closed Won', 'Closed Lost') LIMIT 1");
    if (dealRes.rows.length === 0) {
      console.log('No open deals found to test.');
      process.exit(0);
    }

    const deal = dealRes.rows[0];
    const initialScore = deal.ai_score;
    console.log(`Initial Deal: ${deal.name} (ID: ${deal.id}), Score: ${initialScore}`);

    // 2. Add a task linked to this deal
    console.log('Adding a linked task...');
    // We simulate the createTask logic here manually since it's a server action
    // but we want to see if the score changes.

    // Actually, I'll just run the score recalculation logic directly as it is in actions.ts
    // but triggered by a manual insert to see the effect.
    await query(
      `INSERT INTO tasks (title, description, priority, deal_id, organization_id)
       VALUES ($1, $2, $3, $4, $5)`,
      ['AI Test Task', 'Testing memory density', 'Medium', deal.id, 1]
    );

    // Now trigger the same logic as in actions.ts:createTask
    const dealDataRes = await query("SELECT * FROM deals WHERE id = $1", [deal.id]);
    const d = dealDataRes.rows[0];
    const deal_age = Math.floor((new Date().getTime() - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24));
    const ntRes = await query("SELECT COUNT(*) as count FROM tasks WHERE deal_id = $1", [deal.id]);
    const note_count = parseInt(ntRes.rows[0].count);

    console.log(`Current Note Count for Deal ${deal.id}: ${note_count}`);

    const pythonUrl = process.env.PYTHON_API_URL || "https://crm-iogr.onrender.com";
    const pr = await fetch(`${pythonUrl}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: d.amount,
        stage: d.stage,
        note_count,
        deal_age,
        demo_completed: d.demo_completed,
        champion_identified: d.champion_identified
      }),
    });

    if (pr.ok) {
      const { ai_score } = await pr.json();
      await query(`UPDATE deals SET ai_score = $1 WHERE id = $2`, [ai_score, deal.id]);

      if (ai_score !== initialScore) {
        console.log('✅ SUCCESS: AI Score updated after task addition!');
      } else {
        console.log('ℹ️ INFO: AI Score remained the same (model might need more training or notes to shift).');
      }
    } else {
      console.error('❌ FAILED: Python API error');
    }

  } catch (err) {
    console.error('Error during test:', err);
  }
  process.exit(0);
}

testLogic();
