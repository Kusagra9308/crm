import { query } from "./db";
import { stageToNumber } from "./mlUtils";

export async function getTrainingData(orgId:number){

  const result = await query(`
    SELECT id, amount, stage, created_at, close_date
    FROM deals
    WHERE organization_id = $1
  `,[orgId]);

  const deals = result.rows;

  const dataset = deals.map((deal:any)=>{

    const created = new Date(deal.created_at);
    const close = deal.close_date ? new Date(deal.close_date) : new Date();

    const daysOpen =
      (close.getTime() - created.getTime()) / (1000*60*60*24);

    return {
      amount: Number(deal.amount ?? 0),
      stage: stageToNumber(deal.stage),
      daysOpen: daysOpen,
      outcome: deal.stage === "Closed Won" ? 1 : 0
    }

  });

  return dataset;
}