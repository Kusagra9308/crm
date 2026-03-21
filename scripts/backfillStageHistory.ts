import "dotenv/config";
import pool, { query } from "../lib/db";

async function backfillStageHistory() {
  try {
    console.log("Backfilling deal_stage_history...");

    const dealsResult = await query(`
      SELECT
        d.id,
        d.stage,
        d.created_at,
        EXISTS (
          SELECT 1
          FROM deal_stage_history h
          WHERE h.deal_id = d.id
        ) AS has_history
      FROM deals d
      ORDER BY d.created_at ASC
    `);

    let insertedCount = 0;

    for (const deal of dealsResult.rows) {
      if (deal.has_history) {
        continue;
      }

      await query(
        `
        INSERT INTO deal_stage_history (deal_id, stage, entered_at)
        VALUES ($1, $2, $3)
        `,
        [deal.id, deal.stage, deal.created_at],
      );

      insertedCount += 1;
    }

    console.log(`Backfill complete. Inserted ${insertedCount} history rows.`);
  } catch (error) {
    console.error("Stage history backfill failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

backfillStageHistory();
