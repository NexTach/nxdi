import { notFound, redirect } from "next/navigation";
import { CandleChart } from "@/app/components/stock-chart";
import {
  AppShell,
  Grid,
  List,
  ListRow,
  Metric,
  Navigation,
  SectionHeader,
  Top
} from "@/app/components/tds";
import {
  aggregatePortfolioCandles,
  changeRateFromCandles,
  dividendYieldCandles,
  returnCandles
} from "@/lib/chart-metrics";
import { summarizePortfolioDividend } from "@/lib/dividends";
import { formatKrw, formatNumber } from "@/lib/format";
import { fetchMarketCandles } from "@/lib/market-data";
import { getManualPortfolioOverview } from "@/lib/portfolio-store";
import { getUserSession } from "@/lib/session";

type MetricDetailProps = {
  params: Promise<{
    metric: string;
  }>;
};

const METRIC_LABELS = {
  "daily-change": {
    title: "오늘 등락률",
    description: "최근 1년 주봉 OHLC 기준으로 포트폴리오 평가금액 흐름을 보여줍니다."
  },
  "holding-return": {
    title: "보유 수익률",
    description: "최근 5년 월봉 평가금액을 매입환율이 반영된 원화 매입원금 대비 수익률 캔들로 변환합니다."
  },
  "dividend-yield": {
    title: "배당수익률",
    description: "최근 5년 월봉 평가금액과 연 예상 배당금으로 배당수익률 캔들을 계산합니다."
  }
} as const;

type MetricSlug = keyof typeof METRIC_LABELS;

function isMetricSlug(value: string): value is MetricSlug {
  return value in METRIC_LABELS;
}

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

export default async function MetricDetailPage({ params }: MetricDetailProps) {
  const user = await getUserSession();
  if (!user) redirect("/login");

  const { metric } = await params;
  if (!isMetricSlug(metric)) notFound();

  const portfolio = await getManualPortfolioOverview();
  const portfolioDividend = await summarizePortfolioDividend(portfolio);
  const range = metric === "daily-change" ? "1y" : "5y";
  const interval = metric === "daily-change" ? "1wk" : "1mo";
  const limit = metric === "daily-change" ? 52 : 60;
  const [chartEntries, dailyChangeEntries] = await Promise.all([
    Promise.all(
      portfolio.holdings.map(async (holding) => [
        holding.symbol,
        await fetchMarketCandles(holding.symbol, { range, interval, limit }).catch(() => null)
      ] as const)
    ),
    metric === "daily-change"
      ? Promise.all(
          portfolio.holdings.map(async (holding) => [
            holding.symbol,
            await fetchMarketCandles(holding.symbol, { range: "1mo", interval: "1d", limit: 2 }).catch(() => null)
          ] as const)
        )
      : Promise.resolve([])
  ]);
  const charts = new Map(chartEntries);
  const dailyChangeCharts = new Map(dailyChangeEntries);
  const portfolioCandles = aggregatePortfolioCandles({
    holdings: portfolio.holdings,
    charts,
    exchangeRate: portfolio.exchangeRate,
    bucket: metric === "daily-change" ? "week" : "month"
  });
  const portfolioDailyChangeCandles = aggregatePortfolioCandles({
    holdings: portfolio.holdings,
    charts: dailyChangeCharts,
    exchangeRate: portfolio.exchangeRate
  });
  const candles =
    metric === "holding-return"
      ? returnCandles(portfolioCandles, portfolioDividend.costBasisKrw)
      : metric === "dividend-yield"
        ? dividendYieldCandles(portfolioCandles, portfolioDividend.annualDividendKrw)
        : portfolioCandles;
  const valueFormat = metric === "daily-change" ? "krw" : "percent";
  const currentRate =
    metric === "holding-return"
      ? portfolioDividend.totalReturnRate
      : metric === "dividend-yield"
        ? portfolioDividend.dividendYield
        : changeRateFromCandles(portfolioDailyChangeCandles);
  const labels = METRIC_LABELS[metric];

  return (
    <AppShell>
      <Navigation
        title="T-ETF"
        description={`${user.name} · 지표 상세`}
      />

      <Top title={labels.title} description={labels.description} backLink={{ href: "/" }} />

      <Grid columns={4} className="mt-16">
        <Metric label="현재 지표" value={<RatePill value={currentRate} />} />
        <Metric label="평가금액" value={formatKrw(portfolio.totalMarketValueKrw)} />
        <Metric label="매입원금" value={formatKrw(portfolioDividend.costBasisKrw)} />
        <Metric label="연 예상 배당" value={formatKrw(portfolioDividend.annualDividendKrw)} />
      </Grid>

      <SectionHeader
        title="캔들 차트"
        description={metric === "daily-change" ? "최근 1년 주봉 기준입니다." : "최근 5년 월봉 기준입니다."}
      />

      <CandleChart
        candles={candles}
        label={`${labels.title} 상세 캔들 차트`}
        size="detail"
        valueFormat={valueFormat}
      />

      <SectionHeader title="계산 기준" description="관리자 포트폴리오와 시장 OHLC 데이터를 조합한 값입니다." />

      <List>
        <ListRow
          title="보유 수익률"
          description="현재 평가금액과 매입환율이 반영된 원화 매입원금 기준"
          value={<RatePill value={portfolioDividend.totalReturnRate} />}
        />
        <ListRow
          title="배당수익률"
          description="연 예상 배당금을 현재 평가금액으로 나눈 값"
          value={<RatePill value={portfolioDividend.dividendYield} />}
        />
      </List>
    </AppShell>
  );
}
