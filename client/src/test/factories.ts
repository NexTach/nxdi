import type { AppStore, Holding, InvestmentIntent, PortfolioOverview, WithdrawalIntent } from "@/lib/types";

export function makeHolding(overrides: Partial<Holding> = {}): Holding {
  return {
    symbol: "TEST",
    name: "Test",
    marketCountry: "KOSPI",
    currency: "KRW",
    quantity: 10,
    lastPrice: 10000,
    averagePurchasePrice: 9000,
    marketValue: 100000,
    marketValueKrw: 100000,
    ...overrides
  };
}

export function makePortfolio(overrides: Partial<PortfolioOverview> = {}): PortfolioOverview {
  const holdings = overrides.holdings ?? [];
  const totalMarketValueKrw =
    overrides.totalMarketValueKrw ?? holdings.reduce((sum, holding) => sum + holding.marketValueKrw, 0);

  return {
    source: "manual",
    fetchedAt: "2026-07-09T00:00:00.000Z",
    exchangeRate: 1300,
    exchangeRateFetchedAt: "2026-07-09T00:00:00.000Z",
    exchangeRateSource: "test",
    securitiesMarketValueKrw: 0,
    cashBalanceKrw: 0,
    dailySnapshots: [],
    ...overrides,
    totalMarketValueKrw,
    holdings
  };
}

export function makeInvestmentIntent(overrides: Partial<InvestmentIntent> = {}): InvestmentIntent {
  return {
    id: "intent-1",
    type: "INVESTMENT",
    userId: "user-1",
    userName: "User",
    userEmail: "user@example.com",
    amountKrw: 100000,
    depositorName: "User",
    contact: "010-0000-0000",
    guardianConfirmed: true,
    dividendPolicyAgreed: true,
    productDocumentVersion: "2026-07-15",
    productDocumentHash: "ce5d0e90c24e5b11ad96efdb7a53e34c996a20bd2cc5ca1892e39f404b1e854b",
    dividendPolicyVersion: "2026-07-15",
    dividendPolicyHash: "7cf52148d0bcb73af4b01967c8b6a64148086beb969372776cf7959417fc051e",
    agreedAt: "2026-07-09T00:00:00.000Z",
    status: "PENDING",
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-09T00:00:00.000Z",
    ...overrides
  };
}

export function makeWithdrawalIntent(overrides: Partial<WithdrawalIntent> = {}): WithdrawalIntent {
  return {
    id: "withdrawal-1",
    type: "WITHDRAWAL",
    userId: "user-1",
    userName: "User",
    userEmail: "user@example.com",
    amountKrw: 50000,
    bankName: "Test Bank",
    accountNumber: "1234567890",
    accountHolder: "User",
    contact: "010-0000-0000",
    productDocumentVersion: "2026-07-15",
    productDocumentHash: "ce5d0e90c24e5b11ad96efdb7a53e34c996a20bd2cc5ca1892e39f404b1e854b",
    agreedAt: "2026-07-09T00:00:00.000Z",
    status: "PENDING",
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-09T00:00:00.000Z",
    ...overrides
  };
}

export function makeStore(overrides: Partial<AppStore> = {}): AppStore {
  return {
    investmentIntents: [],
    withdrawalIntents: [],
    ...overrides
  };
}
