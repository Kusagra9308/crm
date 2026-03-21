import type { StageMetrics } from "./historyFeatures";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function calibrateDealScore(
  rawScore: number,
  stage: string,
  stageMetrics: StageMetrics,
  timeInStageDays: number,
) {
  const metrics = stageMetrics[stage];

  if (!metrics) {
    return clamp(rawScore, 0.05, 0.95);
  }

  const stagePrior = metrics.conversionRate;
  const averageDaysToClose = Math.max(1, metrics.averageDaysToClose);
  const paceRatio = timeInStageDays / averageDaysToClose;

  let calibratedScore = rawScore * 0.55 + stagePrior * 0.45;

  if (paceRatio > 1) {
    const timingPenalty = Math.min(0.12, (paceRatio - 1) * 0.08);
    calibratedScore -= timingPenalty;
  } else {
    const timingBoost = Math.min(0.05, (1 - paceRatio) * 0.04);
    calibratedScore += timingBoost;
  }

  return clamp(calibratedScore, 0.05, 0.95);
}
