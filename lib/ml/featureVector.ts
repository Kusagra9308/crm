import { normalizeFeatures } from "./preprocessing";
import { encodeStage } from "./stageEncoder";
import type { StageMetrics } from "./historyFeatures";

export function buildFeatureVector(
  deal: any,
  stageMetrics: StageMetrics,
  timeInStageDays: number,
  stageOverride?: string,
  daysOpenOverride?: number,
) {
  const created = new Date(deal.created_at);
  const now = new Date();
  const stage = stageOverride ?? deal.stage;
  const daysOpen =
    daysOpenOverride ??
    (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
  const metrics = stageMetrics[stage] ?? {
    conversionRate: 0.5,
    averageDaysToClose: 90,
  };

  return normalizeFeatures(
    Number(deal.amount ?? 0),
    encodeStage(stage),
    daysOpen,
    timeInStageDays,
    metrics.conversionRate,
    metrics.averageDaysToClose,
  );
}
