import { query } from "../db";

export type StageMetric = {
  conversionRate: number;
  averageDaysToClose: number;
};

export type StageMetrics = Record<string, StageMetric>;

export async function getStageMetrics() {
  const result = await query(`
    WITH closed_deal_stage AS (
      SELECT
        d.id,
        d.stage AS outcome_stage,
        d.created_at,
        previous_stage.stage AS feature_stage,
        closed_stage.entered_at AS closed_at
      FROM deals d
      LEFT JOIN LATERAL (
        SELECT stage, entered_at
        FROM deal_stage_history
        WHERE deal_id = d.id
          AND stage NOT IN ('Closed Won', 'Closed Lost')
        ORDER BY entered_at DESC
        LIMIT 1
      ) previous_stage ON true
      LEFT JOIN LATERAL (
        SELECT entered_at
        FROM deal_stage_history
        WHERE deal_id = d.id
          AND stage IN ('Closed Won', 'Closed Lost')
        ORDER BY entered_at DESC
        LIMIT 1
      ) closed_stage ON true
      WHERE d.stage IN ('Closed Won', 'Closed Lost')
    )
    SELECT
      feature_stage AS stage,
      COUNT(*) AS closed_count,
      COUNT(*) FILTER (
        WHERE outcome_stage = 'Closed Won'
      ) AS won_count,
      AVG(
        EXTRACT(
          EPOCH FROM (
            COALESCE(closed_at, NOW()) - created_at
          )
        ) / 86400.0
      ) AS average_days_to_close
    FROM closed_deal_stage
    WHERE feature_stage IS NOT NULL
    GROUP BY feature_stage
  `);

  const metrics: StageMetrics = {};

  for (const row of result.rows) {
    const closedCount = Number(row.closed_count ?? 0);
    const wonCount = Number(row.won_count ?? 0);

    metrics[row.stage] = {
      conversionRate: closedCount > 0 ? wonCount / closedCount : 0.5,
      averageDaysToClose: Number(row.average_days_to_close ?? 90),
    };
  }

  return metrics;
}

export async function getCurrentStageDurations(dealIds: number[]) {
  if (!dealIds.length) {
    return {} as Record<number, number>;
  }

  const result = await query(
    `
    SELECT DISTINCT ON (d.id)
      d.id AS deal_id,
      EXTRACT(
        EPOCH FROM (
          NOW() - COALESCE(h.entered_at, d.created_at)
        )
      ) / 86400.0 AS time_in_stage
    FROM deals d
    LEFT JOIN deal_stage_history h
      ON h.deal_id = d.id
      AND h.stage = d.stage
    WHERE d.id = ANY($1::int[])
    ORDER BY d.id, h.entered_at DESC NULLS LAST
    `,
    [dealIds],
  );

  const durations: Record<number, number> = {};

  for (const row of result.rows) {
    durations[Number(row.deal_id)] = Number(row.time_in_stage ?? 0);
  }

  return durations;
}
