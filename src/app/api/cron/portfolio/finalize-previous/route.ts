import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { finalizePreviousPortfolioDailySnapshot } from "@/lib/portfolio-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await finalizePreviousPortfolioDailySnapshot();
  return NextResponse.json(result);
}
