import type { Holding, ManualPortfolioStore, PortfolioOverview } from "./types";
import { fetchUsdKrwExchangeRate } from "./exchange-rate";
import { prisma } from "./prisma";

function normalizeStore(store: ManualPortfolioStore): ManualPortfolioStore {
  const exchangeRate = Number(store.exchangeRate) || 1380;
  const holdings = store.holdings.map((holding) => {
    const marketValue = holding.quantity * holding.lastPrice;
    const priceProfitLossRate =
      holding.averagePurchasePrice && holding.averagePurchasePrice > 0
        ? (holding.lastPrice - holding.averagePurchasePrice) / holding.averagePurchasePrice
        : undefined;
    const purchaseExchangeRate =
      holding.currency === "USD"
        ? Number(holding.purchaseExchangeRate) || exchangeRate
        : undefined;
    const costBasisNative =
      holding.averagePurchasePrice && holding.averagePurchasePrice > 0
        ? holding.averagePurchasePrice * holding.quantity
        : undefined;
    const costBasisKrw =
      costBasisNative === undefined
        ? undefined
        : holding.currency === "USD"
          ? costBasisNative * (purchaseExchangeRate ?? exchangeRate)
          : costBasisNative;
    const marketValueKrw = holding.currency === "USD" ? marketValue * exchangeRate : marketValue;
    const profitLossKrw =
      costBasisKrw !== undefined ? marketValueKrw - costBasisKrw : undefined;
    const fxGainLossKrw =
      holding.currency === "USD" && purchaseExchangeRate !== undefined
        ? marketValue * (exchangeRate - purchaseExchangeRate)
        : 0;
    const profitLossRate =
      costBasisKrw && costBasisKrw > 0 ? (marketValueKrw - costBasisKrw) / costBasisKrw : undefined;

    return {
      ...holding,
      purchaseExchangeRate,
      marketValue,
      marketValueKrw,
      costBasisKrw,
      priceProfitLossRate,
      fxGainLossKrw,
      profitLossKrw,
      profitLossRate
    };
  });

  return {
    exchangeRate,
    exchangeRateFetchedAt: store.exchangeRateFetchedAt,
    exchangeRateSource: store.exchangeRateSource,
    updatedAt: store.updatedAt,
    holdings
  };
}

export async function readManualPortfolioStore(): Promise<ManualPortfolioStore> {
  const [exchangeRateSnapshot, holdings] = await Promise.all([
    fetchUsdKrwExchangeRate(),
    prisma.portfolioHolding.findMany({ orderBy: { symbol: "asc" } })
  ]);
  const latestUpdatedAt =
    holdings.reduce<Date | null>(
      (latest, holding) => (!latest || holding.updatedAt > latest ? holding.updatedAt : latest),
      null
    ) ?? new Date();

  return normalizeStore({
    exchangeRate: exchangeRateSnapshot.rate,
    exchangeRateFetchedAt: exchangeRateSnapshot.fetchedAt,
    exchangeRateSource: exchangeRateSnapshot.source,
    updatedAt: latestUpdatedAt.toISOString(),
    holdings: holdings.map((holding) => ({
      symbol: holding.symbol,
      name: holding.name,
      marketCountry: holding.marketCountry as "KR" | "US",
      currency: holding.currency as "KRW" | "USD",
      quantity: holding.quantity,
      lastPrice: holding.lastPrice,
      averagePurchasePrice: holding.averagePurchasePrice ?? undefined,
      purchaseExchangeRate: holding.purchaseExchangeRate ?? undefined,
      marketValue: 0,
      marketValueKrw: 0,
      profitLossRate: holding.profitLossRate ?? undefined
    }))
  });
}

export async function getManualPortfolioOverview(): Promise<PortfolioOverview> {
  const store = await readManualPortfolioStore();
  return {
    source: "manual",
    fetchedAt: store.updatedAt,
    exchangeRate: store.exchangeRate,
    exchangeRateFetchedAt: store.exchangeRateFetchedAt ?? new Date().toISOString(),
    exchangeRateSource: store.exchangeRateSource ?? "fallback",
    totalMarketValueKrw: store.holdings.reduce((sum, holding) => sum + holding.marketValueKrw, 0),
    holdings: store.holdings
  };
}

export async function upsertManualHolding(input: Omit<Holding, "marketValue" | "marketValueKrw">) {
  const symbol = input.symbol.toUpperCase();
  const profitLossRate =
    input.averagePurchasePrice && input.averagePurchasePrice > 0
      ? (input.lastPrice - input.averagePurchasePrice) / input.averagePurchasePrice
      : undefined;
  await prisma.portfolioHolding.upsert({
    where: { symbol },
    create: {
      symbol,
      name: input.name,
      marketCountry: input.marketCountry,
      currency: input.currency,
      quantity: input.quantity,
      lastPrice: input.lastPrice,
      averagePurchasePrice: input.averagePurchasePrice,
      purchaseExchangeRate: input.purchaseExchangeRate,
      profitLossRate
    },
    update: {
      name: input.name,
      marketCountry: input.marketCountry,
      currency: input.currency,
      quantity: input.quantity,
      lastPrice: input.lastPrice,
      averagePurchasePrice: input.averagePurchasePrice,
      purchaseExchangeRate: input.purchaseExchangeRate,
      profitLossRate
    }
  });
}

export async function deleteManualHolding(symbol: string) {
  await prisma.portfolioHolding.deleteMany({
    where: { symbol: symbol.toUpperCase() }
  });
}
