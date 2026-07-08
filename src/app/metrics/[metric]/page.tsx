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
  SectionHeader,
  Top
} from "@/app/components/tds";
import {
  candlesFromSnapshots,
  dividendYieldCandlesFromSnapshots,
  portfolioChangeRateFromMarketValue,
  returnCandlesFromSnapshots
} from "@/lib/chart-metrics";
import { summarizePortfolioDividend } from "@/lib/dividends";
import { formatKrw, formatNumber } from "@/lib/format";
import { fetchMarketCandles, type MarketChart } from "@/lib/market-data";
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
    description: "현재 포트폴리오 평가금액과 보유 종목 전일 종가 합산액 기준으로 흐름을 보여줍니다."
  },
  "holding-return": {
    title: "보유 수익률",
    description: "일별 확정 평가금액과 매입환율 반영 원화 원가 기준으로 흐름을 보여줍니다."
  },
  "dividend-yield": {
    title: "배당수익률",
    description: "일별 확정 평가금액과 연 예상 배당금 기준으로 흐름을 보여줍니다."
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

function formatOptionalKrw(value?: number) {
  return typeof value === "number" && Number.isFinite(value) ? formatKrw(value) : "-";
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

  const { metric } = await params;
  if (!isMetricSlug(metric)) notFound();

  const portfolio = await getManualPortfolioOverview();
  const portfolioDividend = await summarizePortfolioDividend(portfolio);
  const dailyCharts: Map<string, MarketChart | null> =
    metric === "daily-change"
      ? new Map(
          await Promise.all(
            portfolio.holdings.map(async (holding) => [
              holding.symbol,
              await fetchMarketCandles(holding.symbol, {
                range: "1d",
                interval: "1d",
                limit: 1
              }).catch(() => null)
            ] as const)
          )
        )
      : new Map();
  const candles =
    metric === "holding-return"
      ? returnCandlesFromSnapshots(portfolio.dailySnapshots)
      : metric === "dividend-yield"
        ? dividendYieldCandlesFromSnapshots(portfolio.dailySnapshots)
        : candlesFromSnapshots(portfolio.dailySnapshots);
  const valueFormat = metric === "daily-change" ? "krw" : "percent";
  const currentRate =
    metric === "holding-return"
      ? portfolioDividend.totalReturnRate
      : metric === "dividend-yield"
        ? portfolioDividend.dividendYield
        : portfolioChangeRateFromMarketValue({
            holdings: portfolio.holdings,
            charts: dailyCharts,
            exchangeRate: portfolio.exchangeRate
          });
  const labels = METRIC_LABELS[metric];

  return (
    <AppShell>
      <Navigation
        title="T-ETF"
        description={user ? `${user.name} · 지표 상세` : "지표 상세"}
        actions={<AuthNavActions user={user} />}
      />

      <Top title={labels.title} description={labels.description} backLink={{ href: "/" }} />

      <Grid columns={4} className="mt-16">
        <Metric label="현재 지표" value={<RatePill value={currentRate} />} />
        <Metric label="평가금액" value={formatKrw(portfolio.totalMarketValueKrw)} />
        <Metric label="매입원금" value={formatOptionalKrw(portfolioDividend.costBasisKrw)} />
        <Metric label="연 예상 배당" value={formatOptionalKrw(portfolioDividend.annualDividendKrw)} />
      </Grid>

      <SectionHeader
        title={metric === "daily-change" ? "평가금액 캔들 차트" : "캔들 차트"}
        description="과거 날짜는 확정 마감 스냅샷, 최신 날짜는 현재 저장된 평가금액 기준입니다."
      />

      <CandleChart
        candles={candles}
        label={metric === "daily-change" ? "포트폴리오 평가금액 상세 캔들 차트" : `${labels.title} 상세 캔들 차트`}
        size="detail"
        valueFormat={valueFormat}
      />

      <SectionHeader title="계산 기준" description="관리자 포트폴리오, 시장 가격, 일별 평가금액 스냅샷을 조합한 값입니다." />

      <List>
        {metric === "daily-change" ? (
          <ListRow
            title="오늘 등락률"
            description="현재 보유 평가금액 총합과 보유 종목별 전일 종가 기준 평가금액 총합 비교"
            value={<RatePill value={currentRate} />}
          />
        ) : null}
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
