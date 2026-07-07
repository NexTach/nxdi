import type { DividendForecast, DividendForecastLine, DividendRecord, PortfolioOverview } from "./types";
import { fetchDividendRecordFromMarket } from "./market-data";
import { prisma } from "./prisma";

const DEFAULT_DIVIDENDS: DividendRecord[] = [
  {
    symbol: "SCHD",
    currency: "USD",
    annualDividendPerShare: 1.02,
    trailingYield: 0.036,
    expectedPaymentMonths: [3, 6, 9, 12],
    lastDividendPerShare: 0.25,
    memo: "분기 배당 ETF. 실제 배당은 분배금 공시 후 확정됩니다."
  },
  {
    symbol: "VOO",
    currency: "USD",
    annualDividendPerShare: 7.1,
    trailingYield: 0.014,
    expectedPaymentMonths: [3, 7, 10, 12],
    lastDividendPerShare: 1.78
  },
  {
    symbol: "JEPI",
    currency: "USD",
    annualDividendPerShare: 4.2,
    trailingYield: 0.074,
    expectedPaymentMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    lastDividendPerShare: 0.35
  },
  {
    symbol: "005930",
    currency: "KRW",
    annualDividendPerShare: 1444,
    trailingYield: 0.02,
    expectedPaymentMonths: [4, 5, 8, 11],
    lastDividendPerShare: 361,
    memo: "국내 배당은 기준일, 주주총회, 지급일 확정 공시에 따라 달라집니다."
  }
];

const DIVIDEND_RECORD_STALE_MS = 7 * 24 * 60 * 60 * 1000;

function getNextPaymentMonth(months: number[]) {
  const currentMonth = new Date().getMonth() + 1;
  return months.find((month) => month >= currentMonth) ?? months[0];
}

function dividendPerShareKrw(record: DividendRecord, exchangeRate: number) {
  return record.currency === "USD"
    ? record.annualDividendPerShare * exchangeRate
    : record.annualDividendPerShare;
}

function lastDividendPerShareKrw(record: DividendRecord, exchangeRate: number) {
  if (typeof record.lastDividendPerShare !== "number") return undefined;
  return record.currency === "USD"
    ? record.lastDividendPerShare * exchangeRate
    : record.lastDividendPerShare;
}

function parsePaymentMonths(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((month) => Number(month)).filter((month) => month >= 1 && month <= 12);
    }
  } catch {
    return value
      .split(",")
      .map((month) => Number(month.trim()))
      .filter((month) => month >= 1 && month <= 12);
  }
  return value
    .split(",")
    .map((month) => Number(month.trim()))
    .filter((month) => month >= 1 && month <= 12);
}

function serializePaymentMonths(months: number[]) {
  return JSON.stringify([...new Set(months)].sort((a, b) => a - b));
}

async function ensureDividendSeed() {
  const count = await prisma.dividendRecord.count();
  if (count > 0) return;

  await prisma.dividendRecord.createMany({
    data: DEFAULT_DIVIDENDS.map((record) => ({
      symbol: record.symbol,
      currency: record.currency,
      annualDividendPerShare: record.annualDividendPerShare,
      trailingYield: record.trailingYield,
      expectedPaymentMonths: serializePaymentMonths(record.expectedPaymentMonths),
      lastDividendPerShare: record.lastDividendPerShare,
      memo: record.memo
    }))
  });
}

function mapDividendRecord(row: {
  symbol: string;
  currency: string;
  annualDividendPerShare: number;
  trailingYield: number | null;
  expectedPaymentMonths: string;
  lastDividendPerShare: number | null;
  memo: string | null;
}): DividendRecord {
  return {
    symbol: row.symbol,
    currency: row.currency as "KRW" | "USD",
    annualDividendPerShare: row.annualDividendPerShare,
    trailingYield: row.trailingYield ?? undefined,
    expectedPaymentMonths: parsePaymentMonths(row.expectedPaymentMonths),
    lastDividendPerShare: row.lastDividendPerShare ?? undefined,
    memo: row.memo ?? undefined
  };
}

async function refreshStaleDividendRecords() {
  const staleSince = new Date(Date.now() - DIVIDEND_RECORD_STALE_MS);
  const staleRows = await prisma.dividendRecord.findMany({
    where: { updatedAt: { lt: staleSince } },
    select: { symbol: true }
  });

  if (staleRows.length === 0) return;

  await Promise.allSettled(
    staleRows.map(async ({ symbol }) => {
      const record = await fetchDividendRecordFromMarket(symbol);
      if (record) {
        await upsertDividendRecord(record);
      }
    })
  );
}

export async function readDividendRecords(): Promise<DividendRecord[]> {
  await ensureDividendSeed();
  await refreshStaleDividendRecords();
  const rows = await prisma.dividendRecord.findMany({ orderBy: { symbol: "asc" } });
  return rows.map(mapDividendRecord);
}

export async function upsertDividendRecord(record: DividendRecord) {
  const symbol = record.symbol.toUpperCase();
  await prisma.dividendRecord.upsert({
    where: { symbol },
    create: {
      symbol,
      currency: record.currency,
      annualDividendPerShare: record.annualDividendPerShare,
      trailingYield: record.trailingYield,
      expectedPaymentMonths: serializePaymentMonths(record.expectedPaymentMonths),
      lastDividendPerShare: record.lastDividendPerShare,
      memo: record.memo
    },
    update: {
      currency: record.currency,
      annualDividendPerShare: record.annualDividendPerShare,
      trailingYield: record.trailingYield,
      expectedPaymentMonths: serializePaymentMonths(record.expectedPaymentMonths),
      lastDividendPerShare: record.lastDividendPerShare,
      memo: record.memo
    }
  });
}

export async function deleteDividendRecord(symbol: string) {
  await prisma.dividendRecord.deleteMany({
    where: { symbol: symbol.toUpperCase() }
  });
}

export async function getDividendRecord(symbol: string) {
  const records = await readDividendRecords();
  return records.find((record) => record.symbol.toUpperCase() === symbol.toUpperCase());
}

export async function forecastDividend(
  portfolio: PortfolioOverview,
  amountKrw: number
): Promise<DividendForecast> {
  const dividendRecords = await readDividendRecords();
  const recordsBySymbol = new Map(
    dividendRecords.map((record) => [record.symbol.toUpperCase(), record])
  );
  const total = portfolio.totalMarketValueKrw || 1;
  const lines: DividendForecastLine[] = portfolio.holdings.map((holding) => {
    const allocationKrw = amountKrw * (holding.marketValueKrw / total);
    const record = recordsBySymbol.get(holding.symbol.toUpperCase());
    const priceKrw =
      holding.currency === "USD"
        ? holding.lastPrice * portfolio.exchangeRate
        : holding.lastPrice;

    const estimatedQuantity = priceKrw > 0 ? allocationKrw / priceKrw : 0;
    const annualDividendKrw = record
      ? estimatedQuantity * dividendPerShareKrw(record, portfolio.exchangeRate)
      : 0;
    const lastDividendKrw = record
      ? lastDividendPerShareKrw(record, portfolio.exchangeRate)
      : undefined;

    return {
      symbol: holding.symbol,
      name: holding.name,
      marketCountry: holding.marketCountry,
      currency: holding.currency,
      allocationKrw,
      estimatedQuantity,
      annualDividendKrw,
      lastDividendKrw:
        typeof lastDividendKrw === "number" ? estimatedQuantity * lastDividendKrw : undefined,
      monthlyAverageKrw: annualDividendKrw / 12,
      expectedPaymentMonths: record?.expectedPaymentMonths ?? [],
      nextPaymentMonth: record ? getNextPaymentMonth(record.expectedPaymentMonths) : undefined
    };
  });

  const annualDividendKrw = lines.reduce((sum, line) => sum + line.annualDividendKrw, 0);
  return {
    amountKrw,
    annualDividendKrw,
    monthlyAverageKrw: annualDividendKrw / 12,
    lines
  };
}

export async function summarizePortfolioDividend(portfolio: PortfolioOverview) {
  const dividendRecords = await readDividendRecords();
  const recordsBySymbol = new Map(
    dividendRecords.map((record) => [record.symbol.toUpperCase(), record])
  );

  const annualDividendKrw = portfolio.holdings.reduce((sum, holding) => {
    const record = recordsBySymbol.get(holding.symbol.toUpperCase());
    if (!record) return sum;
    return sum + holding.quantity * dividendPerShareKrw(record, portfolio.exchangeRate);
  }, 0);

  const costBasisKrw = portfolio.holdings.reduce((sum, holding) => {
    if (holding.costBasisKrw !== undefined) return sum + holding.costBasisKrw;
    if (!holding.averagePurchasePrice || holding.averagePurchasePrice <= 0) return sum;
    const purchaseExchangeRate = holding.purchaseExchangeRate ?? portfolio.exchangeRate;
    const cost = holding.averagePurchasePrice * holding.quantity;
    return sum + (holding.currency === "USD" ? cost * purchaseExchangeRate : cost);
  }, 0);

  return {
    annualDividendKrw,
    monthlyAverageKrw: annualDividendKrw / 12,
    dividendYield:
      portfolio.totalMarketValueKrw > 0 ? annualDividendKrw / portfolio.totalMarketValueKrw : 0,
    costBasisKrw,
    totalReturnRate:
      costBasisKrw > 0 ? (portfolio.totalMarketValueKrw - costBasisKrw) / costBasisKrw : undefined
  };
}

export async function knownDividendRecords() {
  return readDividendRecords();
}
