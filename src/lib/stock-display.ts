import type { MarketCode } from "./types";

type StockIdentity = {
  symbol: string;
  name?: string;
  alias?: string;
  marketCountry?: MarketCode;
  currency?: "KRW" | "USD";
};

function clean(value?: string) {
  return value?.trim() ?? "";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanName(symbol: string, name?: string) {
  const trimmedName = clean(name);
  const trimmedSymbol = clean(symbol);
  if (!trimmedName || !trimmedSymbol) return trimmedName;

  const escapedSymbol = escapeRegExp(trimmedSymbol);
  return trimmedName
    .replace(new RegExp(`^${escapedSymbol}\\s*\\((.*)\\)$`, "i"), "$1")
    .replace(new RegExp(`^${escapedSymbol}\\s*[-:–—]\\s*`, "i"), "")
    .replace(new RegExp(`^${escapedSymbol}\\s+`, "i"), "")
    .replace(new RegExp(`\\s*\\(${escapedSymbol}\\)$`, "i"), "")
    .trim();
}

function cleanSecondaryForAlias(alias: string, secondary?: string) {
  const trimmedSecondary = clean(secondary);
  if (!trimmedSecondary) return trimmedSecondary;

  const escapedAlias = escapeRegExp(alias);
  return trimmedSecondary
    .replace(new RegExp(`^${escapedAlias}\\s*\\((.*)\\)$`, "i"), "$1")
    .replace(new RegExp(`^${escapedAlias}\\s*[-:–—]\\s*`, "i"), "")
    .replace(new RegExp(`^${escapedAlias}\\s+`, "i"), "")
    .trim();
}

export function isKoreanStock(stock: StockIdentity) {
  const symbol = stock.symbol.trim().toUpperCase();
  return (
    stock.currency === "KRW" ||
    stock.marketCountry === "KOSPI" ||
    stock.marketCountry === "KOSDAQ" ||
    /^\d{6}(\.KQ)?$/.test(symbol)
  );
}

export function stockPrimaryLabel(stock: StockIdentity) {
  const alias = clean(stock.alias);
  if (alias) return alias;

  const name = cleanName(stock.symbol, stock.name);
  if (isKoreanStock(stock) && name) return name;
  return stock.symbol;
}

export function stockSecondaryLabel(stock: StockIdentity) {
  const alias = clean(stock.alias);
  if (alias) {
    const primaryWithoutAlias = stockPrimaryLabel({ ...stock, alias: undefined });
    const secondary = cleanSecondaryForAlias(alias, primaryWithoutAlias);
    return secondary && secondary !== alias ? secondary : undefined;
  }

  const secondary = isKoreanStock(stock) ? stock.symbol : cleanName(stock.symbol, stock.name);
  return secondary && secondary !== stockPrimaryLabel(stock) ? secondary : undefined;
}

export function stockFullLabel(stock: StockIdentity) {
  const secondary = stockSecondaryLabel(stock);
  return secondary ? `${stockPrimaryLabel(stock)} (${secondary})` : stockPrimaryLabel(stock);
}
