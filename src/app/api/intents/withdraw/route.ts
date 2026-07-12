import { z } from "zod";
import { intentErrorFlash, intentSubmittedFlash, loginRequiredFlash, redirectWithFlash } from "@/lib/flash";
import { getManualPortfolioOverview } from "@/lib/portfolio-store";
import { getUserSession } from "@/lib/session";
import { createWithdrawalIntent, readStore } from "@/lib/store";
import { withdrawalLimitForUser } from "@/lib/withdrawal-limit";

const schema = z.object({
  amountKrw: z.coerce.number().int().positive().max(100000000),
  bankName: z.string().min(1).max(30),
  accountNumber: z.string().min(5).max(40),
  accountHolder: z.string().min(1).max(30),
  contact: z.string().min(4).max(80),
  termsAgreed: z.literal("true"),
  note: z.string().max(500).optional()
});

export async function POST(request: Request) {
  const user = await getUserSession();
  if (!user) return redirectWithFlash(request, "/intents", loginRequiredFlash());

  const parsed = schema.safeParse(Object.fromEntries((await request.formData()).entries()));
  if (!parsed.success) {
    const error = parsed.error.issues.some((issue) => issue.path[0] === "termsAgreed")
      ? "terms_required"
      : "invalid_withdrawal";
    return redirectWithFlash(request, "/intents", intentErrorFlash(error));
  }

  const [portfolio, store] = await Promise.all([getManualPortfolioOverview(), readStore()]);
  const limit = withdrawalLimitForUser(store, portfolio, user.id);
  if (limit.principalKrw <= 0 || parsed.data.amountKrw > limit.maxAmountKrw) {
    return redirectWithFlash(request, "/intents", intentErrorFlash("withdrawal_limit"));
  }

  await createWithdrawalIntent({
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    amountKrw: parsed.data.amountKrw,
    bankName: parsed.data.bankName,
    accountNumber: parsed.data.accountNumber,
    accountHolder: parsed.data.accountHolder,
    contact: parsed.data.contact,
    note: parsed.data.note
  });

  return redirectWithFlash(request, "/intents", intentSubmittedFlash());
}
