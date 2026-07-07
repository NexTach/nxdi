import type { MarketCandle, MarketChart } from "@/lib/market-data";
import type { Holding } from "@/lib/types";

export type ChartPoint = {
  date: string;
  value: number;
};

export function changeRateFromCandles(candles: MarketCandle[]) {
  const latest = candles.at(-1);
  const previous = candles.at(-2);
  if (!latest || !previous || previous.close <= 0) return undefined;
  return (latest.close - previous.close) / previous.close;
}

export function samplePoints(points: ChartPoint[], maxPoints = 72) {
  if (points.length <= maxPoints) return points;
  const step = points.length / maxPoints;
  return Array.from({ length: maxPoints }, (_, index) => points[Math.floor(index * step)]).filter(Boolean);
}

export function pointsFromCandles(candles: MarketCandle[]) {
  return candles.map((candle) => ({
    date: candle.date,
    value: candle.close
  }));
}

export function aggregatePortfolioCandles({
  holdings,
  charts,
  exchangeRate,
  bucket = "day"
}: {
  holdings: Holding[];
  charts: Map<string, MarketChart | null>;
  exchangeRate: number;
  bucket?: "day" | "week" | "month";
}) {
  const buckets = new Map<string, MarketCandle>();

  for (const holding of holdings) {
    const chart = charts.get(holding.symbol);
    if (!chart) continue;
    const multiplier = holding.quantity * (holding.currency === "USD" ? exchangeRate : 1);

    for (const candle of chart.candles) {
      const key = candleBucketKey(candle.date, bucket);
      const current = buckets.get(key) ?? {
        date: candle.date,
        open: 0,
        high: 0,
        low: 0,
        close: 0
      };

      buckets.set(key, {
        date: candle.date,
        open: current.open + candle.open * multiplier,
        high: current.high + candle.high * multiplier,
        low: current.low + candle.low * multiplier,
        close: current.close + candle.close * multiplier
      });
    }
  }

  return [...buckets.values()].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function candleBucketKey(dateValue: string, bucket: "day" | "week" | "month") {
  if (bucket === "day") return dateValue.slice(0, 10);
  const date = new Date(dateValue);
  if (bucket === "month") {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function returnPoints(candles: MarketCandle[], costBasisKrw: number) {
  return pointsFromCandles(returnCandles(candles, costBasisKrw));
}

export function dividendYieldPoints(candles: MarketCandle[], annualDividendKrw: number) {
  return pointsFromCandles(dividendYieldCandles(candles, annualDividendKrw));
}

export function returnCandles(candles: MarketCandle[], costBasisKrw: number) {
  if (costBasisKrw <= 0) return [];
  return candles.map((candle) => ({
    date: candle.date,
    open: (candle.open - costBasisKrw) / costBasisKrw,
    high: (candle.high - costBasisKrw) / costBasisKrw,
    low: (candle.low - costBasisKrw) / costBasisKrw,
    close: (candle.close - costBasisKrw) / costBasisKrw
  }));
}

export function dividendYieldCandles(candles: MarketCandle[], annualDividendKrw: number) {
  if (annualDividendKrw <= 0) return [];
  return candles
    .filter((candle) => candle.low > 0 && candle.high > 0 && candle.open > 0 && candle.close > 0)
    .map((candle) => ({
      date: candle.date,
      open: annualDividendKrw / candle.open,
      high: annualDividendKrw / candle.low,
      low: annualDividendKrw / candle.high,
      close: annualDividendKrw / candle.close
    }));
}

function holdingMarketValue(price: number, holding: Holding, exchangeRate: number) {
  return price * holding.quantity * (holding.currency === "USD" ? exchangeRate : 1);
}

export function holdingReturnCandles(candles: MarketCandle[], holding: Holding, exchangeRate: number) {
  if (!holding.averagePurchasePrice || holding.averagePurchasePrice <= 0) return [];
  const costBasis = holding.averagePurchasePrice * holding.quantity * (holding.currency === "USD" ? exchangeRate : 1);
  if (costBasis <= 0) return [];

  return candles.map((candle) => ({
    date: candle.date,
    open: (holdingMarketValue(candle.open, holding, exchangeRate) - costBasis) / costBasis,
    high: (holdingMarketValue(candle.high, holding, exchangeRate) - costBasis) / costBasis,
    low: (holdingMarketValue(candle.low, holding, exchangeRate) - costBasis) / costBasis,
    close: (holdingMarketValue(candle.close, holding, exchangeRate) - costBasis) / costBasis
  }));
}

export function holdingDividendYieldCandles(
  candles: MarketCandle[],
  annualDividendKrw: number,
  holding: Holding,
  exchangeRate: number
) {
  if (annualDividendKrw <= 0) return [];
  return candles
    .filter((candle) => candle.low > 0 && candle.high > 0 && candle.open > 0 && candle.close > 0)
    .map((candle) => ({
      date: candle.date,
      open: annualDividendKrw / holdingMarketValue(candle.open, holding, exchangeRate),
      high: annualDividendKrw / holdingMarketValue(candle.low, holding, exchangeRate),
      low: annualDividendKrw / holdingMarketValue(candle.high, holding, exchangeRate),
      close: annualDividendKrw / holdingMarketValue(candle.close, holding, exchangeRate)
    }));
}
