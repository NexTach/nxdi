import type { Holding } from "./types";

export type HoldingSearchItem = Pick<Holding, "alias" | "name" | "symbol">;

function normalize(value: string) {
  return value.normalize("NFKC").trim().toLocaleUpperCase("en-US");
}

function matchScore(holding: HoldingSearchItem, normalizedQuery: string) {
  const values = [holding.symbol, holding.name, holding.alias ?? ""]
    .map(normalize)
    .filter(Boolean);

  if (values.some((value) => value === normalizedQuery)) return 0;
  if (values.some((value) => value.startsWith(normalizedQuery))) return 1;
  if (values.some((value) => value.includes(normalizedQuery))) return 2;
  return Number.POSITIVE_INFINITY;
}

export function searchPortfolioHoldings<T extends HoldingSearchItem>(
  holdings: readonly T[],
  query: string,
  limit = 8
) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return holdings.slice(0, limit);

  return holdings
    .map((holding, index) => ({ holding, index, score: matchScore(holding, normalizedQuery) }))
    .filter((item) => Number.isFinite(item.score))
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .slice(0, limit)
    .map((item) => item.holding);
}

export function exactPortfolioHolding<T extends HoldingSearchItem>(holdings: readonly T[], value: string) {
  const normalizedValue = normalize(value);
  if (!normalizedValue) return undefined;
  return holdings.find((holding) => normalize(holding.symbol) === normalizedValue);
}
