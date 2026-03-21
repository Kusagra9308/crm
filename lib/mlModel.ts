import * as tf from "@tensorflow/tfjs";

export async function trainModel(data:any[]){

  const xs = tf.tensor2d(
    data.map(d => [
      d.amount,
      d.stage,
      d.daysOpen
    ])
  );

  const ys = tf.tensor2d(
    data.map(d => [d.outcome])
  );

  const model = tf.sequential();

  model.add(
    tf.layers.dense({
      inputShape:[3],
      units:1,
      activation:"sigmoid"
    })
  );

  model.compile({
    optimizer:"adam",
    loss:"binaryCrossentropy"
  });

  await model.fit(xs,ys,{epochs:80});

  return model;
}

export async function predictDeal(model:any, deal:any){

  const input = tf.tensor2d([[
    deal.amount,
    deal.stage,
    deal.daysOpen
  ]]);

  const prediction = model.predict(input);

  const score = await prediction.data();

  return score[0];
}