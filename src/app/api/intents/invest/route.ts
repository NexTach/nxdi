import { z } from "zod";
import { intentErrorFlash, intentSubmittedFlash, loginRequiredFlash, redirectWithFlash } from "@/lib/flash";
import { PRODUCT_MAX_INVESTMENT_KRW, PRODUCT_MIN_INVESTMENT_KRW } from "@/lib/product-policy";
import { getUserSession } from "@/lib/session";
import { createInvestmentIntent } from "@/lib/store";

const schema = z.object({
  amountKrw: z.coerce.number().int().min(PRODUCT_MIN_INVESTMENT_KRW).max(PRODUCT_MAX_INVESTMENT_KRW),
  depositorName: z.string().min(1).max(30),
  contact: z.string().min(4).max(80),
  guardianConfirmed: z.coerce.boolean().default(false),
  termsAgreed: z.literal("true"),
  dividendPolicyAgreed: z.literal("true"),
  note: z.string().max(500).optional()
});

export async function POST(request: Request) {
  const user = await getUserSession();
  if (!user) return redirectWithFlash(request, "/intents", loginRequiredFlash());

  const parsed = schema.safeParse(Object.fromEntries((await request.formData()).entries()));
  if (!parsed.success) {
    const error = parsed.error.issues.some((issue) => issue.path[0] === "termsAgreed")
      ? "terms_required"
      : parsed.error.issues.some((issue) => issue.path[0] === "dividendPolicyAgreed")
        ? "dividend_policy_required"
        : "invalid_investment";
    return redirectWithFlash(request, "/intents", intentErrorFlash(error));
  }

  await createInvestmentIntent({
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    amountKrw: parsed.data.amountKrw,
    depositorName: parsed.data.depositorName,
    contact: parsed.data.contact,
    guardianConfirmed: parsed.data.guardianConfirmed,
    dividendPolicyAgreed: true,
    note: parsed.data.note
  });

  return redirectWithFlash(request, "/intents", intentSubmittedFlash());
}
