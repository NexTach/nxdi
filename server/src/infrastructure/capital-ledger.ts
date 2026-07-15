import type { Prisma } from "@prisma/client";
import { AllocatePurchaseCapitalService } from "../application/allocate-purchase-capital-service.js";
import { CalculateDividendPrincipalService } from "../application/calculate-dividend-principal-service.js";
import { CalculateMonthlyDistributionSettlementService } from "../application/calculate-monthly-distribution-settlement-service.js";
import { CalculateWithdrawalSettlementService } from "../application/calculate-withdrawal-settlement-service.js";
import type { HoldingTradeExecution } from "../application/apply-holding-trade-service.js";
import { distributionReceiptReference } from "../domain/distribution-receipt-reference.js";
import { withMysqlNamedLock } from "./mysql-named-lock.js";
import { prisma } from "./prisma.js";

function validDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid capital ledger date");
  return date;
}

function nextMonth(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Invalid month");
  const year = Number(month.slice(0, 4));
  const number = Number(month.slice(5, 7));
  return number === 12
    ? `${year + 1}-01`
    : `${year}-${String(number + 1).padStart(2, "0")}`;
}

function monthStartKst(month: string) {
  return new Date(`${month}-01T00:00:00+09:00`);
}

function monthRangeKst(month: string) {
  return { start: monthStartKst(month), end: monthStartKst(nextMonth(month)) };
}

function monthKeyKst(date: Date) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

function availableSourceAmount(source: {
  amountKrw: number;
  deployments: Array<{ amountKrw: number }>;
  returns: Array<{ amountKrw: number }>;
}) {
  return Math.max(
    source.amountKrw -
      source.deployments.reduce((sum, item) => sum + item.amountKrw, 0) -
      source.returns.reduce((sum, item) => sum + item.amountKrw, 0),
    0
  );
}

export async function confirmContractDeposit(input: {
  investmentIntentId: string;
  contractReference: string;
  contractVersion: string;
  depositReference: string;
  contractedAmountKrw: number;
  receivedAmountKrw: number;
  contractedAt: string;
  receivedAt: string;
  note?: string;
}) {
  const intent = await prisma.investmentIntent.findUnique({ where: { id: input.investmentIntentId } });
  if (!intent || intent.status !== "ACCEPTED") return { status: "intent_not_accepted" as const };
  const compliance = await prisma.investorComplianceProfile.findUnique({ where: { userId: intent.userId } });
  const complianceValid = Boolean(
    compliance &&
    compliance.realNameVerifiedAt &&
    compliance.bankAccountVerifiedAt &&
    compliance.suitabilityCompletedAt &&
    compliance.amlClearedAt &&
    compliance.sanctionsCheckedAt &&
    compliance.expiresAt > new Date()
  );
  if (!complianceValid) return { status: "compliance_required" as const };
  const contractedAmountKrw = Math.max(0, Math.floor(input.contractedAmountKrw));
  const receivedAmountKrw = Math.max(0, Math.floor(input.receivedAmountKrw));
  const contractedAt = validDate(input.contractedAt);
  const receivedAt = validDate(input.receivedAt);
  const now = Date.now();
  if (contractedAmountKrw <= 0 || receivedAmountKrw <= 0 || receivedAmountKrw > contractedAmountKrw) {
    return { status: "invalid_amount" as const };
  }
  if (
    !input.contractReference.trim() ||
    !input.contractVersion.trim() ||
    !input.depositReference.trim() ||
    receivedAt < contractedAt ||
    contractedAt.getTime() > now + 5 * 60 * 1000 ||
    receivedAt.getTime() > now + 5 * 60 * 1000
  ) return { status: "invalid_amount" as const };
  const referenceKey = `CONTRACT_DEPOSIT:${intent.id}`;
  const existing = await prisma.investorCapitalSource.findFirst({
    where: {
      OR: [
        { referenceKey },
        { contractReference: input.contractReference.trim() },
        { depositReference: input.depositReference.trim() }
      ]
    }
  });
  if (existing) return { status: "already_confirmed" as const, source: existing };
  const source = await prisma.investorCapitalSource.create({
    data: {
      referenceKey,
      sourceType: "CONTRACT_DEPOSIT",
      sourceIntentId: intent.id,
      contractReference: input.contractReference.trim(),
      contractVersion: input.contractVersion.trim(),
      depositReference: input.depositReference.trim(),
      userId: intent.userId,
      userName: intent.userName,
      userEmail: intent.userEmail,
      contractedAmountKrw,
      amountKrw: receivedAmountKrw,
      contractedAt,
      receivedAt,
      availableAt: receivedAt,
      note: input.note?.trim() || undefined
    }
  });
  return { status: "confirmed" as const, source };
}

export async function approveInvestorCompliance(input: {
  userId: string;
  userName: string;
  userEmail: string;
  riskGrade: string;
  realNameVerified: boolean;
  bankAccountVerified: boolean;
  suitabilityCompleted: boolean;
  amlCleared: boolean;
  sanctionsChecked: boolean;
  guardianVerified: boolean;
  note?: string;
}) {
  const checkedAt = new Date();
  const expiresAt = new Date(checkedAt);
  expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + 1);
  const profile = await prisma.investorComplianceProfile.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      userName: input.userName,
      userEmail: input.userEmail,
      realNameVerifiedAt: input.realNameVerified ? checkedAt : undefined,
      bankAccountVerifiedAt: input.bankAccountVerified ? checkedAt : undefined,
      suitabilityCompletedAt: input.suitabilityCompleted ? checkedAt : undefined,
      amlClearedAt: input.amlCleared ? checkedAt : undefined,
      sanctionsCheckedAt: input.sanctionsChecked ? checkedAt : undefined,
      guardianVerifiedAt: input.guardianVerified ? checkedAt : undefined,
      riskGrade: input.riskGrade,
      expiresAt,
      note: input.note?.trim() || undefined
    },
    update: {
      userName: input.userName,
      userEmail: input.userEmail,
      realNameVerifiedAt: input.realNameVerified ? checkedAt : null,
      bankAccountVerifiedAt: input.bankAccountVerified ? checkedAt : null,
      suitabilityCompletedAt: input.suitabilityCompleted ? checkedAt : null,
      amlClearedAt: input.amlCleared ? checkedAt : null,
      sanctionsCheckedAt: input.sanctionsChecked ? checkedAt : null,
      guardianVerifiedAt: input.guardianVerified ? checkedAt : null,
      riskGrade: input.riskGrade,
      expiresAt,
      note: input.note?.trim() || undefined
    }
  });
  return profile;
}

export async function portfolioCashBalance(transaction: Prisma.TransactionClient | typeof prisma = prisma) {
  const result = await transaction.portfolioCashEntry.aggregate({ _sum: { amountKrw: true } });
  return result._sum.amountKrw ?? 0;
}

export async function recordUnderlyingDistributionReceipt(input: {
  symbol: string;
  currency: "KRW" | "USD";
  grossAmountNative: number;
  exchangeRate?: number;
  foreignTaxKrw: number;
  brokerageFeeKrw: number;
  fxCostKrw: number;
  receivedAt: string;
  note?: string;
}) {
  const symbol = input.symbol.trim().toUpperCase();
  const grossAmountNative = Number(input.grossAmountNative);
  const exchangeRate = input.currency === "USD" ? Number(input.exchangeRate) : undefined;
  const foreignTaxKrw = Math.max(0, Math.floor(input.foreignTaxKrw));
  const brokerageFeeKrw = Math.max(0, Math.floor(input.brokerageFeeKrw));
  const fxCostKrw = Math.max(0, Math.floor(input.fxCostKrw));
  if (!symbol || !Number.isFinite(grossAmountNative) || grossAmountNative <= 0) {
    return { status: "invalid" as const };
  }
  if (input.currency === "USD" && (!Number.isFinite(exchangeRate) || Number(exchangeRate) <= 0)) {
    return { status: "invalid_exchange_rate" as const };
  }
  const grossAmountKrw = Math.round(
    input.currency === "USD" ? grossAmountNative * Number(exchangeRate) : grossAmountNative
  );
  const deductionsKrw = foreignTaxKrw + brokerageFeeKrw + fxCostKrw;
  if (grossAmountKrw <= 0 || deductionsKrw > grossAmountKrw) return { status: "invalid" as const };
  const netAmountKrw = grossAmountKrw - deductionsKrw;
  const receivedAt = validDate(input.receivedAt);
  const statementReference = distributionReceiptReference({
    symbol,
    currency: input.currency,
    grossAmountNative,
    exchangeRate,
    foreignTaxKrw,
    brokerageFeeKrw,
    fxCostKrw,
    receivedAt
  });
  const referenceKey = `UNDERLYING_DISTRIBUTION:${statementReference}`;
  const finalized = await prisma.monthlyDistributionSettlement.findFirst({
    where: { dividendMonth: monthKeyKst(receivedAt), status: "FINALIZED" },
    select: { dividendMonth: true }
  });
  if (finalized) return { status: "month_finalized" as const };
  try {
    const receipt = await prisma.$transaction(async (transaction) => {
      const created = await transaction.underlyingDistributionReceipt.create({
        data: {
          referenceKey,
          statementReference,
          symbol,
          currency: input.currency,
          grossAmountNative,
          exchangeRate,
          grossAmountKrw,
          foreignTaxKrw,
          brokerageFeeKrw,
          fxCostKrw,
          netAmountKrw,
          receivedAt,
          note: input.note?.trim() || undefined
        }
      });
      await transaction.portfolioCashEntry.create({
        data: {
          referenceKey,
          entryType: "UNDERLYING_DISTRIBUTION_RECEIPT",
          amountKrw: netAmountKrw,
          occurredAt: receivedAt,
          memo: `${symbol} 현금분배금 순입금 (${statementReference})`
        }
      });
      return created;
    }, { isolationLevel: "Serializable" });
    return { status: "recorded" as const, receipt };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return { status: "duplicate" as const };
    }
    throw error;
  }
}

export async function readUnderlyingDistributionMonthTotal(dividendMonth: string) {
  const { start, end } = monthRangeKst(dividendMonth);
  const receipts = await prisma.underlyingDistributionReceipt.findMany({
    where: { receivedAt: { gte: start, lt: end } },
    include: { reversal: { select: { id: true } } }
  });
  const active = receipts.filter((receipt) => !receipt.reversal);
  return {
    actualDividendKrw: active.reduce((sum, receipt) => sum + receipt.netAmountKrw, 0),
    receiptCount: active.length
  };
}

export async function reverseUnderlyingDistributionReceipt(input: { receiptId: string; reason: string }) {
  const receipt = await prisma.underlyingDistributionReceipt.findUnique({
    where: { id: input.receiptId },
    include: { reversal: true }
  });
  if (!receipt) return { status: "not_found" as const };
  if (receipt.reversal) return { status: "already_reversed" as const };
  const settlement = await prisma.monthlyDistributionSettlement.findUnique({
    where: { dividendMonth: monthKeyKst(receipt.receivedAt) }
  });
  if (settlement?.status === "FINALIZED") return { status: "month_finalized" as const };
  const reversedAt = new Date();
  await prisma.$transaction(async (transaction) => {
    const reversal = await transaction.underlyingDistributionReceiptReversal.create({
      data: { receiptId: receipt.id, reason: input.reason.trim(), reversedAt }
    });
    await transaction.portfolioCashEntry.create({
      data: {
        referenceKey: `UNDERLYING_DISTRIBUTION_REVERSAL:${reversal.id}`,
        entryType: "UNDERLYING_DISTRIBUTION_REVERSAL",
        amountKrw: -receipt.netAmountKrw,
        occurredAt: reversedAt,
        memo: `${receipt.symbol} 현금분배금 반대분개: ${input.reason.trim()}`
      }
    });
  }, { isolationLevel: "Serializable" });
  return { status: "reversed" as const };
}

export async function recordPortfolioTradeExecution(
  transaction: Prisma.TransactionClient,
  execution: HoldingTradeExecution
) {
  const executedAt = validDate(execution.executedAt);
  if (execution.side === "SELL") {
    const trade = await transaction.portfolioTradeExecution.create({
      data: {
        ...execution,
        exchangeRate: execution.exchangeRate,
        investorDeployedKrw: 0,
        nonInvestorFundedKrw: 0,
        executedAt
      }
    });
    await transaction.portfolioCashEntry.create({
      data: {
        referenceKey: `TRADE:${trade.id}:SELL_PROCEEDS`,
        entryType: "SELL_PROCEEDS",
        amountKrw: execution.cashAmountKrw,
        occurredAt: executedAt,
        memo: `${execution.symbol} 매도 결제대금`
      }
    });
    return trade;
  }

  const sources = await transaction.investorCapitalSource.findMany({
    where: { availableAt: { lte: executedAt } },
    include: {
      deployments: { select: { amountKrw: true } },
      returns: { select: { amountKrw: true } }
    },
    orderBy: [{ availableAt: "asc" }, { id: "asc" }]
  });
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const allocation = new AllocatePurchaseCapitalService().execute({
    purchaseCostKrw: execution.cashAmountKrw,
    sources: sources.map((source) => ({
      id: source.id,
      userId: source.userId,
      availableKrw: availableSourceAmount(source),
      availableAt: source.availableAt.toISOString()
    }))
  });
  const trade = await transaction.portfolioTradeExecution.create({
    data: {
      ...execution,
      exchangeRate: execution.exchangeRate,
      investorDeployedKrw: allocation.investorDeployedKrw,
      nonInvestorFundedKrw: allocation.nonInvestorFundedKrw,
      executedAt
    }
  });
  if (allocation.allocations.length > 0) {
    await transaction.capitalDeployment.createMany({
      data: allocation.allocations.map((item) => ({
        sourceId: item.sourceId,
        tradeExecutionId: trade.id,
        userId: item.userId,
        amountKrw: item.amountKrw,
        deployedAt: executedAt
      }))
    });
  }

  const externalInvestorInflowKrw = allocation.allocations.reduce((sum, item) => {
    return sourceById.get(item.sourceId)?.sourceType === "CONTRACT_DEPOSIT"
      ? sum + item.amountKrw
      : sum;
  }, 0);
  const currentCashKrw = await portfolioCashBalance(transaction);
  const companyContributionKrw = Math.max(
    execution.cashAmountKrw - currentCashKrw - externalInvestorInflowKrw,
    0
  );
  const cashEntries: Prisma.PortfolioCashEntryCreateManyInput[] = [];
  if (externalInvestorInflowKrw > 0) {
    cashEntries.push({
      referenceKey: `TRADE:${trade.id}:INVESTOR_TRANSFER`,
      entryType: "INVESTOR_CAPITAL_TRANSFER",
      amountKrw: externalInvestorInflowKrw,
      occurredAt: executedAt,
      memo: `${execution.symbol} 매수에 실제 편입된 계약입금`
    });
  }
  if (companyContributionKrw > 0) {
    cashEntries.push({
      referenceKey: `TRADE:${trade.id}:COMPANY_CONTRIBUTION`,
      entryType: "COMPANY_CONTRIBUTION",
      amountKrw: companyContributionKrw,
      occurredAt: executedAt,
      memo: `${execution.symbol} 매수 부족현금 회사 부담`
    });
  }
  cashEntries.push({
    referenceKey: `TRADE:${trade.id}:BUY_SETTLEMENT`,
    entryType: "BUY_SETTLEMENT",
    amountKrw: -execution.cashAmountKrw,
    occurredAt: executedAt,
    memo: `${execution.symbol} 매수 결제대금`
  });
  await transaction.portfolioCashEntry.createMany({ data: cashEntries });
  return trade;
}

export async function readCurrentInvestorPrincipals() {
  const [deployments, withdrawals] = await Promise.all([
    prisma.capitalDeployment.findMany({ include: { source: true } }),
    prisma.investorWithdrawalSettlement.findMany()
  ]);
  const accounts = new Map<string, { userId: string; userName: string; userEmail: string; principalKrw: number }>();
  for (const deployment of deployments) {
    const account = accounts.get(deployment.userId) ?? {
      userId: deployment.userId,
      userName: deployment.source.userName,
      userEmail: deployment.source.userEmail,
      principalKrw: 0
    };
    account.principalKrw += deployment.amountKrw;
    accounts.set(deployment.userId, account);
  }
  for (const withdrawal of withdrawals) {
    const account = accounts.get(withdrawal.userId);
    if (account) account.principalKrw -= withdrawal.principalReductionKrw;
  }
  return [...accounts.values()]
    .map((account) => ({ ...account, principalKrw: Math.max(0, account.principalKrw) }))
    .filter((account) => account.principalKrw > 0)
    .sort((left, right) => left.userId.localeCompare(right.userId));
}

export async function readEligibleInvestorPrincipals(dividendMonth: string) {
  const monthEnd = monthStartKst(nextMonth(dividendMonth));
  const [deployments, withdrawals] = await Promise.all([
    prisma.capitalDeployment.findMany({
      where: { deployedAt: { lt: monthEnd } },
      include: { source: true }
    }),
    prisma.investorWithdrawalSettlement.findMany({ where: { settledAt: { lt: monthEnd } } })
  ]);
  const remaining = new CalculateDividendPrincipalService().execute({
    dividendMonth,
    investments: deployments.map((deployment) => ({
      id: deployment.id,
      userId: deployment.userId,
      amountKrw: deployment.amountKrw,
      acceptedAt: deployment.deployedAt.toISOString()
    })),
    withdrawals: withdrawals.map((withdrawal) => ({
      id: withdrawal.id,
      userId: withdrawal.userId,
      amountKrw: withdrawal.principalReductionKrw,
      acceptedAt: withdrawal.settledAt.toISOString()
    }))
  });
  const sourceByDeployment = new Map(deployments.map((deployment) => [deployment.id, deployment.source]));
  const accounts = new Map<string, { userId: string; userName: string; userEmail: string; principalKrw: number }>();
  for (const item of remaining) {
    const source = sourceByDeployment.get(item.id);
    if (!source) continue;
    const account = accounts.get(item.userId) ?? {
      userId: item.userId,
      userName: source.userName,
      userEmail: source.userEmail,
      principalKrw: 0
    };
    account.principalKrw += item.amountKrw;
    accounts.set(item.userId, account);
  }
  return [...accounts.values()].sort((left, right) => left.userId.localeCompare(right.userId));
}

export async function calculateMonthlyDistributionSettlement(input: {
  dividendMonth: string;
  actualDividendKrw: number;
  portfolioNetAssetsKrw: number;
  withholdingRate: number;
}) {
  const existing = await prisma.monthlyDistributionSettlement.findUnique({
    where: { dividendMonth: input.dividendMonth }
  });
  if (existing?.status === "FINALIZED") return { status: "already_finalized" as const };
  const investors = await readEligibleInvestorPrincipals(input.dividendMonth);
  const result = new CalculateMonthlyDistributionSettlementService().execute({
    actualDividendKrw: input.actualDividendKrw,
    portfolioNetAssetsKrw: input.portfolioNetAssetsKrw,
    investors
  });
  const withholdingRate = Math.min(Math.max(input.withholdingRate, 0), 1);

  await prisma.$transaction(async (transaction) => {
    await transaction.monthlyDistributionSettlement.deleteMany({
      where: { dividendMonth: input.dividendMonth, status: { not: "FINALIZED" } }
    });
    await transaction.monthlyDistributionSettlement.create({
      data: {
        dividendMonth: input.dividendMonth,
        actualDividendKrw: Math.floor(result.actualDividendKrw),
        portfolioNetAssetsKrw: Math.floor(input.portfolioNetAssetsKrw),
        investorPrincipalKrw: result.investorPrincipalKrw,
        companyPrincipalKrw: Math.floor(result.companyPrincipalKrw),
        investorBaseDividendKrw: Math.floor(result.investorBaseDividendKrw),
        companyTransferredKrw: Math.floor(result.companyTransferredDividendKrw),
        managementFeeKrw: result.managementFeeKrw,
        cashDistributionKrw: result.cashDistributionKrw,
        reinvestmentCreditKrw: result.reinvestmentCreditKrw,
        companyRetainedKrw: result.companyRetainedKrw,
        roundingCarryKrw: result.roundingCarryKrw,
        withholdingRate,
        status: "CALCULATED",
        calculatedAt: new Date(),
        allocations: {
          create: result.allocations.map((allocation) => {
            const taxableKrw = allocation.cashDistributionKrw + allocation.reinvestmentCreditKrw;
            const withholdingTaxKrw = Math.min(Math.floor(taxableKrw * withholdingRate), taxableKrw);
            return {
              userId: allocation.userId,
              userName: allocation.userName,
              userEmail: allocation.userEmail,
              principalKrw: allocation.principalKrw,
              managementFeeKrw: allocation.managementFeeKrw,
              cashDistributionKrw: allocation.cashDistributionKrw,
              reinvestmentCreditKrw: allocation.reinvestmentCreditKrw,
              withholdingTaxKrw,
              cashPayableKrw: Math.max(allocation.cashDistributionKrw - withholdingTaxKrw, 0)
            };
          })
        }
      }
    });
  });
  return { status: "calculated" as const, result };
}

export async function finalizeMonthlyDistributionSettlement(dividendMonth: string) {
  const locked = await withMysqlNamedLock(`nxdi:distribution:${dividendMonth}`, () =>
    prisma.$transaction(async (transaction) => {
      const settlement = await transaction.monthlyDistributionSettlement.findUnique({
        where: { dividendMonth },
        include: { allocations: true }
      });
      if (!settlement) return { status: "not_found" as const };
      if (settlement.status === "FINALIZED") return { status: "already_finalized" as const };
      const { start, end } = monthRangeKst(dividendMonth);
      const receipts = await transaction.underlyingDistributionReceipt.findMany({
        where: { receivedAt: { gte: start, lt: end } },
        include: { reversal: { select: { id: true } } }
      });
      const currentReceiptTotalKrw = receipts.reduce(
        (sum, receipt) => sum + (receipt.reversal ? 0 : receipt.netAmountKrw),
        0
      );
      if (currentReceiptTotalKrw !== settlement.actualDividendKrw) {
        return { status: "receipt_changed" as const };
      }
      const finalizedAt = new Date();
      for (const allocation of settlement.allocations) {
        const taxFromReinvestmentKrw = Math.max(
          allocation.withholdingTaxKrw - allocation.cashDistributionKrw,
          0
        );
        const netReinvestmentKrw = Math.max(
          allocation.reinvestmentCreditKrw - taxFromReinvestmentKrw,
          0
        );
        if (netReinvestmentKrw <= 0) continue;
        const source = await transaction.investorCapitalSource.create({
          data: {
            referenceKey: `REINVESTMENT:${dividendMonth}:${allocation.userId}`,
            sourceType: "REINVESTMENT",
            userId: allocation.userId,
            userName: allocation.userName,
            userEmail: allocation.userEmail,
            amountKrw: netReinvestmentKrw,
            receivedAt: finalizedAt,
            availableAt: finalizedAt,
            note: `${dividendMonth} 월 현금상한 초과 재투자 대기금`
          }
        });
        await transaction.investorDistributionAllocation.update({
          where: { id: allocation.id },
          data: { capitalSourceId: source.id }
        });
      }
      await transaction.monthlyDistributionSettlement.update({
        where: { dividendMonth },
        data: { status: "FINALIZED", finalizedAt }
      });
      return { status: "finalized" as const };
    }, { isolationLevel: "Serializable" })
  , 5);
  if (!locked.acquired) throw new Error("Could not acquire distribution settlement lock");
  return locked.value;
}

export async function confirmInvestorDistributionPayout(input: {
  allocationId: string;
  payoutReference: string;
  taxRemittanceReference: string;
}) {
  const locked = await withMysqlNamedLock(`nxdi:distribution-payout:${input.allocationId}`, () =>
    prisma.$transaction(async (transaction) => {
      const allocation = await transaction.investorDistributionAllocation.findUnique({
        where: { id: input.allocationId },
        include: { settlement: true }
      });
      if (!allocation || allocation.settlement.status !== "FINALIZED") return { status: "not_finalized" as const };
      if (allocation.payoutStatus === "PAID") return { status: "already_paid" as const };
      const payoutReference = input.payoutReference.trim();
      const taxRemittanceReference = input.taxRemittanceReference.trim();
      if (!payoutReference || !taxRemittanceReference) return { status: "invalid_reference" as const };
      const duplicate = await transaction.investorDistributionAllocation.findFirst({
        where: {
          OR: [{ payoutReference }, { taxRemittanceReference }],
          id: { not: allocation.id }
        },
        select: { id: true }
      });
      if (duplicate) return { status: "invalid_reference" as const };
      const requiredCashKrw = allocation.cashPayableKrw + allocation.withholdingTaxKrw;
      if (await portfolioCashBalance(transaction) < requiredCashKrw) {
        return { status: "insufficient_liquidity" as const };
      }
      const paidAt = new Date();
      const entries: Prisma.PortfolioCashEntryCreateManyInput[] = [];
      if (allocation.cashPayableKrw > 0) entries.push({
        referenceKey: `DISTRIBUTION_ALLOCATION:${allocation.id}:PAYOUT`,
        entryType: "INVESTOR_DISTRIBUTION_PAYOUT",
        amountKrw: -allocation.cashPayableKrw,
        occurredAt: paidAt,
        memo: `${allocation.dividendMonth} ${allocation.userName} 현금 분배 (${payoutReference})`
      });
      if (allocation.withholdingTaxKrw > 0) entries.push({
        referenceKey: `DISTRIBUTION_ALLOCATION:${allocation.id}:WITHHOLDING`,
        entryType: "WITHHOLDING_TAX_REMITTANCE",
        amountKrw: -allocation.withholdingTaxKrw,
        occurredAt: paidAt,
        memo: `${allocation.dividendMonth} ${allocation.userName} 원천세 (${taxRemittanceReference})`
      });
      if (entries.length > 0) await transaction.portfolioCashEntry.createMany({ data: entries });
      await transaction.investorDistributionAllocation.update({
        where: { id: allocation.id },
        data: {
          payoutStatus: "PAID",
          payoutReference,
          taxRemittanceReference,
          paidAt,
          lastPayoutFailureAt: null,
          lastPayoutFailureReason: null
        }
      });
      return { status: "paid" as const };
    }, { isolationLevel: "Serializable" })
  , 5);
  if (!locked.acquired) throw new Error("Could not acquire distribution payout lock");
  return locked.value;
}

export async function recordInvestorDistributionPayoutFailure(input: {
  allocationId: string;
  reason: string;
}) {
  const allocation = await prisma.investorDistributionAllocation.findUnique({ where: { id: input.allocationId } });
  if (!allocation || allocation.payoutStatus === "PAID") return { status: "not_pending" as const };
  await prisma.investorDistributionAllocation.update({
    where: { id: allocation.id },
    data: {
      payoutStatus: "FAILED",
      lastPayoutFailureAt: new Date(),
      lastPayoutFailureReason: input.reason.trim()
    }
  });
  return { status: "recorded" as const };
}

export async function deleteMonthlyDistributionDraft(dividendMonth: string) {
  const settlement = await prisma.monthlyDistributionSettlement.findUnique({ where: { dividendMonth } });
  if (settlement?.status === "FINALIZED") return { status: "already_finalized" as const };
  await prisma.$transaction([
    prisma.monthlyDistributionSettlement.deleteMany({ where: { dividendMonth } }),
    prisma.monthlyDividendRecord.deleteMany({ where: { dividendMonth } })
  ]);
  return { status: "deleted" as const };
}

export async function settleAcceptedWithdrawal(input: {
  withdrawalIntentId: string;
  portfolioNetAssetsKrw: number;
  instructionReference: string;
  instructionSignedAt: string;
  payoutReference: string;
  note?: string;
}) {
  const locked = await withMysqlNamedLock(`nxdi:withdrawal-settlement:${input.withdrawalIntentId}`, async () => {
    const existing = await prisma.investorWithdrawalSettlement.findUnique({
      where: { withdrawalIntentId: input.withdrawalIntentId }
    });
    if (existing) return { status: "already_settled" as const, settlement: existing };
    const intent = await prisma.withdrawalIntent.findUnique({ where: { id: input.withdrawalIntentId } });
    if (!intent || intent.status !== "ACCEPTED") return { status: "intent_not_accepted" as const };
    const instructionSignedAt = validDate(input.instructionSignedAt);
    if (
      !input.instructionReference.trim() ||
      !input.payoutReference.trim() ||
      instructionSignedAt.getTime() > Date.now() + 5 * 60 * 1000
    ) return { status: "invalid_instruction" as const };
    const compliance = await prisma.investorComplianceProfile.findUnique({ where: { userId: intent.userId } });
    const complianceValid = Boolean(
      compliance?.realNameVerifiedAt &&
      compliance.bankAccountVerifiedAt &&
      compliance.suitabilityCompletedAt &&
      compliance.amlClearedAt &&
      compliance.sanctionsCheckedAt &&
      compliance.expiresAt > new Date()
    );
    if (!complianceValid) return { status: "compliance_required" as const };
    const duplicateReference = await prisma.investorWithdrawalSettlement.findFirst({
      where: {
        OR: [
          { instructionReference: input.instructionReference.trim() },
          { payoutReference: input.payoutReference.trim() }
        ]
      },
      select: { id: true }
    });
    if (duplicateReference) return { status: "duplicate_reference" as const };
    const accounts = await readCurrentInvestorPrincipals();
    const account = accounts.find((item) => item.userId === intent.userId);
    const totalInvestorPrincipalKrw = accounts.reduce((sum, item) => sum + item.principalKrw, 0);
    const availableCashKrw = await portfolioCashBalance();
    const calculation = new CalculateWithdrawalSettlementService().execute({
      requestedPrincipalReductionKrw: intent.amountKrw,
      userPrincipalKrw: account?.principalKrw ?? 0,
      totalInvestorPrincipalKrw,
      portfolioNetAssetsKrw: input.portfolioNetAssetsKrw,
      availableCashKrw
    });
    if (calculation.status !== "calculated") return calculation;
    const settlement = await prisma.$transaction(async (transaction) => {
      const settledAt = new Date();
      const created = await transaction.investorWithdrawalSettlement.create({
        data: {
          withdrawalIntentId: intent.id,
          instructionReference: input.instructionReference.trim(),
          instructionSignedAt,
          payoutReference: input.payoutReference.trim(),
          userId: intent.userId,
          userName: intent.userName,
          userEmail: intent.userEmail,
          principalReductionKrw: calculation.principalReductionKrw,
          investorLossRate: calculation.investorLossRate,
          investorLossKrw: calculation.investorLossKrw,
          payableKrw: calculation.payableKrw,
          feeKrw: 0,
          taxKrw: 0,
          paidKrw: calculation.payableKrw,
          settledAt,
          note: input.note?.trim() || undefined
        }
      });
      await transaction.portfolioCashEntry.create({
        data: {
          referenceKey: `WITHDRAWAL:${created.id}:PAYOUT`,
          entryType: "WITHDRAWAL_PAYOUT",
          amountKrw: -created.paidKrw,
          occurredAt: settledAt,
          memo: `${intent.userName} 실제 출금 정산`
        }
      });
      return created;
    }, { isolationLevel: "Serializable" });
    return { status: "settled" as const, settlement };
  }, 5);
  if (!locked.acquired) throw new Error("Could not acquire withdrawal settlement lock");
  return locked.value;
}

export async function returnUndeployedCapital(input: {
  sourceId: string;
  amountKrw: number;
  reason: string;
}) {
  const source = await prisma.investorCapitalSource.findUnique({
    where: { id: input.sourceId },
    include: { deployments: { select: { amountKrw: true } }, returns: { select: { amountKrw: true } } }
  });
  if (!source) return { status: "not_found" as const };
  const amountKrw = Math.max(0, Math.floor(input.amountKrw));
  if (amountKrw <= 0 || amountKrw > availableSourceAmount(source)) {
    return { status: "amount_exceeded" as const };
  }
  const returnedAt = new Date();
  const returned = await prisma.$transaction(async (transaction) => {
    const record = await transaction.capitalSourceReturn.create({
      data: { sourceId: source.id, amountKrw, returnedAt, reason: input.reason.trim() }
    });
    if (source.sourceType === "REINVESTMENT") {
      await transaction.portfolioCashEntry.create({
        data: {
          referenceKey: `CAPITAL_RETURN:${record.id}`,
          entryType: "UNDEPLOYED_CAPITAL_RETURN",
          amountKrw: -amountKrw,
          occurredAt: returnedAt,
          memo: input.reason.trim()
        }
      });
    }
    return record;
  });
  return { status: "returned" as const, returned };
}

export async function readCapitalLedgerOverview() {
  const [sources, accounts, cashBalanceKrw, withdrawals, distributions, complianceProfiles, distributionReceipts] = await Promise.all([
    prisma.investorCapitalSource.findMany({
      include: {
        deployments: { select: { amountKrw: true, deployedAt: true } },
        returns: { select: { amountKrw: true, returnedAt: true } }
      },
      orderBy: [{ availableAt: "desc" }, { id: "desc" }]
    }),
    readCurrentInvestorPrincipals(),
    portfolioCashBalance(),
    prisma.investorWithdrawalSettlement.findMany({ orderBy: { settledAt: "desc" } }),
    prisma.monthlyDistributionSettlement.findMany({
      include: { allocations: true },
      orderBy: { dividendMonth: "desc" },
      take: 24
    }),
    prisma.investorComplianceProfile.findMany({ orderBy: { userName: "asc" } }),
    prisma.underlyingDistributionReceipt.findMany({
      include: { reversal: true },
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
      take: 100
    })
  ]);
  return {
    sources: sources.map((source) => ({
      id: source.id,
      referenceKey: source.referenceKey,
      sourceType: source.sourceType,
      sourceIntentId: source.sourceIntentId ?? undefined,
      contractReference: source.contractReference ?? undefined,
      contractVersion: source.contractVersion ?? undefined,
      depositReference: source.depositReference ?? undefined,
      userId: source.userId,
      userName: source.userName,
      userEmail: source.userEmail,
      contractedAmountKrw: source.contractedAmountKrw ?? undefined,
      amountKrw: source.amountKrw,
      deployedKrw: source.deployments.reduce((sum, item) => sum + item.amountKrw, 0),
      returnedKrw: source.returns.reduce((sum, item) => sum + item.amountKrw, 0),
      availableKrw: availableSourceAmount(source),
      contractedAt: source.contractedAt?.toISOString(),
      receivedAt: source.receivedAt.toISOString(),
      availableAt: source.availableAt.toISOString(),
      note: source.note ?? undefined
    })),
    investorAccounts: accounts,
    totalInvestorPrincipalKrw: accounts.reduce((sum, item) => sum + item.principalKrw, 0),
    cashBalanceKrw,
    withdrawals: withdrawals.map((item) => ({ ...item, settledAt: item.settledAt.toISOString(), createdAt: item.createdAt.toISOString() })),
    distributions: distributions.map((item) => ({
      ...item,
      calculatedAt: item.calculatedAt.toISOString(),
      finalizedAt: item.finalizedAt?.toISOString(),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      allocations: item.allocations.map((allocation) => ({
        ...allocation,
        paidAt: allocation.paidAt?.toISOString(),
        lastPayoutFailureAt: allocation.lastPayoutFailureAt?.toISOString(),
        createdAt: allocation.createdAt.toISOString()
      }))
    })),
    complianceProfiles: complianceProfiles.map((profile) => ({
      ...profile,
      realNameVerifiedAt: profile.realNameVerifiedAt?.toISOString(),
      bankAccountVerifiedAt: profile.bankAccountVerifiedAt?.toISOString(),
      suitabilityCompletedAt: profile.suitabilityCompletedAt?.toISOString(),
      amlClearedAt: profile.amlClearedAt?.toISOString(),
      sanctionsCheckedAt: profile.sanctionsCheckedAt?.toISOString(),
      guardianVerifiedAt: profile.guardianVerifiedAt?.toISOString(),
      expiresAt: profile.expiresAt.toISOString(),
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString()
    })),
    distributionReceipts: distributionReceipts.map((receipt) => ({
      ...receipt,
      exchangeRate: receipt.exchangeRate ?? undefined,
      note: receipt.note ?? undefined,
      reversedAt: receipt.reversal?.reversedAt.toISOString(),
      reversalReason: receipt.reversal?.reason,
      receivedAt: receipt.receivedAt.toISOString(),
      createdAt: receipt.createdAt.toISOString()
    }))
  };
}
