import * as tf from "@tensorflow/tfjs";
import { query } from "../db";
import { buildFeatureVector } from "./featureVector";
import { getStageMetrics } from "./historyFeatures";

export async function trainModel() {
  const layerNameSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const stageMetrics = await getStageMetrics();

  const result = await query(`
    SELECT
      d.id,
      d.amount,
      d.stage,
      d.created_at,
      COALESCE(previous_stage.stage, d.stage) AS feature_stage,
      EXTRACT(
        EPOCH FROM (
          COALESCE(closed_stage.entered_at, NOW()) - d.created_at
        )
      ) / 86400.0 AS days_open,
      EXTRACT(
        EPOCH FROM (
          COALESCE(closed_stage.entered_at, NOW()) - COALESCE(previous_stage.entered_at, d.created_at)
        )
      ) / 86400.0 AS time_in_stage
    FROM deals d
    LEFT JOIN LATERAL (
      SELECT stage, entered_at
      FROM deal_stage_history
      WHERE deal_id = d.id
        AND stage NOT IN ('Closed Won', 'Closed Lost')
      ORDER BY entered_at DESC
      LIMIT 1
    ) previous_stage ON true
    LEFT JOIN LATERAL (
      SELECT entered_at
      FROM deal_stage_history
      WHERE deal_id = d.id
        AND stage IN ('Closed Won', 'Closed Lost')
      ORDER BY entered_at DESC
      LIMIT 1
    ) closed_stage ON true
    WHERE d.stage IN ('Closed Won', 'Closed Lost')
  `);

  const deals = result.rows;

  const xs:number[][] = [];
  const ys:number[][] = [];

  for (const deal of deals) {
    xs.push(
      buildFeatureVector(
        {
          ...deal,
          stage: deal.feature_stage,
        },
        stageMetrics,
        Number(deal.time_in_stage ?? 0),
        deal.feature_stage,
        Number(deal.days_open ?? 0),
      ),
    );

    const label = deal.stage === "Closed Won" ? 1 : 0;
    ys.push([label]);
  }

  if (xs.length < 2) {
    console.log("Not enough closed deals to train model");
    return null;
  }

  const inputTensor = tf.tensor2d(xs);
  const labelTensor = tf.tensor2d(ys);

  const model = tf.sequential();

  model.add(
    tf.layers.dense({
      inputShape: [6],
      name: `deal_hidden_1_${layerNameSuffix}`,
      units: 16,
      activation: "relu"
    })
  );

  model.add(
    tf.layers.dense({
      name: `deal_hidden_2_${layerNameSuffix}`,
      units: 8,
      activation: "relu"
    })
  );

  model.add(
    tf.layers.dense({
      name: `deal_output_${layerNameSuffix}`,
      units: 1,
      activation: "sigmoid"
    })
  );

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: "binaryCrossentropy"
  });

  await model.fit(inputTensor, labelTensor, {
    epochs: 200
  });

  inputTensor.dispose();
  labelTensor.dispose();

  return model;
}
