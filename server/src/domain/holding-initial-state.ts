import type { Holding, MarketCode } from "./types.js";

export type HoldingInitialStateInput = Pick<
  Holding,
  | "symbol"
  | "name"
  | "alias"
  | "marketCountry"
  | "currency"
  | "quantity"
  | "lastPrice"
  | "averagePurchasePrice"
  | "purchaseExchangeRate"
  | "riskLevel"
>;

export type HoldingInitialState = {
  symbol: string;
  name: string;
  alias: string | null;
  marketCountry: MarketCode;
  currency: "KRW" | "USD";
  quantity: number;
  lastPrice: number;
  averagePurchasePrice: number | null;
  purchaseExchangeRate: number | null;
  profitLossRate: number | null;
  riskLevel: "LOW" | "HIGH" | null;
};

export function holdingInitialState(input: HoldingInitialStateInput): HoldingInitialState {
  const hasOpeningPosition = input.quantity > 0;
  const averagePurchasePrice =
    hasOpeningPosition && input.averagePurchasePrice && input.averagePurchasePrice > 0
      ? input.averagePurchasePrice
      : null;
  const purchaseExchangeRate =
    hasOpeningPosition &&
    input.currency === "USD" &&
    input.purchaseExchangeRate &&
    input.purchaseExchangeRate > 0
      ? input.purchaseExchangeRate
      : null;
  const profitLossRate = averagePurchasePrice
    ? (input.lastPrice - averagePurchasePrice) / averagePurchasePrice
    : null;

  return {
    symbol: input.symbol.trim().toUpperCase(),
    name: input.name,
    alias: input.alias?.trim() || null,
    marketCountry: input.marketCountry,
    currency: input.currency,
    quantity: input.quantity,
    lastPrice: input.lastPrice,
    averagePurchasePrice,
    purchaseExchangeRate,
    profitLossRate,
    riskLevel: input.riskLevel ?? null
  };
}
