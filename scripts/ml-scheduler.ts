import cron from "node-cron";
import { exec } from "child_process";
import path from "path";

const PYTHON_API_PATH = path.join(process.cwd(), "ml_pipeline.py");
const SERVER_PATH = path.join(process.cwd(), "server", "predict_api.py");

console.log("--- 🧠 AI Training Scheduler Initialized ---");
console.log("Schedule: Midnight on the 1st of every month (Monthly)");

// 🚀 Start the Real-time Predict API alongside the scheduler
console.log("Starting Prediction API Server...");
const apiProcess = exec(`py -3.11 "${SERVER_PATH}"`, (err, stdout, stderr) => {
    if (err) console.error(`[API ERROR] ${err}`);
});

apiProcess.stdout?.on('data', (data) => console.log(`[API] ${data}`));
apiProcess.stderr?.on('data', (data) => console.error(`[API LOG] ${data}`));

// Monthly: '0 0 1 * *'
// For testing, one could use '* * * * *' (every minute)
cron.schedule('0 0 1 * *', () => {
    console.log(`[${new Date().toLocaleString()}] 🚀 Triggering Monthly AI Model Retraining...`);
    
    exec(`py -3.11 "${PYTHON_API_PATH}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`[CRON ERROR] Retraining failed: ${error.message}`);
            return;
        }
        if (stderr) {
            console.log(`[CRON LOG] Pipeline output: ${stderr}`);
        }
        console.log(`[CRON SUCCESS] AI Model retrained successfully at ${new Date().toLocaleString()}`);
        console.log(stdout);
    });
});
