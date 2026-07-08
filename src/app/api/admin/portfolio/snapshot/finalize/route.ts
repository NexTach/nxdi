import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminUser } from "@/lib/admin";
import { cronAuthorized } from "@/lib/cron-auth";
import { adminErrorFlash, adminSuccessFlash, redirectWithFlash } from "@/lib/flash";
import { finalizePortfolioDailySnapshot, refreshPortfolioMarketSnapshot } from "@/lib/portfolio-store";
import { getUserSession } from "@/lib/session";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

async function refreshAndFinalize(snapshotDate?: string) {
  await refreshPortfolioMarketSnapshot();
  return finalizePortfolioDailySnapshot(snapshotDate);
}

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = schema.safeParse({ date: url.searchParams.get("date") ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }

  const result = await refreshAndFinalize(parsed.data.date);
  return NextResponse.json(result, { status: result.status === "closed" ? 200 : 404 });
}

export async function POST(request: Request) {
  const user = await getUserSession();
  if (!isAdminUser(user)) return NextResponse.redirect(new URL("/admin", request.url), { status: 303 });

  const formData = await request.formData();
  const dateValue = formData.get("date");
  const parsed = schema.safeParse({
    date: typeof dateValue === "string" && dateValue.trim() ? dateValue.trim() : undefined
  });

  if (!parsed.success) {
    return redirectWithFlash(request, "/admin", adminErrorFlash("invalid_snapshot"));
  }

  const result = await refreshAndFinalize(parsed.data.date);
  if (result.status !== "closed") {
    return redirectWithFlash(request, "/admin", adminErrorFlash("snapshot_not_found"));
  }

  return redirectWithFlash(request, "/admin", adminSuccessFlash("portfolio", "updated"));
}
