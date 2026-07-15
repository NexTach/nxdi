import { Prisma } from "@prisma/client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { isAdminUser } from "../auth/admin.js";
import { requestUser } from "../auth/session.js";
import {
  deleteDisclosure,
  readDisclosure,
  upsertDisclosure,
  type DisclosureTradeInput
} from "../infrastructure/disclosures.js";
import {
  deleteDividendRecord,
  upsertDividendRecord,
  upsertMonthlyDividendRecord
} from "../infrastructure/dividends.js";
import { fetchDividendRecordFromMarket } from "../infrastructure/market-data.js";
import {
  approveInvestorCompliance,
  calculateMonthlyDistributionSettlement,
  confirmInvestorDistributionPayout,
  confirmContractDeposit,
  deleteMonthlyDistributionDraft,
  finalizeMonthlyDistributionSettlement,
  readUnderlyingDistributionMonthTotal,
  recordInvestorDistributionPayoutFailure,
  recordUnderlyingDistributionReceipt,
  reverseUnderlyingDistributionReceipt,
  returnUndeployedCapital,
  settleAcceptedWithdrawal
} from "../infrastructure/capital-ledger.js";
import {
  applyManualHoldingTrade,
  deleteManualHolding,
  finalizePortfolioDailySnapshot,
  getManualPortfolioOverview,
  readMonthEndPortfolioNetAssets,
  readLatestClosedPortfolioNetAssets,
  refreshPortfolioMarketSnapshot,
  upsertManualHolding
} from "../infrastructure/portfolio-store.js";
import {
  ROADMAP_EVENT_CATEGORIES,
  ROADMAP_EVENT_KINDS,
  createRoadmapEvent,
  deleteRoadmapEvent,
  deriveRoadmapCategory,
  deriveRoadmapKind,
  isRoadmapEventMoveDate,
  isValidDateKey,
  updateRoadmapEvent
} from "../infrastructure/roadmap.js";
import { updateIntentStatus } from "../infrastructure/store.js";
import { errorFlash, redirectWithFlash, successFlash } from "../http/flash.js";

function admin(request: FastifyRequest) {
  return isAdminUser(requestUser(request));
}

function rejectAdminForm(reply: FastifyReply) {
  return redirectWithFlash(reply, "/admin", errorFlash("admin_required"));
}

function formBody(request: FastifyRequest) {
  return request.body as Record<string, unknown> | undefined;
}

function adminError(reply: FastifyReply, code: string) {
  return redirectWithFlash(reply, "/admin", errorFlash(code));
}

function adminSuccess(reply: FastifyReply, id: string, title: string) {
  return redirectWithFlash(reply, "/admin", successFlash(id, title));
}

const kstDateTimeSchema = z.string().trim().min(1).transform((value, context) => {
  const hasZone = /(Z|[+-]\d{2}:\d{2})$/.test(value);
  const seconds = /T\d{2}:\d{2}$/.test(value) ? ":00" : "";
  const date = new Date(hasZone ? value : `${value}${seconds}+09:00`);
  if (Number.isNaN(date.getTime())) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "invalid datetime" });
    return z.NEVER;
  }
  return date.toISOString();
});

const holdingSchema = z.object({
  symbol: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  alias: z.preprocess((value) => value === "" ? undefined : value, z.string().trim().max(80).optional()),
  marketCountry: z.enum(["NASDAQ", "NYSE", "AMEX", "KOSPI", "KOSDAQ"]),
  currency: z.enum(["KRW", "USD"]),
  riskLevel: z.preprocess((value) => value === "" ? undefined : value, z.enum(["LOW", "HIGH"]).optional()),
  quantity: z.preprocess((value) => value === "" || value === undefined ? 0 : value, z.coerce.number().nonnegative()),
  lastPrice: z.coerce.number().positive(),
  averagePurchasePrice: z.preprocess(
    (value) => value === "" || value === undefined ? undefined : value,
    z.coerce.number().positive().optional()
  ),
  purchaseExchangeRate: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.coerce.number().min(500).max(3000).optional()
  )
});

function normalizeHoldingSymbol(symbol: string, currency: "KRW" | "USD", market: string) {
  const normalized = symbol.trim().toUpperCase();
  if (currency === "KRW" && market === "KOSDAQ") return `${normalized.replace(/\.(KS|KQ)$/, "")}.KQ`;
  if (currency === "KRW") return normalized.replace(/\.(KS|KQ)$/, "");
  return normalized;
}

const tradeSchema = z.object({
  tradeSymbol: z.string().trim().min(1).max(20),
  side: z.enum(["BUY", "SELL"]),
  tradeQuantity: z.coerce.number().positive(),
  orderPrice: z.coerce.number().positive(),
  exchangeRate: z.preprocess((value) => value === "" ? undefined : value, z.coerce.number().min(500).max(3000).optional()),
  feeKrw: z.coerce.number().int().nonnegative().default(0),
  taxKrw: z.coerce.number().int().nonnegative().default(0),
  executedAt: kstDateTimeSchema
});

const disclosureTradeSchema = z.object({
  side: z.enum(["BUY", "SELL"]),
  symbol: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  alias: z.preprocess((value) => value === "" ? undefined : value, z.string().trim().max(80).optional()),
  marketCountry: z.enum(["NASDAQ", "NYSE", "AMEX", "KOSPI", "KOSDAQ"]),
  currency: z.enum(["KRW", "USD"]),
  quantity: z.coerce.number().positive(),
  orderPrice: z.coerce.number().positive(),
  exchangeRate: z.preprocess((value) => value === "" || value === null ? undefined : value, z.coerce.number().min(500).max(3000).optional()),
  profitRate: z.coerce.number(),
  feeKrw: z.coerce.number().int().nonnegative(),
  taxKrw: z.coerce.number().int().nonnegative(),
  orderedAt: z.string().trim().min(1)
}).superRefine((trade, context) => {
  if (trade.currency === "USD" && trade.exchangeRate === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["exchangeRate"], message: "required" });
  }
});

function prismaCode(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code;
  if (typeof error === "object" && error !== null && "code" in error) return String(error.code);
  return undefined;
}

export async function registerAdminRoutes(app: FastifyInstance) {
  app.post("/api/admin/status", async (request, reply) => {
    if (!admin(request)) return rejectAdminForm(reply);
    const parsed = z.object({
      type: z.enum(["INVESTMENT", "WITHDRAWAL"]),
      id: z.string().cuid(),
      status: z.enum(["PENDING", "ACCEPTED", "REJECTED"])
    }).safeParse(formBody(request));
    if (!parsed.success) return adminError(reply, "invalid_status");
    const result = await updateIntentStatus(parsed.data);
    if (result.status === "principal_invariant") return adminError(reply, "status_principal_invariant");
    if (result.status === "not_found") return adminError(reply, "invalid_status");
    return adminSuccess(reply, "admin-updated", "상태가 저장되었습니다");
  });

  app.post("/api/admin/capital/confirm", async (request, reply) => {
    if (!admin(request)) return rejectAdminForm(reply);
    const parsed = z.object({
      investmentIntentId: z.string().cuid(),
      contractReference: z.string().trim().min(1).max(120),
      contractVersion: z.string().trim().min(1).max(32),
      depositReference: z.string().trim().min(1).max(120),
      contractedAmountKrw: z.coerce.number().int().positive(),
      receivedAmountKrw: z.coerce.number().int().positive(),
      contractedAt: kstDateTimeSchema,
      receivedAt: kstDateTimeSchema,
      note: z.preprocess((value) => value === "" ? undefined : value, z.string().trim().max(500).optional())
    }).safeParse(formBody(request));
    if (!parsed.success) return adminError(reply, "invalid_capital_source");
    const result = await confirmContractDeposit(parsed.data);
    if (result.status === "intent_not_accepted") return adminError(reply, "capital_intent_not_accepted");
    if (result.status === "compliance_required") return adminError(reply, "compliance_required");
    if (result.status === "invalid_amount") return adminError(reply, "invalid_capital_source");
    if (result.status === "already_confirmed") return adminError(reply, "capital_already_confirmed");
    return adminSuccess(reply, "capital-confirmed", "별도 계약·입금이 미편입 예수금으로 기록되었습니다");
  });

  app.post("/api/admin/compliance/approve", async (request, reply) => {
    if (!admin(request)) return rejectAdminForm(reply);
    const parsed = z.object({
      userId: z.string().trim().min(1).max(100),
      userName: z.string().trim().min(1).max(100),
      userEmail: z.string().trim().email().max(191),
      riskGrade: z.enum(["CONSERVATIVE", "MODERATE", "AGGRESSIVE"]),
      realNameVerified: z.literal("true").transform(() => true),
      bankAccountVerified: z.literal("true").transform(() => true),
      suitabilityCompleted: z.literal("true").transform(() => true),
      amlCleared: z.literal("true").transform(() => true),
      sanctionsChecked: z.literal("true").transform(() => true),
      guardianVerified: z.preprocess((value) => value === "true", z.boolean()),
      note: z.preprocess((value) => value === "" ? undefined : value, z.string().trim().max(500).optional())
    }).safeParse(formBody(request));
    if (!parsed.success) return adminError(reply, "invalid_compliance");
    await approveInvestorCompliance(parsed.data);
    return adminSuccess(reply, "compliance-approved", "본인확인·적합성·AML 확인을 기록했습니다");
  });

  app.post("/api/admin/capital/return", async (request, reply) => {
    if (!admin(request)) return rejectAdminForm(reply);
    const parsed = z.object({
      sourceId: z.string().cuid(),
      amountKrw: z.coerce.number().int().positive(),
      reason: z.string().trim().min(1).max(160)
    }).safeParse(formBody(request));
    if (!parsed.success) return adminError(reply, "invalid_capital_return");
    const result = await returnUndeployedCapital(parsed.data);
    if (result.status !== "returned") return adminError(reply, "invalid_capital_return");
    return adminSuccess(reply, "capital-returned", "미편입 자금 반환이 원장에 기록되었습니다");
  });

  app.post("/api/admin/portfolio/holding", async (request, reply) => {
    if (!admin(request)) return rejectAdminForm(reply);
    const parsed = holdingSchema.safeParse(formBody(request));
    if (!parsed.success) return adminError(reply, "invalid_holding");
    const symbol = normalizeHoldingSymbol(parsed.data.symbol, parsed.data.currency, parsed.data.marketCountry);
    const result = await upsertManualHolding({
      ...parsed.data,
      symbol,
      purchaseExchangeRate: parsed.data.currency === "USD" ? parsed.data.purchaseExchangeRate : undefined
    });
    void fetchDividendRecordFromMarket(symbol)
      .then((dividend) => dividend ? upsertDividendRecord(dividend) : undefined)
      .catch((error) => {
        request.log.warn(
          { symbol, err: error instanceof Error ? error.message : "unknown" },
          "Dividend sync failed after holding update"
        );
      });
    return adminSuccess(
      reply,
      "portfolio-updated",
      result.status === "created"
        ? "종목 메타데이터가 등록되었습니다. 수량은 실제 매수 체결로만 반영됩니다"
        : "종목 메타데이터가 저장되었습니다"
    );
  });

  app.post("/api/admin/portfolio/trade", async (request, reply) => {
    if (!admin(request)) return rejectAdminForm(reply);
    const parsed = tradeSchema.safeParse(formBody(request));
    if (!parsed.success) return adminError(reply, "invalid_trade");
    const result = await applyManualHoldingTrade({
      symbol: parsed.data.tradeSymbol,
      side: parsed.data.side,
      quantity: parsed.data.tradeQuantity,
      orderPrice: parsed.data.orderPrice,
      exchangeRate: parsed.data.exchangeRate,
      feeKrw: parsed.data.feeKrw,
      taxKrw: parsed.data.taxKrw,
      executedAt: parsed.data.executedAt
    });
    const errors: Partial<Record<typeof result.status, string>> = {
      not_found: "trade_not_found",
      insufficient_quantity: "trade_insufficient",
      missing_exchange_rate: "invalid_exchange_rate",
      missing_cost_basis: "invalid_trade",
      risk_unclassified: "risk_unclassified"
    };
    const code = errors[result.status];
    if (code) return adminError(reply, code);
    return adminSuccess(reply, "portfolio-traded", "거래가 포트폴리오에 반영되었습니다");
  });

  app.post("/api/admin/portfolio/delete", async (request, reply) => {
    if (!admin(request)) return rejectAdminForm(reply);
    const parsed = z.object({ symbol: z.string().trim().min(1).max(20) }).safeParse(formBody(request));
    if (!parsed.success) return adminError(reply, "invalid_delete");
    const result = await deleteManualHolding(parsed.data.symbol);
    if (result.status === "holding_not_empty") return adminError(reply, "holding_not_empty");
    return adminSuccess(reply, "portfolio-deleted", "포트폴리오 종목이 삭제되었습니다");
  });

  app.post("/api/admin/dividends/record", async (request, reply) => {
    if (!admin(request)) return rejectAdminForm(reply);
    const parsed = z.object({
      symbol: z.string().trim().min(1).max(20),
      currency: z.enum(["KRW", "USD"]),
      annualDividendPerShare: z.coerce.number().min(0),
      trailingYield: z.preprocess((value) => value === "" ? undefined : value, z.coerce.number().min(0).optional()),
      expectedPaymentMonths: z.string().min(1).max(80),
      lastDividendPerShare: z.preprocess((value) => value === "" ? undefined : value, z.coerce.number().min(0).optional()),
      memo: z.preprocess((value) => value === "" ? undefined : value, z.string().max(500).optional())
    }).safeParse(formBody(request));
    if (!parsed.success) return adminError(reply, "invalid_dividend");
    const months = parsed.data.expectedPaymentMonths.split(",").map(Number).filter((month) => Number.isInteger(month) && month >= 1 && month <= 12);
    if (!months.length) return adminError(reply, "invalid_dividend_months");
    await upsertDividendRecord({
      symbol: parsed.data.symbol.toUpperCase(),
      currency: parsed.data.currency,
      annualDividendPerShare: parsed.data.annualDividendPerShare,
      trailingYield: parsed.data.trailingYield === undefined ? undefined : parsed.data.trailingYield / 100,
      expectedPaymentMonths: months,
      lastDividendPerShare: parsed.data.lastDividendPerShare,
      memo: parsed.data.memo
    });
    return adminSuccess(reply, "dividend-updated", "배당 데이터가 저장되었습니다");
  });

  app.post("/api/admin/dividends/delete", async (request, reply) => {
    if (!admin(request)) return rejectAdminForm(reply);
    const parsed = z.object({ symbol: z.string().trim().min(1).max(20) }).safeParse(formBody(request));
    if (!parsed.success) return adminError(reply, "invalid_dividend_delete");
    await deleteDividendRecord(parsed.data.symbol);
    return adminSuccess(reply, "dividend-deleted", "배당 데이터가 삭제되었습니다");
  });

  app.post("/api/admin/dividends/sync", async (request, reply) => {
    if (!admin(request)) return rejectAdminForm(reply);
    const parsed = z.object({ symbol: z.string().trim().min(1).max(20) }).safeParse(formBody(request));
    if (!parsed.success) return adminError(reply, "invalid_dividend_sync");
    const record = await fetchDividendRecordFromMarket(parsed.data.symbol);
    if (!record) return adminError(reply, "dividend_sync_failed");
    await upsertDividendRecord(record);
    return adminSuccess(reply, "dividend-synced", "배당 데이터가 동기화되었습니다");
  });

  app.post("/api/admin/dividends/monthly/record", async (request, reply) => {
    if (!admin(request)) return rejectAdminForm(reply);
    const parsed = z.object({
      dividendMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      withholdingRate: z.coerce.number().min(0).max(100).transform((value) => value / 100),
      memo: z.preprocess((value) => value === "" ? undefined : value, z.string().trim().max(500).optional())
    }).safeParse(formBody(request));
    if (!parsed.success) return adminError(reply, "invalid_monthly_dividend");
    const portfolioNetAssetsKrw = await readMonthEndPortfolioNetAssets(parsed.data.dividendMonth);
    if (!portfolioNetAssetsKrw || portfolioNetAssetsKrw <= 0) {
      return adminError(reply, "month_end_snapshot_required");
    }
    const receiptSummary = await readUnderlyingDistributionMonthTotal(parsed.data.dividendMonth);
    if (receiptSummary.receiptCount <= 0) return adminError(reply, "distribution_receipt_required");
    await upsertMonthlyDividendRecord({
      dividendMonth: parsed.data.dividendMonth,
      actualDividendKrw: receiptSummary.actualDividendKrw,
      referenceMarketValueKrw: portfolioNetAssetsKrw,
      memo: parsed.data.memo
    });
    const settlement = await calculateMonthlyDistributionSettlement({
      dividendMonth: parsed.data.dividendMonth,
      actualDividendKrw: receiptSummary.actualDividendKrw,
      portfolioNetAssetsKrw,
      withholdingRate: parsed.data.withholdingRate
    });
    if (settlement.status === "already_finalized") return adminError(reply, "distribution_already_finalized");
    return adminSuccess(reply, "monthly-dividend-updated", "실 배당과 월말 자동 정산안이 저장되었습니다");
  });

  app.post("/api/admin/dividends/receipt", async (request, reply) => {
    if (!admin(request)) return rejectAdminForm(reply);
    const parsed = z.object({
      symbol: z.string().trim().min(1).max(20),
      currency: z.enum(["KRW", "USD"]),
      grossAmountNative: z.coerce.number().positive(),
      exchangeRate: z.preprocess((value) => value === "" ? undefined : value, z.coerce.number().positive().optional()),
      foreignTaxKrw: z.coerce.number().int().nonnegative().default(0),
      brokerageFeeKrw: z.coerce.number().int().nonnegative().default(0),
      fxCostKrw: z.coerce.number().int().nonnegative().default(0),
      receivedAt: kstDateTimeSchema,
      note: z.preprocess((value) => value === "" ? undefined : value, z.string().trim().max(500).optional())
    }).superRefine((value, context) => {
      if (value.currency === "USD" && value.exchangeRate === undefined) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["exchangeRate"], message: "required" });
      }
    }).safeParse(formBody(request));
    if (!parsed.success) return adminError(reply, "invalid_distribution_receipt");
    const result = await recordUnderlyingDistributionReceipt(parsed.data);
    if (result.status === "duplicate") return adminError(reply, "duplicate_distribution_receipt");
    if (result.status === "month_finalized") return adminError(reply, "distribution_already_finalized");
    if (result.status !== "recorded") return adminError(reply, "invalid_distribution_receipt");
    return adminSuccess(
      reply,
      "distribution-receipt-recorded",
      `실분배금 원장을 기록했습니다 · ${result.receipt.statementReference}`
    );
  });

  app.post("/api/admin/dividends/receipt/reverse", async (request, reply) => {
    if (!admin(request)) return rejectAdminForm(reply);
    const parsed = z.object({
      receiptId: z.string().cuid(),
      reason: z.string().trim().min(1).max(500)
    }).safeParse(formBody(request));
    if (!parsed.success) return adminError(reply, "invalid_distribution_receipt_reversal");
    const result = await reverseUnderlyingDistributionReceipt(parsed.data);
    if (result.status === "month_finalized") return adminError(reply, "distribution_already_finalized");
    if (result.status !== "reversed") return adminError(reply, "invalid_distribution_receipt_reversal");
    return adminSuccess(reply, "distribution-receipt-reversed", "실분배금 오류를 반대분개로 기록했습니다");
  });

  app.post("/api/admin/dividends/monthly/finalize", async (request, reply) => {
    if (!admin(request)) return rejectAdminForm(reply);
    const parsed = z.object({
      dividendMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    }).safeParse(formBody(request));
    if (!parsed.success) return adminError(reply, "invalid_monthly_dividend");
    const result = await finalizeMonthlyDistributionSettlement(parsed.data.dividendMonth);
    if (result.status === "not_found") return adminError(reply, "distribution_not_found");
    if (result.status === "already_finalized") return adminError(reply, "distribution_already_finalized");
    if (result.status === "receipt_changed") return adminError(reply, "distribution_receipt_changed");
    return adminSuccess(reply, "distribution-finalized", "투자자별 귀속액과 재투자 대기금이 확정되었습니다. 실제 지급은 거래식별값 확인 후 기록됩니다");
  });

  app.post("/api/admin/dividends/payout/confirm", async (request, reply) => {
    if (!admin(request)) return rejectAdminForm(reply);
    const parsed = z.object({
      allocationId: z.string().cuid(),
      payoutReference: z.string().trim().min(1).max(120),
      taxRemittanceReference: z.string().trim().min(1).max(120)
    }).safeParse(formBody(request));
    if (!parsed.success) return adminError(reply, "invalid_distribution_payout");
    const result = await confirmInvestorDistributionPayout(parsed.data);
    if (result.status === "insufficient_liquidity") return adminError(reply, "withdrawal_liquidity");
    if (result.status !== "paid") return adminError(reply, "invalid_distribution_payout");
    return adminSuccess(reply, "distribution-payout-confirmed", "투자자별 지급·원천세 현금원장을 기록했습니다");
  });

  app.post("/api/admin/dividends/payout/fail", async (request, reply) => {
    if (!admin(request)) return rejectAdminForm(reply);
    const parsed = z.object({
      allocationId: z.string().cuid(),
      reason: z.string().trim().min(1).max(500)
    }).safeParse(formBody(request));
    if (!parsed.success) return adminError(reply, "invalid_distribution_payout_failure");
    const result = await recordInvestorDistributionPayoutFailure(parsed.data);
    if (result.status !== "recorded") return adminError(reply, "invalid_distribution_payout_failure");
    return adminSuccess(reply, "distribution-payout-failed", "지급 실패사유를 기록하고 미지급 상태를 유지했습니다");
  });

  app.post("/api/admin/withdrawals/settle", async (request, reply) => {
    if (!admin(request)) return rejectAdminForm(reply);
    const parsed = z.object({
      withdrawalIntentId: z.string().cuid(),
      instructionReference: z.string().trim().min(1).max(120),
      instructionSignedAt: kstDateTimeSchema,
      payoutReference: z.string().trim().min(1).max(120),
      note: z.preprocess((value) => value === "" ? undefined : value, z.string().trim().max(500).optional())
    }).safeParse(formBody(request));
    if (!parsed.success) return adminError(reply, "invalid_withdrawal_settlement");
    await getManualPortfolioOverview();
    const closedValuation = await readLatestClosedPortfolioNetAssets();
    if (!closedValuation || closedValuation.netAssetsKrw <= 0 || !closedValuation.coversAllTrades) {
      return adminError(reply, "month_end_snapshot_required");
    }
    const result = await settleAcceptedWithdrawal({
      ...parsed.data,
      portfolioNetAssetsKrw: closedValuation.netAssetsKrw
    });
    if (result.status === "intent_not_accepted") return adminError(reply, "withdrawal_not_accepted");
    if (result.status === "principal_exceeded") return adminError(reply, "withdrawal_principal_exceeded");
    if (result.status === "insufficient_liquidity") return adminError(reply, "withdrawal_liquidity");
    if (result.status === "already_settled") return adminError(reply, "withdrawal_already_settled");
    if (result.status === "compliance_required") return adminError(reply, "compliance_required");
    if (result.status === "invalid_instruction" || result.status === "duplicate_reference") {
      return adminError(reply, "invalid_withdrawal_instruction");
    }
    return adminSuccess(reply, "withdrawal-settled", "실제 출금 정산과 원금 차감이 기록되었습니다");
  });

  app.post("/api/admin/dividends/monthly/delete", async (request, reply) => {
    if (!admin(request)) return rejectAdminForm(reply);
    const parsed = z.object({ dividendMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }).safeParse(formBody(request));
    if (!parsed.success) return adminError(reply, "invalid_monthly_dividend_delete");
    const result = await deleteMonthlyDistributionDraft(parsed.data.dividendMonth);
    if (result.status === "already_finalized") return adminError(reply, "distribution_already_finalized");
    return adminSuccess(reply, "monthly-dividend-deleted", "실 배당 기록이 삭제되었습니다");
  });

  app.post("/api/admin/disclosures", async (request, reply) => {
    if (!admin(request)) return rejectAdminForm(reply);
    const parsed = z.object({
      id: z.preprocess((value) => value === "" ? undefined : value, z.string().trim().optional()),
      title: z.string().trim().min(1).max(160),
      body: z.string().trim().min(1).max(10_000),
      tradesJson: z.string().default("[]")
    }).safeParse(formBody(request));
    if (!parsed.success) return adminError(reply, "invalid_disclosure");
    let rawTrades: unknown;
    try { rawTrades = JSON.parse(parsed.data.tradesJson); } catch { return adminError(reply, "invalid_disclosure_trade"); }
    const trades = z.array(disclosureTradeSchema).max(20).safeParse(rawTrades);
    if (!trades.success) return adminError(reply, "invalid_disclosure_trade");
    const normalized: DisclosureTradeInput[] = [];
    for (const trade of trades.data) {
      const orderedAt = new Date(trade.orderedAt);
      if (Number.isNaN(orderedAt.getTime())) return adminError(reply, "invalid_disclosure_trade");
      normalized.push({
        ...trade,
        symbol: trade.symbol.toUpperCase(),
        exchangeRate: trade.currency === "USD" ? trade.exchangeRate : undefined,
        profitRate: trade.profitRate / 100,
        orderedAt
      });
    }
    await upsertDisclosure({ id: parsed.data.id, title: parsed.data.title, body: parsed.data.body, trades: normalized });
    return adminSuccess(reply, `disclosure-${parsed.data.id ? "updated" : "created"}`, parsed.data.id ? "공시가 수정되었습니다" : "공시가 등록되었습니다");
  });

  app.post("/api/admin/disclosures/delete", async (request, reply) => {
    if (!admin(request)) return rejectAdminForm(reply);
    const parsed = z.object({ id: z.string().trim().min(1) }).safeParse(formBody(request));
    if (!parsed.success) return adminError(reply, "invalid_disclosure_delete");
    await deleteDisclosure(parsed.data.id);
    return adminSuccess(reply, "disclosure-deleted", "공시가 삭제되었습니다");
  });

  app.post("/api/admin/portfolio/snapshot/finalize", async (request, reply) => {
    if (!admin(request)) return rejectAdminForm(reply);
    const parsed = z.object({ date: z.preprocess((value) => value === "" ? undefined : value, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()) }).safeParse(formBody(request));
    if (!parsed.success) return adminError(reply, "invalid_snapshot");
    await refreshPortfolioMarketSnapshot();
    const result = await finalizePortfolioDailySnapshot(parsed.data.date);
    if (result.status === "not_found") return adminError(reply, "snapshot_not_found");
    return adminSuccess(reply, "portfolio-updated", "포트폴리오가 저장되었습니다");
  });

  app.post("/api/admin/roadmap-events", async (request, reply) => {
    if (!admin(request)) return reply.code(403).send({ error: "관리자 권한이 필요합니다." });
    const parsed = z.object({
      disclosureId: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/),
      eventDate: z.string().refine(isValidDateKey),
      label: z.string().trim().max(160).optional()
    }).strict().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "입력값을 확인해 주세요.", fields: parsed.error.flatten().fieldErrors });
    if (!isRoadmapEventMoveDate(parsed.data.eventDate)) {
      return reply.code(400).send({ error: "핀은 과거 날짜부터 오늘 기준 30일 후까지 추가할 수 있습니다." });
    }
    try {
      const disclosure = await readDisclosure(parsed.data.disclosureId);
      if (!disclosure) return reply.code(404).send({ error: "공시를 찾을 수 없습니다." });
      return reply.code(201).send({
        event: await createRoadmapEvent({
          ...parsed.data,
          kind: deriveRoadmapKind(disclosure.title, disclosure.body),
          category: deriveRoadmapCategory(disclosure.title, disclosure.body)
        })
      });
    } catch (error) {
      const code = prismaCode(error);
      if (code === "P2002") return reply.code(409).send({ error: "같은 공시가 이미 이 날짜에 등록되어 있습니다." });
      if (code === "P2003") return reply.code(404).send({ error: "공시를 찾을 수 없습니다." });
      request.log.error({ code }, "Roadmap event creation failed");
      return reply.code(500).send({ error: "핀을 추가하지 못했습니다." });
    }
  });

  app.patch("/api/admin/roadmap-events/:id", async (request, reply) => {
    if (!admin(request)) return reply.code(403).send({ error: "관리자 권한이 필요합니다." });
    const id = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/).safeParse((request.params as { id?: unknown }).id);
    const body = z.object({
      eventDate: z.string().refine(isValidDateKey).optional(),
      kind: z.enum(ROADMAP_EVENT_KINDS).optional(),
      category: z.enum(ROADMAP_EVENT_CATEGORIES).optional(),
      label: z.string().trim().max(160).optional()
    }).strict().refine((value) => Object.keys(value).length > 0).safeParse(request.body);
    if (!id.success || !body.success) return reply.code(400).send({ error: "입력값을 확인해 주세요." });
    if (body.data.eventDate && !isRoadmapEventMoveDate(body.data.eventDate)) {
      return reply.code(400).send({ error: "핀은 과거 날짜 또는 오늘부터 30일 후까지 이동할 수 있습니다." });
    }
    try {
      return { event: await updateRoadmapEvent(id.data, body.data) };
    } catch (error) {
      const code = prismaCode(error);
      if (code === "P2002") return reply.code(409).send({ error: "같은 공시가 이미 이 날짜에 등록되어 있습니다." });
      if (code === "P2025") return reply.code(404).send({ error: "핀을 찾을 수 없습니다." });
      return reply.code(500).send({ error: "핀을 저장하지 못했습니다." });
    }
  });

  app.delete("/api/admin/roadmap-events/:id", async (request, reply) => {
    if (!admin(request)) return reply.code(403).send({ error: "관리자 권한이 필요합니다." });
    const id = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/).safeParse((request.params as { id?: unknown }).id);
    if (!id.success) return reply.code(400).send({ error: "핀 ID가 올바르지 않습니다." });
    try {
      await deleteRoadmapEvent(id.data);
      return { deleted: true, id: id.data };
    } catch (error) {
      if (prismaCode(error) === "P2025") return reply.code(404).send({ error: "핀을 찾을 수 없습니다." });
      return reply.code(500).send({ error: "핀을 삭제하지 못했습니다." });
    }
  });
}
