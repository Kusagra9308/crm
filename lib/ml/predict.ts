import * as tf from "@tensorflow/tfjs";

export async function predictDeal(model:any, features:number[]) {

  const tensor = tf.tensor2d([features]);

  const prediction = model.predict(tensor) as tf.Tensor;

  const data = await prediction.data();

  return data[0];
}