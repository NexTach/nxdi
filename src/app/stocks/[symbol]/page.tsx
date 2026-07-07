import { notFound, redirect } from "next/navigation";
import { CandleChart } from "@/app/components/stock-chart";
import {
  AppShell,
  ButtonLink,
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
import { formatKrw, formatNumber } from "@/lib/format";
import { fetchMarketCandles } from "@/lib/market-data";
import { getManualPortfolioOverview } from "@/lib/portfolio-store";
import { getUserSession } from "@/lib/session";
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
  if (holding.currency === "USD") return `$${formatNumber(holding.lastPrice, 2)}`;
  return formatKrw(holding.lastPrice);
}

function formatDividendAmount(record?: DividendRecord) {
  if (!record) return "-";
  if (record.currency === "USD") return `$${formatNumber(record.annualDividendPerShare, 4)}`;
  return formatKrw(record.annualDividendPerShare);
}

export default async function StockDetailPage({ params }: StockDetailProps) {
  const user = await getUserSession();
  if (!user) redirect("/login");

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
    : 0;
  const returnCandles = buildHoldingReturnCandles(monthlyChart?.candles ?? [], holding, portfolio.exchangeRate);
  const yieldCandles = holdingDividendYieldCandles(
    monthlyChart?.candles ?? [],
    annualDividendKrw,
    holding,
    portfolio.exchangeRate
  );

  return (
    <AppShell>
      <Navigation
        title="T-ETF"
        description={`${user.name} · 종목 상세`}
        actions={
          <ButtonLink href="/" variant="secondary">
            포트폴리오
          </ButtonLink>
        }
      />

      <Top title={holding.symbol} description={holding.name} />

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
          value={<RatePill value={dividendRecord?.trailingYield} />}
        />
      </Grid>

      <SectionHeader id="price-chart" title="가격 차트" description="최근 1년 실제 주봉 OHLC 데이터 기준입니다." />

      <CandleChart
        candles={weeklyChart?.candles ?? []}
        label={`${holding.symbol} 최근 1년 주봉 캔들 차트`}
        size="detail"
        valueFormat={holding.currency === "USD" ? "usd" : "krw"}
      />

      <SectionHeader title="수익률 차트" description="최근 5년 월봉 기준으로 보유 원가와 배당 추세를 계산합니다." />

      <Grid columns={2}>
        <Panel className="metric-detail-panel">
          <h2 id="holding-return-chart">보유 수익률 추세</h2>
          <p className="lede">5년 월봉 현재가와 평균 매수가 기준</p>
          <CandleChart
            label={`${holding.symbol} 보유 수익률 월봉 캔들`}
            candles={returnCandles}
            size="detail"
            valueFormat="percent"
          />
        </Panel>
        <Panel className="metric-detail-panel">
          <h2 id="dividend-yield-chart">배당수익률 추세</h2>
          <p className="lede">5년 월봉 평가금액과 연 예상 배당 기준</p>
          <CandleChart
            label={`${holding.symbol} 배당수익률 월봉 캔들`}
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
        <ListRow title="시장" value={holding.marketCountry === "US" ? "미국" : "국내"} />
        <ListRow title="통화" value={holding.currency} />
        <ListRow title="보유 수량" value={`${formatNumber(holding.quantity, 4)}주`} />
        <ListRow title="현재가" value={formatPrice(holding)} />
        <ListRow title="보유 수익률" value={<RatePill value={holding.profitLossRate} />} />
        <ListRow
          title="평균 매수가"
          value={
            holding.averagePurchasePrice
              ? holding.currency === "USD"
                ? `$${formatNumber(holding.averagePurchasePrice, 2)}`
                : formatKrw(holding.averagePurchasePrice)
              : "-"
          }
        />
      </List>

      <SectionHeader title="배당 정보" description="현재 등록된 배당 데이터 기준입니다." />

      <List>
        <ListRow title="연 배당/주" value={formatDividendAmount(dividendRecord)} />
        <ListRow title="배당수익률" value={formatPercent(dividendRecord?.trailingYield)} />
        <ListRow title="보유 기준 연 예상 배당" value={formatKrw(annualDividendKrw)} />
        <ListRow title="보유 기준 월평균 배당" value={formatKrw(annualDividendKrw / 12)} />
        <ListRow title="예상 지급월" value={dividendRecord?.expectedPaymentMonths.join(", ") ?? "-"} />
      </List>
    </AppShell>
  );
}
