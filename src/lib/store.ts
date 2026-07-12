import type { AppStore, InvestmentIntent, IntentStatus, WithdrawalIntent } from "./types";
import { prisma } from "./prisma";

type InvestmentRow = Awaited<ReturnType<typeof prisma.investmentIntent.findMany>>[number];
type WithdrawalRow = Awaited<ReturnType<typeof prisma.withdrawalIntent.findMany>>[number];

function toInvestmentIntent(row: InvestmentRow) {
  return {
    ...row,
    note: row.note ?? undefined,
    type: "INVESTMENT" as const,
    status: row.status as IntentStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  } satisfies InvestmentIntent;
}

function toWithdrawalIntent(row: WithdrawalRow) {
  return {
    ...row,
    note: row.note ?? undefined,
    type: "WITHDRAWAL" as const,
    status: row.status as IntentStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  } satisfies WithdrawalIntent;
}

export async function readStore(): Promise<AppStore> {
  const [investmentRows, withdrawalRows] = await Promise.all([
    prisma.investmentIntent.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.withdrawalIntent.findMany({ orderBy: { createdAt: "desc" } })
  ]);

  return {
    investmentIntents: investmentRows.map((row) => toInvestmentIntent(row)),
    withdrawalIntents: withdrawalRows.map((row) => toWithdrawalIntent(row))
  };
}

export async function readAcceptedNetInvestmentPrincipal() {
  const [investments, withdrawals] = await Promise.all([
    prisma.investmentIntent.aggregate({
      where: { status: "ACCEPTED" },
      _sum: { amountKrw: true }
    }),
    prisma.withdrawalIntent.aggregate({
      where: { status: "ACCEPTED" },
      _sum: { amountKrw: true }
    })
  ]);

  return Math.max(
    (investments._sum.amountKrw ?? 0) - (withdrawals._sum.amountKrw ?? 0),
    0
  );
}

export async function createInvestmentIntent(
  input: Omit<InvestmentIntent, "id" | "type" | "status" | "createdAt" | "updatedAt">
) {
  const row = await prisma.investmentIntent.create({
    data: {
      ...input,
      status: "PENDING"
    }
  });
  return toInvestmentIntent(row);
}

export async function createWithdrawalIntent(
  input: Omit<WithdrawalIntent, "id" | "type" | "status" | "createdAt" | "updatedAt">
) {
  const row = await prisma.withdrawalIntent.create({
    data: {
      ...input,
      status: "PENDING"
    }
  });
  return toWithdrawalIntent(row);
}

export async function updateIntentStatus(params: {
  type: "INVESTMENT" | "WITHDRAWAL";
  id: string;
  status: IntentStatus;
}) {
  if (params.type === "INVESTMENT") {
    const existing = await prisma.investmentIntent.findUnique({ where: { id: params.id } });
    if (existing?.status === params.status) return toInvestmentIntent(existing);
    const row = await prisma.investmentIntent.update({
      where: { id: params.id },
      data: { status: params.status }
    });
    return toInvestmentIntent(row);
  }

  const existing = await prisma.withdrawalIntent.findUnique({ where: { id: params.id } });
  if (existing?.status === params.status) return toWithdrawalIntent(existing);
  const row = await prisma.withdrawalIntent.update({
    where: { id: params.id },
    data: { status: params.status }
  });
  return toWithdrawalIntent(row);
}
