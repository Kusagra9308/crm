const AMOUNT_SCALE = 20000;
const DAYS_OPEN_SCALE = 180;
const TIME_IN_STAGE_SCALE = 90;
const AVG_DAYS_TO_CLOSE_SCALE = 180;

export const MODEL_VERSION = 6;

export function normalizeAmount(amount: number) {
  return Math.min(1, Math.max(0, amount) / AMOUNT_SCALE);
}

export function normalizeStage(stageValue: number) {
  return Math.min(1, Math.max(0, stageValue));
}

export function normalizeDaysOpen(daysOpen: number) {
  return Math.min(1, Math.max(0, daysOpen) / DAYS_OPEN_SCALE);
}

export function normalizeTimeInStage(daysOpen: number) {
  return Math.min(1, Math.max(0, daysOpen) / TIME_IN_STAGE_SCALE);
}

export function normalizeConversionRate(conversionRate: number) {
  return Math.min(1, Math.max(0, conversionRate));
}

export function normalizeAverageDaysToClose(daysOpen: number) {
  return Math.min(1, Math.max(0, daysOpen) / AVG_DAYS_TO_CLOSE_SCALE);
}

export function normalizeFeatures(
  amount: number,
  stageValue: number,
  daysOpen: number,
  timeInStage: number,
  conversionRate: number,
  averageDaysToClose: number,
) {
  return [
    normalizeAmount(amount),
    normalizeStage(stageValue),
    normalizeDaysOpen(daysOpen),
    normalizeTimeInStage(timeInStage),
    normalizeConversionRate(conversionRate),
    normalizeAverageDaysToClose(averageDaysToClose),
  ];
}
