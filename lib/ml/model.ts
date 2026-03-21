import * as tf from "@tensorflow/tfjs";
import { promises as fs } from "fs";
import path from "path";
import { MODEL_VERSION } from "./preprocessing";

const MODEL_DIR = path.join(process.cwd(), "models", "lead-model");
const ARTIFACTS_PATH = path.join(MODEL_DIR, "artifacts.json");
const WEIGHTS_PATH = path.join(MODEL_DIR, "weights.bin");
const LEGACY_TOPOLOGY_PATH = path.join(process.cwd(), "models", "lead-model-model.json");
const LEGACY_WEIGHTS_PATH = path.join(process.cwd(), "models", "lead-model-weights.bin");

let cachedModel: tf.LayersModel | null = null;

type StoredArtifacts = {
  modelTopology: tf.io.ModelJSON["modelTopology"];
  weightSpecs?: tf.io.WeightsManifestEntry["weights"];
  modelVersion?: number;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isKnownTensorFlowDevWarning(error: unknown) {
  return getErrorMessage(error).includes("Invalid source map");
}

function inferDenseWeightSpecs(
  modelTopology: tf.io.ModelJSON["modelTopology"],
): tf.io.WeightsManifestEntry["weights"] {
  const layers = (modelTopology as { config?: { layers?: Array<{ class_name?: string; config?: Record<string, unknown> }> } }).config?.layers ?? [];
  const specs: tf.io.WeightsManifestEntry["weights"] = [];
  let previousUnits: number | null = null;

  for (const layer of layers) {
    if (layer.class_name !== "Dense") {
      continue;
    }

    const config = layer.config ?? {};
    const layerName = String(config.name ?? "dense");
    const units = Number(config.units ?? 0);
    const batchInputShape = Array.isArray(config.batch_input_shape)
      ? config.batch_input_shape
      : null;
    const inputUnits = Number(
      batchInputShape?.[batchInputShape.length - 1] ?? previousUnits ?? 0,
    );

    if (!inputUnits || !units) {
      throw new Error("Unable to infer legacy model weight specs");
    }

    specs.push(
      {
        name: `${layerName}/kernel`,
        shape: [inputUnits, units],
        dtype: "float32",
      },
      {
        name: `${layerName}/bias`,
        shape: [units],
        dtype: "float32",
      },
    );

    previousUnits = units;
  }

  if (!specs.length) {
    throw new Error("Legacy model did not contain any supported Dense layers");
  }

  return specs;
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function loadModel() {
  if (cachedModel) {
    return cachedModel;
  }

  try {
    let artifacts: StoredArtifacts | null = null;
    let weightData: Buffer | null = null;

    if (await fileExists(ARTIFACTS_PATH) && await fileExists(WEIGHTS_PATH)) {
      const [artifactsRaw, storedWeightData] = await Promise.all([
        fs.readFile(ARTIFACTS_PATH, "utf8"),
        fs.readFile(WEIGHTS_PATH),
      ]);

      artifacts = JSON.parse(artifactsRaw) as StoredArtifacts;
      weightData = storedWeightData;
    } else if (
      await fileExists(LEGACY_TOPOLOGY_PATH) &&
      await fileExists(LEGACY_WEIGHTS_PATH)
    ) {
      const [topologyRaw, storedWeightData] = await Promise.all([
        fs.readFile(LEGACY_TOPOLOGY_PATH, "utf8"),
        fs.readFile(LEGACY_WEIGHTS_PATH),
      ]);

      const modelTopology = JSON.parse(topologyRaw) as tf.io.ModelJSON["modelTopology"];

      artifacts = {
        modelTopology,
        weightSpecs: inferDenseWeightSpecs(modelTopology),
        modelVersion: 1,
      };
      weightData = storedWeightData;
    } else {
      return null;
    }

    if (artifacts.modelVersion !== MODEL_VERSION) {
      return null;
    }

    if (!artifacts.weightSpecs?.length) {
      console.warn("ML model artifacts are missing weight specs");
      return null;
    }

    const model = await tf.loadLayersModel({
      load: async () => ({
        modelTopology: artifacts.modelTopology,
        weightSpecs: artifacts.weightSpecs!,
        weightData: weightData!.buffer.slice(
          weightData!.byteOffset,
          weightData!.byteOffset + weightData!.byteLength,
        ),
      }),
    });

    cachedModel = model;
    return model;
  } catch (error) {
    if (isKnownTensorFlowDevWarning(error)) {
      console.warn("ML model load skipped due to a TensorFlow source-map warning in Next.js dev mode");
      return null;
    }

    console.warn("ML model load failed:", getErrorMessage(error));
    return null;
  }
}

export async function saveModel(model: tf.LayersModel) {
  await fs.mkdir(MODEL_DIR, { recursive: true });

  await model.save(
    tf.io.withSaveHandler(async (artifacts) => {
      await Promise.all([
        fs.writeFile(
          ARTIFACTS_PATH,
          JSON.stringify({
            modelTopology: artifacts.modelTopology,
            weightSpecs: artifacts.weightSpecs,
            modelVersion: MODEL_VERSION,
          }),
        ),
        fs.writeFile(WEIGHTS_PATH, Buffer.from(artifacts.weightData)),
      ]);

      return {
        modelArtifactsInfo: {
          dateSaved: new Date(),
          modelTopologyType: "JSON",
        },
      };
    }),
  );

  cachedModel = model;
}

export async function predictScore(model: tf.LayersModel, features: number[]) {
  const tensor = tf.tensor2d([features]);
  const prediction = model.predict(tensor) as tf.Tensor;
  const data = await prediction.data();

  tensor.dispose();
  prediction.dispose();

  return data[0];
}
