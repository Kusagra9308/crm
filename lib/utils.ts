import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}


export function predictNextRevenue(data: { value: any }[]) {
  const n = data.length;
  if (n < 2) return null;

  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0;

  for (let i = 0; i < n; i++) {
    const x = i + 1;
    const y = Number(data[i].value) || 0; // Force numeric type

    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const denominator = (n * sumXX - sumX * sumX);
  if (denominator === 0) return null; // Avoid division by zero

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const nextX = n + 1;
  const predicted = slope * nextX + intercept;

  return Math.round(predicted);
}

export function getInsight(data: { value: number }[] | any) {
  if (!data || data.length === 0) return null;
  const predicted = predictNextRevenue(data);
  if (!predicted) return null;

  const last = data[data.length - 1]?.value || 0;

  // Avoid division by zero
  const change = last !== 0 ? ((predicted - last) / last) * 100 : 0;

  return {
    predicted,
    change: Math.round(change),
  };
}