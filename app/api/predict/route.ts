import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const res = await fetch(`${PYTHON_API_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: "Python API error", detail: err },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    // Python API is down — return null gracefully so deal still saves
    console.warn("[predict] Python API unreachable:", error.message);
    return NextResponse.json({ ai_score: null }, { status: 200 });
  }
}
