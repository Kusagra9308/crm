import { getTrainingData } from "@/lib/mlDataset";
import { trainModel } from "@/lib/mlModel";
import { saveModel } from "@/lib/ml/model";

export async function POST(){

  const dataset = await getTrainingData(1);

  const model = await trainModel(dataset);

  if (!model) {
    return Response.json(
      { message: "not enough training data to build model" },
      { status: 400 },
    );
  }

  await saveModel(model);

  return Response.json({message:"model trained"});
}
