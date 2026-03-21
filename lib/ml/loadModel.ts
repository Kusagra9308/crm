import * as tf from "@tensorflow/tfjs-node";
import path from "path";

let cachedModel: tf.LayersModel | null = null;

export async function loadModel() {
  try {

    if (cachedModel) {
      console.log("Using cached model");
      return cachedModel;
    }

    const modelPath =
      "file://" +
      path.join(process.cwd(), "models", "lead-model", "model.json");

    console.log("Loading model from:", modelPath);

    const model = await tf.loadLayersModel(modelPath);

    console.log("MODEL LOADED SUCCESSFULLY");

    cachedModel = model;

    return model;

  } catch (err) {
    console.error("MODEL LOAD ERROR:", err);
    return null;
  }
}