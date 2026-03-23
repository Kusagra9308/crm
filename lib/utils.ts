import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}


export function predictNextRevenue(data: { value: number }[]) {
  const n = data.length;
  if (n < 2) return null;

  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0;

  for (let i = 0; i < n; i++) {
    const x = i + 1;
    const y = data[i].value;

    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const slope =
    (n * sumXY - sumX * sumY) /
    (n * sumXX - sumX * sumX);

  const intercept = (sumY - slope * sumX) / n;

  const nextX = n + 1;
  const predicted = slope * nextX + intercept;

  return Math.round(predicted);
}

export function getInsight(data) {
  const predicted = predictNextRevenue(data);
  if (!predicted) return null;

  const last = data[data.length - 1].value;

  const change = ((predicted - last) / last) * 100;

  return {
    predicted,
    change: Math.round(change),
  };
}