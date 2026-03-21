export function encodeStage(stage: string) {

  const mapping: Record<string, number> = {
    "Appointment Scheduled": 0.2,
    "Qualified to Buy": 0.4,
    "Presentation Scheduled": 0.6,
    "Decision Maker Bought-In": 0.8,
    "Contract Sent": 0.9,
    "Closed Won": 1,
    "Closed Lost": 0
  };

  return mapping[stage] ?? 0.1;
}
