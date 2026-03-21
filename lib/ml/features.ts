import { buildFeatureVector } from "./featureVector";
import type { StageMetrics } from "./historyFeatures";

export function buildFeatures(
  deal:any,
  stageMetrics: StageMetrics,
  timeInStageDays: number,
){
  return buildFeatureVector(deal, stageMetrics, timeInStageDays);
}
