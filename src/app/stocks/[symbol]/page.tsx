import { notFound } from "next/navigation";
import { AuthNavActions } from "@/app/components/auth-actions";
import { CandleChart } from "@/app/components/stock-chart";
import {
  AppShell,
  Grid,
  List,
  ListRow,
  Metric,
  Navigation,
  Panel,
  SectionHeader,
  TextLink,
  Top
} from "@/app/components/tds";
import {
  changeRateFromCandles,
  holdingDividendYieldCandles,
  holdingReturnCandles as buildHoldingReturnCandles
} from "@/lib/chart-metrics";
import { getDividendRecord } from "@/lib/dividends";
import { formatCurrency, formatKrw, formatNumber } from "@/lib/format";
import { fetchMarketCandles } from "@/lib/market-data";
import { getManualPortfolioOverview } from "@/lib/portfolio-store";
import { getUserSession } from "@/lib/session";
import { stockFullLabel, stockPrimaryLabel, stockSecondaryLabel } from "@/lib/stock-display";
import type { DividendRecord, Holding } from "@/lib/types";

type StockDetailProps = {
  params: Promise<{
    symbol: string;
  }>;
};

function formatPercent(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${formatNumber(value * 100, 2)}%`;
}

function rateTone(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value === 0) return "flat";
  return value > 0 ? "up" : "down";
}

function RatePill({ value }: { value?: number }) {
  return <span className={`rate-pill ${rateTone(value)}`}>{formatPercent(value)}</span>;
}

function formatPrice(holding: Holding) {
  return formatCurrency(holding.lastPrice, holding.currency, 2);
}

function formatDividendAmount(record?: DividendRecord) {
  if (!record) return "-";
  return formatCurrency(record.annualDividendPerShare, record.currency, 4);
}

function formatOptionalKrw(value?: number) {
  return typeof value === "number" && Number.isFinite(value) ? formatKrw(value) : "-";
}

function formatPaymentMonths(months?: number[]) {
  if (!months || months.length === 0) return "-";
  return months.map((month) => `${month}월`).join(", ");
}

function formatMarket(holding: Holding) {
  if (holding.marketCountry === "NYSE") return "뉴욕증권거래소(NYSE)";
  if (holding.marketCountry === "AMEX") return "아메리칸증권거래소(AMEX)";
  if (holding.marketCountry === "KOSDAQ") return "코스닥시장(KOSDAQ)";
  if (holding.marketCountry === "KOSPI") return "유가증권시장(KOSPI)";
  return "나스닥(NASDAQ)";
}

export default async function StockDetailPage({ params }: StockDetailProps) {
  const user = await getUserSession();

  const { symbol: symbolParam } = await params;
  const symbol = decodeURIComponent(symbolParam).toUpperCase();
  const portfolio = await getManualPortfolioOverview();
  const holding = portfolio.holdings.find((item) => item.symbol.toUpperCase() === symbol);
  if (!holding) notFound();

  const [dividendRecord, dailyChart, weeklyChart, monthlyChart] = await Promise.all([
    getDividendRecord(holding.symbol),
    fetchMarketCandles(holding.symbol, {
      range: "1mo",
      interval: "1d",
      limit: 2
    }).catch(() => null),
    fetchMarketCandles(holding.symbol, {
      range: "1y",
      interval: "1wk",
      limit: 52
    }).catch(() => null),
    fetchMarketCandles(holding.symbol, {
      range: "5y",
      interval: "1mo",
      limit: 60
    }).catch(() => null)
  ]);
  const annualDividendKrw = dividendRecord
    ? holding.quantity *
      (dividendRecord.currency === "USD"
        ? dividendRecord.annualDividendPerShare * portfolio.exchangeRate
        : dividendRecord.annualDividendPerShare)
    : undefined;
  const holdingDividendYield =
    typeof annualDividendKrw === "number" && holding.marketValueKrw > 0
      ? annualDividendKrw / holding.marketValueKrw
      : undefined;
  const returnCandles = buildHoldingReturnCandles(monthlyChart?.candles ?? [], holding, portfolio.exchangeRate);
  const yieldCandles = holdingDividendYieldCandles(
    monthlyChart?.candles ?? [],
    annualDividendKrw ?? 0,
    holding,
    portfolio.exchangeRate
  );
  const primaryLabel = stockPrimaryLabel(holding);
  const secondaryLabel = stockSecondaryLabel(holding);
  const fullLabel = stockFullLabel(holding);

  return (
    <AppShell>
      <Navigation
        title="TDIV"
        description={user ? `${user.name} · 종목 상세` : "종목 상세"}
        actions={<AuthNavActions user={user} />}
      />

      <Top title={primaryLabel} description={secondaryLabel} backLink={{ href: "/" }} />

      <Grid columns={4} className="mt-16">
        <Metric label="평가금액" value={formatKrw(holding.marketValueKrw)} />
        <Metric
          label={<TextLink className="metric-card-link" href="#price-chart">전일 등락률</TextLink>}
          value={<RatePill value={changeRateFromCandles(dailyChart?.candles ?? [])} />}
        />
        <Metric
          label={<TextLink className="metric-card-link" href="#holding-return-chart">보유 수익률</TextLink>}
          value={<RatePill value={holding.profitLossRate} />}
        />
        <Metric
          label={<TextLink className="metric-card-link" href="#dividend-yield-chart">배당수익률</TextLink>}
          value={<RatePill value={holdingDividendYield} />}
        />
      </Grid>

      <SectionHeader id="price-chart" title="가격 차트" description="최근 1년 실제 주봉 OHLC 데이터 기준입니다." />

      <CandleChart
        candles={weeklyChart?.candles ?? []}
        label={`${fullLabel} 최근 1년 주봉 캔들 차트`}
        size="detail"
        valueFormat={holding.currency === "USD" ? "usd" : "krw"}
      />

      <SectionHeader title="수익률 차트" description="최근 5년 월봉 기준으로 보유 원가와 배당 추세를 계산합니다." />

      <Grid columns={2}>
        <Panel className="metric-detail-panel">
          <h2 id="holding-return-chart">보유 수익률 추세</h2>
          <p className="lede">5년 월봉 현재가와 매입환율 반영 원가 기준</p>
          <CandleChart
            label={`${fullLabel} 보유 수익률 월봉 캔들`}
            candles={returnCandles}
            size="detail"
            valueFormat="percent"
          />
        </Panel>
        <Panel className="metric-detail-panel">
          <h2 id="dividend-yield-chart">배당수익률 추세</h2>
          <p className="lede">5년 월봉 평가금액과 연 예상 배당 기준</p>
          <CandleChart
            label={`${fullLabel} 배당수익률 월봉 캔들`}
            candles={yieldCandles}
            size="detail"
            valueFormat="percent"
          />
        </Panel>
      </Grid>

      <SectionHeader title="종목 정보" description="관리자가 입력한 포트폴리오 기준 정보입니다." />

      <List>
        <ListRow title="종목 코드" value={holding.symbol} />
        <ListRow title="종목명" value={holding.name} />
        <ListRow title="시장" value={formatMarket(holding)} />
        <ListRow title="통화" value={holding.currency} />
        <ListRow title="보유 수량" value={`${formatNumber(holding.quantity, 4)}주`} />
        <ListRow title="현재가" value={formatPrice(holding)} />
        <ListRow title="원화 보유 수익률" value={<RatePill value={holding.profitLossRate} />} />
        <ListRow title="가격 수익률" value={<RatePill value={holding.priceProfitLossRate} />} />
        <ListRow title="원화 손익" value={holding.profitLossKrw !== undefined ? formatKrw(holding.profitLossKrw) : "-"} />
        {holding.currency === "USD" ? (
          <>
            <ListRow
              title="매입환율"
              value={holding.purchaseExchangeRate ? `${formatNumber(holding.purchaseExchangeRate, 2)}원` : "-"}
            />
            <ListRow
              title="환차손익"
              value={holding.fxGainLossKrw !== undefined ? formatKrw(holding.fxGainLossKrw) : "-"}
            />
          </>
        ) : null}
        <ListRow
          title="평균 매수가"
          value={
            holding.averagePurchasePrice
              ? formatCurrency(holding.averagePurchasePrice, holding.currency, 2)
              : "-"
          }
        />
      </List>

      <SectionHeader title="배당 정보" description="현재 등록된 배당 데이터 기준입니다." />

      <List>
        <ListRow title="연 배당/주" value={formatDividendAmount(dividendRecord)} />
        <ListRow title="보유 기준 배당수익률" value={formatPercent(holdingDividendYield)} />
        <ListRow title="시장 배당수익률" value={formatPercent(dividendRecord?.trailingYield)} />
        <ListRow title="보유 기준 연 예상 배당" value={formatOptionalKrw(annualDividendKrw)} />
        <ListRow
          title="보유 기준 월평균 배당"
          value={formatOptionalKrw(typeof annualDividendKrw === "number" ? annualDividendKrw / 12 : undefined)}
        />
        <ListRow title="예상 지급월" value={formatPaymentMonths(dividendRecord?.expectedPaymentMonths)} />
      </List>
    </AppShell>
  );
}
