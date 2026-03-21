export function stageToNumber(stage: string) {

  const mapping: Record<string, number> = {
    "Prospecting": 1,
    "Qualified": 2,
    "Proposal": 3,
    "Negotiation": 4,
    "Closed Won": 5,
    "Closed Lost": 0
  };

  return mapping[stage] ?? 1;
}