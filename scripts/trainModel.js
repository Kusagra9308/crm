const tf = require("@tensorflow/tfjs");
const { Pool } = require("pg");
const fs = require("fs");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function trainModel() {
  console.log("Loading training data...");

  const result = await pool.query(`
    SELECT amount, stage, created_at,
    CASE WHEN stage = 'Closed Won' THEN 1 ELSE 0 END as outcome
    FROM deals
  `);

  const deals = result.rows;

  if (deals.length === 0) {
    console.log("No deals found.");
    return;
  }

  const stageMap = {
    "Appointment Scheduled": 1,
    "Qualified to Buy": 2,
    "Presentation Scheduled": 3,
    "Decision Maker Bought-In": 4,
    "Contract Sent": 5,
    "Closed Won": 6,
    "Closed Lost": 0,
  };

  const xs = [];
  const ys = [];

  for (const deal of deals) {
    const created = new Date(deal.created_at);
    const now = new Date();

    const daysOpen =
      (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);

    xs.push([Number(deal.amount), stageMap[deal.stage] || 1, daysOpen]);
    ys.push([deal.outcome]);
  }

  const xsTensor = tf.tensor2d(xs);
  const ysTensor = tf.tensor2d(ys);

  const model = tf.sequential();

  model.add(
    tf.layers.dense({
      inputShape: [3],
      units: 1,
      activation: "sigmoid",
    })
  );

  model.compile({
    optimizer: "adam",
    loss: "binaryCrossentropy",
  });

  console.log("Training model...");

  await model.fit(xsTensor, ysTensor, { epochs: 100 });

  // Save model manually
  const savePath = "models/lead-model";

  if (!fs.existsSync("models")) {
    fs.mkdirSync("models");
  }

  await model.save(
    tf.io.withSaveHandler(async (artifacts) => {
      fs.writeFileSync(
        `${savePath}-model.json`,
        JSON.stringify(artifacts.modelTopology)
      );

      fs.writeFileSync(
        `${savePath}-weights.bin`,
        Buffer.from(artifacts.weightData)
      );

      return {
        modelArtifactsInfo: {
          dateSaved: new Date(),
          modelTopologyType: "JSON",
        },
      };
    })
  );

  console.log("Model trained and saved correctly!");
}

trainModel();