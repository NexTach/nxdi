import type { AppStore, Holding, InvestmentIntent, PortfolioOverview } from "@/lib/types";

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
