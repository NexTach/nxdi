import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminUser } from "@/lib/admin";
import { adminErrorFlash, adminSuccessFlash, redirectWithFlash } from "@/lib/flash";
import { applyManualHoldingTrade } from "@/lib/portfolio-store";
import { getUserSession } from "@/lib/session";

const schema = z.object({
  tradeSymbol: z.string().trim().min(1).max(20),
  side: z.enum(["BUY", "SELL"]),
  tradeQuantity: z.coerce.number().positive(),
  orderPrice: z.coerce.number().positive(),
  exchangeRate: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().min(500).max(3000).optional()
  )
});

export async function POST(request: Request) {
  const user = await getUserSession();
  if (!isAdminUser(user)) return NextResponse.redirect(new URL("/admin", request.url), { status: 303 });

  const parsed = schema.safeParse(Object.fromEntries((await request.formData()).entries()));
  if (!parsed.success) {
    return redirectWithFlash(request, "/admin", adminErrorFlash("invalid_trade"));
  }

  const result = await applyManualHoldingTrade({
    symbol: parsed.data.tradeSymbol,
    side: parsed.data.side,
    quantity: parsed.data.tradeQuantity,
    orderPrice: parsed.data.orderPrice,
    exchangeRate: parsed.data.exchangeRate
  });

  if (result.status === "not_found") {
    return redirectWithFlash(request, "/admin", adminErrorFlash("trade_not_found"));
  }

  if (result.status === "insufficient_quantity") {
    return redirectWithFlash(request, "/admin", adminErrorFlash("trade_insufficient"));
  }

  if (result.status === "missing_exchange_rate") {
    return redirectWithFlash(request, "/admin", adminErrorFlash("invalid_exchange_rate"));
  }

  if (result.status === "missing_cost_basis") {
    return redirectWithFlash(request, "/admin", adminErrorFlash("invalid_trade"));
  }

  return redirectWithFlash(request, "/admin", adminSuccessFlash("portfolio", "traded"));
}
