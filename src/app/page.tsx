import { LogOut, ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { DividendForecastView } from "@/app/components/dividend-forecast-view";
import { SparkLineChart } from "@/app/components/stock-chart";
import { ToastStack, type ToastMessage } from "@/app/components/toast";
import {
  AppShell,
  ButtonLink,
  CompositionChart,
  Grid,
  List,
  ListRow,
  Metric,
  Navigation,
  Notice,
  Panel,
  SectionHeader,
  TextLink,
  Top
} from "@/app/components/tds";
import {
  aggregatePortfolioCandles,
  changeRateFromCandles,
  dividendYieldPoints,
  pointsFromCandles,
  returnPoints,
  samplePoints
} from "@/lib/chart-metrics";
import { forecastDividend, summarizePortfolioDividend } from "@/lib/dividends";
import { formatDateTime, formatKrw, formatNumber } from "@/lib/format";
import { fetchMarketCandles } from "@/lib/market-data";
import { getManualPortfolioOverview } from "@/lib/portfolio-store";
import { getUserSession } from "@/lib/session";
import { stockFullLabel, stockPrimaryLabel, stockSecondaryLabel } from "@/lib/stock-display";

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function homeToastMessages(params: Record<string, string | string[] | undefined>): ToastMessage[] {
  const messages: ToastMessage[] = [];
  if (params.submitted) {
    messages.push({
      id: "submitted",
      title: "의향서가 제출되었습니다",
      description: "관리자가 확인 후 상태를 변경합니다.",
      tone: "success"
    });
  }
  if (params.error) {
    messages.push({
      id: "error",
      title: "입력값을 다시 확인해주세요",
      tone: "error"
    });
  }
  return messages;
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

export default async function Home({ searchParams }: HomeProps) {
  const user = await getUserSession();
  if (!user) redirect("/login");

  const params = (await searchParams) ?? {};
  const portfolio = await getManualPortfolioOverview();
  const [scheduledDividend, portfolioDividend] = await Promise.all([
    forecastDividend(portfolio, portfolio.totalMarketValueKrw),
    summarizePortfolioDividend(portfolio)
  ]);
  const [dailyChartEntries, monthlyChartEntries] = await Promise.all([
    Promise.all(
      portfolio.holdings.map(async (holding) => [
        holding.symbol,
        await fetchMarketCandles(holding.symbol, { range: "1y", interval: "1d", limit: 252 }).catch(() => null)
      ] as const)
    ),
    Promise.all(
      portfolio.holdings.map(async (holding) => [
        holding.symbol,
        await fetchMarketCandles(holding.symbol, { range: "5y", interval: "1mo", limit: 60 }).catch(() => null)
      ] as const)
    )
  ]);
  const dailyCharts = new Map(dailyChartEntries);
  const monthlyCharts = new Map(monthlyChartEntries);
  const portfolioDailyCandles = aggregatePortfolioCandles({
    holdings: portfolio.holdings,
    charts: dailyCharts,
    exchangeRate: portfolio.exchangeRate
  });
  const portfolioMonthlyCandles = aggregatePortfolioCandles({
    holdings: portfolio.holdings,
    charts: monthlyCharts,
    exchangeRate: portfolio.exchangeRate,
    bucket: "month"
  });
  const portfolioDailyChangeRate = changeRateFromCandles(portfolioDailyCandles);
  const portfolioDailyPoints = pointsFromCandles(portfolioDailyCandles);
  const holdingReturnPoints = returnPoints(portfolioMonthlyCandles, portfolioDividend.costBasisKrw);
  const yieldPoints = dividendYieldPoints(portfolioMonthlyCandles, portfolioDividend.annualDividendKrw);
  const portfolioAllocation = [...portfolio.holdings]
    .filter((holding) => holding.marketValueKrw > 0)
    .sort((a, b) => b.marketValueKrw - a.marketValueKrw)
    .map((holding) => ({
      id: holding.symbol,
      label: stockPrimaryLabel(holding),
      description: stockSecondaryLabel(holding),
      href: `/stocks/${encodeURIComponent(holding.symbol)}`,
      value: holding.marketValueKrw
    }));
  return (
    <AppShell>
      <ToastStack messages={homeToastMessages(params)} />

      <Navigation
        title="T-ETF"
        description={`${user.name} · ${user.userType === "alumni" ? "졸업생" : "재학생"}`}
        actions={
          <>
            <ButtonLink href="/admin" variant="secondary">
              관리자
            </ButtonLink>
            <form action="/api/auth/logout" method="post">
              <button className="ghost" type="submit" title="로그아웃">
                <LogOut size={18} />
              </button>
            </form>
          </>
        }
      />

      <Top
        title="T-ETF 포트폴리오"
        description="공개 포트폴리오의 평가금액, 수익률, 배당수익률을 확인하고 참여 의향을 남길 수 있습니다."
        actions={
          <>
            <ButtonLink href="/intents">
              의향서 작성
            </ButtonLink>
            <ButtonLink href="/simulation" variant="secondary">
              투자 시뮬레이션
            </ButtonLink>
          </>
        }
      />

      <Grid columns={4} className="mt-16">
        <Metric label="포트폴리오 평가금액" value={formatKrw(portfolio.totalMarketValueKrw)} />
        <Metric
          label={<TextLink className="metric-card-link" href="/metrics/daily-change">오늘 등락률</TextLink>}
          value={
            <div className="metric-detail">
              <RatePill value={portfolioDailyChangeRate} />
              <TextLink className="chart-link" href="/metrics/daily-change">
                <SparkLineChart
                  interactive={false}
                  label="포트폴리오 1년 등락 추세"
                  points={samplePoints(portfolioDailyPoints)}
                  trendValue={portfolioDailyChangeRate}
                  valueFormat="krw"
                />
              </TextLink>
            </div>
          }
        />
        <Metric
          label={<TextLink className="metric-card-link" href="/metrics/holding-return">보유 수익률</TextLink>}
          value={
            <div className="metric-detail">
              <RatePill value={portfolioDividend.totalReturnRate} />
              <TextLink className="chart-link" href="/metrics/holding-return">
                <SparkLineChart
                  interactive={false}
                  label="보유 수익률 추세"
                  points={holdingReturnPoints}
                  trendValue={portfolioDividend.totalReturnRate}
                  valueFormat="percent"
                />
              </TextLink>
            </div>
          }
        />
        <Metric
          label={<TextLink className="metric-card-link" href="/metrics/dividend-yield">배당수익률</TextLink>}
          value={
            <div className="metric-detail">
              <RatePill value={portfolioDividend.dividendYield} />
              <TextLink className="chart-link" href="/metrics/dividend-yield">
                <SparkLineChart
                  interactive={false}
                  label="배당수익률 추세"
                  points={yieldPoints}
                  trendValue={portfolioDividend.dividendYield}
                  valueFormat="percent"
                />
              </TextLink>
            </div>
          }
        />
      </Grid>

      <SectionHeader
        id="portfolio-section"
        title="현재 포트폴리오"
        description={`마지막 갱신 ${formatDateTime(portfolio.fetchedAt)} · USD/KRW ${formatNumber(portfolio.exchangeRate, 2)}원`}
      />

      <Panel className="tds-composition-panel">
        <h2>구성 종목 비중</h2>
        <CompositionChart
          emptyText="포트폴리오 데이터 없음"
          items={portfolioAllocation}
          label="포트폴리오 구성 종목 비중"
        />
      </Panel>

      <List>
        {portfolio.holdings.map((holding) => {
          const chart = dailyCharts.get(holding.symbol);
          const href = `/stocks/${encodeURIComponent(holding.symbol)}`;
          const secondaryLabel = stockSecondaryLabel(holding);

          return (
            <ListRow
              key={holding.symbol}
              title={<TextLink href={href}>{stockPrimaryLabel(holding)}</TextLink>}
              description={`${secondaryLabel ? `${secondaryLabel} · ` : ""}${formatNumber(holding.quantity, 4)}주 · 원화 보유 수익률 ${formatPercent(holding.profitLossRate)}`}
              value={
                <div className="holding-row-value">
                  <TextLink className="chart-link" href={href}>
                    <SparkLineChart
                      interactive={false}
                      label={`${stockFullLabel(holding)} 최근 1년 가격 추세`}
                      points={samplePoints(pointsFromCandles(chart?.candles ?? []))}
                      valueFormat={holding.currency === "USD" ? "usd" : "krw"}
                    />
                  </TextLink>
                  <div className="holding-row-price">
                    <span>{formatKrw(holding.marketValueKrw)}</span>
                    <RatePill value={changeRateFromCandles(chart?.candles ?? [])} />
                  </div>
                </div>
              }
            />
          );
        })}
      </List>

      <SectionHeader title="예정 배당" description="현재 펀드 보유 수량 기준으로 예정 배당을 월별 또는 종목별로 확인합니다." />

      <Grid columns={3} className="scheduled-dividend-summary">
        <Metric label="연 예정 배당" value={formatKrw(scheduledDividend.annualDividendKrw)} />
        <Metric label="월평균 예정 배당" value={formatKrw(scheduledDividend.monthlyAverageKrw)} />
        <Metric label="현재 배당수익률" value={formatPercent(portfolioDividend.dividendYield)} />
      </Grid>

      <DividendForecastView lines={scheduledDividend.lines} mode="holding" />

      <Notice className="mt-18">
        <ShieldAlert size={17} /> 이 서비스는 투자 권유, 투자자문, 자동매매, 금전 보관 기능을 제공하지 않는 의향서
        관리 서비스입니다.
      </Notice>
    </AppShell>
  );
}
