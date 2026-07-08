import type { MarketCandle, MarketChart } from "@/lib/market-data";
import type { Holding, PortfolioDailySnapshot } from "@/lib/types";

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

export function changeRateFromSnapshots(snapshots: PortfolioDailySnapshot[]) {
  const latest = snapshots.at(-1);
  const previous = snapshots.at(-2);
  const previousClose = previous?.closeTotalMarketValueKrw;
  if (!latest || !previous || !previousClose || previousClose <= 0) return undefined;
  return (latest.totalMarketValueKrw - previousClose) / previousClose;
}

function previousCloseFromChart(chart?: MarketChart | null) {
  const previousCandleClose = chart?.candles.at(-2)?.close;
  if (typeof previousCandleClose === "number" && previousCandleClose > 0) {
    return previousCandleClose;
  }

  return typeof chart?.previousClose === "number" && chart.previousClose > 0 ? chart.previousClose : undefined;
}

export function portfolioChangeRateFromMarketValue({
  holdings,
  charts,
  exchangeRate
}: {
  holdings: Holding[];
  charts: Map<string, MarketChart | null>;
  exchangeRate: number;
}) {
  let currentMarketValue = 0;
  let previousMarketValue = 0;
  let coveredHoldingCount = 0;
  let eligibleHoldingCount = 0;

  for (const holding of holdings) {
    if (holding.quantity <= 0 || holding.marketValueKrw <= 0) continue;
    eligibleHoldingCount += 1;

    const previousClose = previousCloseFromChart(charts.get(holding.symbol));
    if (previousClose === undefined) return undefined;

    const multiplier = holding.quantity * (holding.currency === "USD" ? exchangeRate : 1);
    const previousHoldingValue = previousClose * multiplier;
    if (previousHoldingValue <= 0) return undefined;

    currentMarketValue += holding.marketValueKrw;
    previousMarketValue += previousHoldingValue;
    coveredHoldingCount += 1;
  }

  if (eligibleHoldingCount === 0 || coveredHoldingCount !== eligibleHoldingCount) return undefined;

  return previousMarketValue > 0 ? (currentMarketValue - previousMarketValue) / previousMarketValue : undefined;
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

export function pointsFromSnapshots(snapshots: PortfolioDailySnapshot[]) {
  return snapshots.flatMap((snapshot, index) => {
    const value = snapshotEffectiveTotalMarketValueKrw(snapshot, index, snapshots);
    return typeof value === "number" ? [{ date: snapshot.date, value }] : [];
  });
}

export function candlesFromSnapshots(snapshots: PortfolioDailySnapshot[]) {
  return snapshots.flatMap((snapshot, index) => {
    const value = snapshotEffectiveTotalMarketValueKrw(snapshot, index, snapshots);
    if (typeof value !== "number") return [];
    return {
      date: snapshot.date,
      open: value,
      high: value,
      low: value,
      close: value
    };
  });
}

function pointCandle(date: string, value: number) {
  return {
    date,
    open: value,
    high: value,
    low: value,
    close: value
  };
}

export function returnCandlesFromSnapshots(snapshots: PortfolioDailySnapshot[]) {
  return snapshots.flatMap((snapshot, index) => {
    const costBasisKrw = snapshotEffectiveCostBasisKrw(snapshot, index, snapshots);
    if (typeof costBasisKrw !== "number" || costBasisKrw <= 0) return [];
    const totalMarketValueKrw = snapshotEffectiveTotalMarketValueKrw(snapshot, index, snapshots);
    if (typeof totalMarketValueKrw !== "number") return [];
    return [pointCandle(snapshot.date, (totalMarketValueKrw - costBasisKrw) / costBasisKrw)];
  });
}

export function dividendYieldCandlesFromSnapshots(snapshots: PortfolioDailySnapshot[]) {
  return snapshots.flatMap((snapshot, index) => {
    const annualDividendKrw = snapshotEffectiveAnnualDividendKrw(snapshot, index, snapshots);
    const totalMarketValueKrw = snapshotEffectiveTotalMarketValueKrw(snapshot, index, snapshots);
    if (
      typeof annualDividendKrw !== "number" ||
      annualDividendKrw <= 0 ||
      typeof totalMarketValueKrw !== "number" ||
      totalMarketValueKrw <= 0
    ) {
      return [];
    }
    return [pointCandle(snapshot.date, annualDividendKrw / totalMarketValueKrw)];
  });
}

function isLatestSnapshot(index: number, snapshots: PortfolioDailySnapshot[]) {
  return index === snapshots.length - 1;
}

function snapshotEffectiveTotalMarketValueKrw(
  snapshot: PortfolioDailySnapshot,
  index: number,
  snapshots: PortfolioDailySnapshot[]
) {
  if (isLatestSnapshot(index, snapshots)) return snapshot.totalMarketValueKrw;
  return snapshot.closeTotalMarketValueKrw;
}

function snapshotEffectiveCostBasisKrw(
  snapshot: PortfolioDailySnapshot,
  index: number,
  snapshots: PortfolioDailySnapshot[]
) {
  if (isLatestSnapshot(index, snapshots)) return snapshot.costBasisKrw;
  return snapshot.closeCostBasisKrw;
}

function snapshotEffectiveAnnualDividendKrw(
  snapshot: PortfolioDailySnapshot,
  index: number,
  snapshots: PortfolioDailySnapshot[]
) {
  if (isLatestSnapshot(index, snapshots)) return snapshot.annualDividendKrw;
  return snapshot.closeAnnualDividendKrw;
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
  const purchaseExchangeRate = holding.purchaseExchangeRate ?? exchangeRate;
  const costBasis =
    holding.averagePurchasePrice *
    holding.quantity *
    (holding.currency === "USD" ? purchaseExchangeRate : 1);
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
