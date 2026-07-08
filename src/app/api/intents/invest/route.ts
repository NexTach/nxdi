import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserSession } from "@/lib/session";
import { createInvestmentIntent } from "@/lib/store";

const schema = z.object({
  amountKrw: z.coerce.number().int().min(10000).max(100000000),
  depositorName: z.string().min(1).max(30),
  contact: z.string().min(4).max(80),
  guardianConfirmed: z.coerce.boolean().default(false),
  termsAgreed: z.literal("true"),
  note: z.string().max(500).optional()
});

export async function POST(request: Request) {
  const user = await getUserSession();
  if (!user) return NextResponse.redirect(new URL("/?loginRequired=1", request.url), { status: 303 });

  const parsed = schema.safeParse(Object.fromEntries((await request.formData()).entries()));
  if (!parsed.success) {
    const error = parsed.error.issues.some((issue) => issue.path[0] === "termsAgreed")
      ? "terms_required"
      : "invalid_investment";
    return NextResponse.redirect(new URL(`/intents?error=${error}`, request.url), { status: 303 });
  }

  await createInvestmentIntent({
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    amountKrw: parsed.data.amountKrw,
    depositorName: parsed.data.depositorName,
    contact: parsed.data.contact,
    guardianConfirmed: parsed.data.guardianConfirmed,
    note: parsed.data.note
  });

  return NextResponse.redirect(new URL("/intents?submitted=investment", request.url), { status: 303 });
}
