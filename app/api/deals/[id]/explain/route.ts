import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log("[explain] Fetching for deal:", id);

    // 1. Fetch deal details from DB
    const res_db = await query(`
      SELECT 
        amount, stage, created_at, close_date, demo_completed, champion_identified,
        (SELECT COUNT(*) FROM tasks t WHERE t.deal_id = d.id) AS note_count
      FROM deals d
      WHERE d.id = $1
    `, [parseInt(id)]);

    if (!res_db || res_db.rowCount === 0) {
      console.warn("[explain] Deal not found in DB:", id);
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const deal = res_db.rows[0];

    // 2. Prepare features for Python
    const now = new Date();
    const created = new Date(deal.created_at);
    const close = new Date(deal.close_date);
    
    const deal_age = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    const days_to_close = deal.close_date 
      ? Math.floor((new Date(deal.close_date).getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
      : 30; // Total Duration (Created -> Close)

    const payload = {
      amount: parseFloat(deal.amount),
      stage: deal.stage,
      note_count: parseInt(deal.note_count),
      deal_age: deal_age,
      demo_completed: !!deal.demo_completed,
      champion_identified: !!deal.champion_identified,
      days_to_close: days_to_close
    };

    const res_py = await fetch(`${PYTHON_API_URL}/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res_py.ok) {
      const err = await res_py.text();
      console.error(`[explain] Python API Error (${res_py.status}):`, err);
      return NextResponse.json({ 
        error: "Python AI Engine Error", 
        detail: err,
        status: res_py.status,
        url: PYTHON_API_URL
      }, { status: 502 }); // Bad Gateway
    }

    const data = await res_py.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("[explain] Critical Error:", error.message);
    return NextResponse.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
  }
}
