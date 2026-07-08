import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { refreshPortfolioMarketSnapshot } from "@/lib/portfolio-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await refreshPortfolioMarketSnapshot();
  return NextResponse.json(result);
}
