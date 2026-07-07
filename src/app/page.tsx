import { ArrowDownToLine, ArrowUpRight, CircleDollarSign, LogOut, RefreshCw, ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { CandleChart, SparkLineChart } from "@/app/components/stock-chart";
import {
  AppShell,
  Badge,
  ButtonLink,
  CheckboxField,
  CtaPanel,
  Empty,
  Field,
  Form,
  Grid,
  List,
  ListRow,
  Metric,
  Navigation,
  Notice,
  Panel,
  RowMeta,
  SectionHeader,
  TextLink,
  Top
} from "@/app/components/tds";
import { forecastDividend, summarizePortfolioDividend } from "@/lib/dividends";
import { formatDateTime, formatKrw, formatNumber, statusLabel } from "@/lib/format";
import { fetchMarketCandles, type MarketCandle, type MarketChart } from "@/lib/market-data";
import { getManualPortfolioOverview } from "@/lib/portfolio-store";
import { getUserSession } from "@/lib/session";
import { readStore } from "@/lib/store";
import type { Holding } from "@/lib/types";

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function statusClass(status: string): "accepted" | "rejected" | "pending" {
  if (status === "ACCEPTED") return "accepted";
  if (status === "REJECTED") return "rejected";
  return "pending";
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

function changeRateFromCandles(candles: MarketCandle[]) {
  const latest = candles.at(-1);
  const previous = candles.at(-2);
  if (!latest || !previous || previous.close <= 0) return undefined;
  return (latest.close - previous.close) / previous.close;
}

function sampleCandles(candles: MarketCandle[], maxPoints = 52) {
  if (candles.length <= maxPoints) return candles;
  const step = candles.length / maxPoints;
  return Array.from({ length: maxPoints }, (_, index) => candles[Math.floor(index * step)]).filter(Boolean);
}

function aggregatePortfolioCandles({
  holdings,
  charts,
  exchangeRate
}: {
  holdings: Holding[];
  charts: Map<string, MarketChart | null>;
  exchangeRate: number;
}) {
  const buckets = new Map<string, MarketCandle>();

  for (const holding of holdings) {
    const chart = charts.get(holding.symbol);
    if (!chart) continue;
    const multiplier = holding.quantity * (holding.currency === "USD" ? exchangeRate : 1);

    for (const candle of chart.candles) {
      const date = candle.date.slice(0, 10);
      const current = buckets.get(date) ?? {
        date: candle.date,
        open: 0,
        high: 0,
        low: 0,
        close: 0
      };

      buckets.set(date, {
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

function returnPoints(candles: MarketCandle[], costBasisKrw: number) {
  if (costBasisKrw <= 0) return [];
  return candles.map((candle) => ({
    date: candle.date,
    value: (candle.close - costBasisKrw) / costBasisKrw
  }));
}

function dividendYieldPoints(candles: MarketCandle[], annualDividendKrw: number) {
  if (annualDividendKrw <= 0) return [];
  return candles.map((candle) => ({
    date: candle.date,
    value: candle.close > 0 ? annualDividendKrw / candle.close : 0
  }));
}

export default async function Home({ searchParams }: HomeProps) {
  const user = await getUserSession();
  if (!user) redirect("/login");

  const params = (await searchParams) ?? {};
  const amount = Math.max(10000, Number(firstParam(params.amountKrw) ?? 100000) || 100000);
  const [portfolio, store] = await Promise.all([getManualPortfolioOverview(), readStore()]);
  const [forecast, portfolioDividend] = await Promise.all([
    forecastDividend(portfolio, amount),
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
    exchangeRate: portfolio.exchangeRate
  });
  const portfolioDailyChangeRate = changeRateFromCandles(portfolioDailyCandles);
  const holdingReturnPoints = returnPoints(portfolioMonthlyCandles, portfolioDividend.costBasisKrw);
  const yieldPoints = dividendYieldPoints(portfolioMonthlyCandles, portfolioDividend.annualDividendKrw);
  const myInvestments = store.investmentIntents.filter((intent) => intent.userId === user.id);
  const myWithdrawals = store.withdrawalIntents.filter((intent) => intent.userId === user.id);
  const myIntents = [...myInvestments, ...myWithdrawals];

  return (
    <AppShell>
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
            <ButtonLink href="#intent-section">
              의향서 작성
            </ButtonLink>
            <ButtonLink href="#portfolio-section" variant="secondary">
              포트폴리오 보기
            </ButtonLink>
          </>
        }
      />

      {params.submitted ? <Notice className="mt-12">의향서가 제출되었습니다. 관리자가 확인 후 상태를 변경합니다.</Notice> : null}
      {params.error ? <Notice className="mt-12">입력값을 다시 확인해주세요.</Notice> : null}

      <Grid columns={4} className="mt-16">
        <Metric label="포트폴리오 평가금액" value={formatKrw(portfolio.totalMarketValueKrw)} />
        <Metric
          label={<TextLink className="metric-card-link" href="#daily-change-detail">오늘 등락률</TextLink>}
          value={
            <div className="metric-detail">
              <RatePill value={portfolioDailyChangeRate} />
              <TextLink className="chart-link" href="#daily-change-detail">
                <CandleChart candles={sampleCandles(portfolioDailyCandles)} label="포트폴리오 1년 일봉 미니 캔들 차트" />
              </TextLink>
            </div>
          }
        />
        <Metric
          label={<TextLink className="metric-card-link" href="#holding-return-detail">보유 수익률</TextLink>}
          value={
            <div className="metric-detail">
              <RatePill value={portfolioDividend.totalReturnRate} />
              <TextLink className="chart-link" href="#holding-return-detail">
                <SparkLineChart
                  label="보유 수익률 추세"
                  points={holdingReturnPoints}
                  valueFormat="percent"
                />
              </TextLink>
            </div>
          }
        />
        <Metric
          label={<TextLink className="metric-card-link" href="#dividend-yield-detail">배당수익률</TextLink>}
          value={
            <div className="metric-detail">
              <RatePill value={portfolioDividend.dividendYield} />
              <TextLink className="chart-link" href="#dividend-yield-detail">
                <SparkLineChart
                  label="배당수익률 추세"
                  points={yieldPoints}
                  valueFormat="percent"
                />
              </TextLink>
            </div>
          }
        />
      </Grid>

      <SectionHeader
        title="지표 상세"
        description="등락률은 최근 1년 일봉, 보유 수익률과 배당수익률은 최근 5년 월봉 기준입니다."
      />

      <Grid columns={3}>
        <Panel className="metric-detail-panel">
          <h2 id="daily-change-detail">오늘 등락률</h2>
          <CandleChart
            candles={portfolioDailyCandles}
            label="포트폴리오 최근 1년 일봉 상세 캔들 차트"
            size="detail"
            valueFormat="krw"
          />
        </Panel>
        <Panel className="metric-detail-panel">
          <h2 id="holding-return-detail">보유 수익률</h2>
          <SparkLineChart
            label="보유 수익률 상세 차트"
            points={holdingReturnPoints}
            valueFormat="percent"
          />
          <List>
            <ListRow title="현재 보유 수익률" value={<RatePill value={portfolioDividend.totalReturnRate} />} />
            <ListRow title="평가금액" value={formatKrw(portfolio.totalMarketValueKrw)} />
            <ListRow title="매입원금" value={formatKrw(portfolioDividend.costBasisKrw)} />
          </List>
        </Panel>
        <Panel className="metric-detail-panel">
          <h2 id="dividend-yield-detail">배당수익률</h2>
          <SparkLineChart
            label="배당수익률 상세 차트"
            points={yieldPoints}
            valueFormat="percent"
          />
          <List>
            <ListRow title="현재 배당수익률" value={<RatePill value={portfolioDividend.dividendYield} />} />
            <ListRow title="연 예상 배당" value={formatKrw(portfolioDividend.annualDividendKrw)} />
            <ListRow title="월평균 배당" value={formatKrw(portfolioDividend.monthlyAverageKrw)} />
          </List>
        </Panel>
      </Grid>

      <SectionHeader title="예상 배당 계산" description="가정 투자금 기준으로 배정금액과 예상 배당을 계산합니다." />

      <Grid columns={2}>
        <CtaPanel>
          <Form method="get">
            <Field htmlFor="amountKrw" label="가정 투자금">
              <input id="amountKrw" name="amountKrw" type="number" min="10000" step="10000" defaultValue={amount} />
            </Field>
            <button type="submit">
              <RefreshCw size={17} />
              다시 계산
            </button>
          </Form>
        </CtaPanel>

        <List>
          <ListRow
            title="연 예상 배당"
            description="세금, 환율 변동은 반영되지 않습니다."
            value={formatKrw(forecast.annualDividendKrw)}
          />
          <ListRow
            title="월평균 예상 배당"
            description="연 예상 배당을 12개월로 나눈 값"
            value={formatKrw(forecast.monthlyAverageKrw)}
          />
          <ListRow
            title="가정 배당수익률"
            description="가정 투자금 대비 연 예상 배당"
            value={formatPercent(forecast.amountKrw > 0 ? forecast.annualDividendKrw / forecast.amountKrw : 0)}
          />
        </List>
      </Grid>

      <SectionHeader id="portfolio-section" title="현재 포트폴리오" description={`마지막 갱신 ${formatDateTime(portfolio.fetchedAt)}`} />

      <List>
        {portfolio.holdings.map((holding) => {
          const chart = dailyCharts.get(holding.symbol);
          const href = `/stocks/${encodeURIComponent(holding.symbol)}`;

          return (
            <ListRow
              key={holding.symbol}
              title={<TextLink href={href}>{holding.symbol}</TextLink>}
              description={`${holding.name} · ${formatNumber(holding.quantity, 4)}주 · 보유 수익률 ${formatPercent(holding.profitLossRate)}`}
              value={
                <div className="holding-row-value">
                  <TextLink className="chart-link" href={href}>
                    <CandleChart candles={sampleCandles(chart?.candles ?? [])} label={`${holding.symbol} 최근 1년 미니 캔들 차트`} />
                  </TextLink>
                  <div className="holding-row-price">
                    <span>{formatKrw(holding.marketValueKrw)}</span>
                    <RatePill value={chart?.changeRate} />
                  </div>
                </div>
              }
            />
          );
        })}
      </List>

      <SectionHeader title="종목별 예상 배당" description="배정금액, 예상수량, 다음 예상 지급월을 함께 확인합니다." />

      <List>
        {forecast.lines.map((line) => (
          <ListRow
            key={line.symbol}
            title={line.symbol}
            description={`${line.name} · 배정 ${formatKrw(line.allocationKrw)} · 예상 ${formatNumber(line.estimatedQuantity, 5)}주`}
            value={
              <>
                {formatKrw(line.monthlyAverageKrw)}
                <RowMeta>
                  연 {formatKrw(line.annualDividendKrw)} · {line.nextPaymentMonth ? `${line.nextPaymentMonth}월` : "지급월 없음"}
                </RowMeta>
              </>
            }
          />
        ))}
      </List>

      <SectionHeader id="intent-section" title="의향서 제출" description="제출된 내용은 관리자가 검토한 뒤 상태를 변경합니다." />

      <Grid columns={2}>
        <Panel>
          <h2>
            <ArrowUpRight size={18} /> 투자 의향서
          </h2>
          <Form action="/api/intents/invest" method="post">
            <Field htmlFor="investAmount" label="의향 금액">
              <input id="investAmount" name="amountKrw" type="number" min="10000" step="10000" required />
            </Field>
            <Field htmlFor="depositorName" label="입금자명">
              <input id="depositorName" name="depositorName" defaultValue={user.name} required />
            </Field>
            <Field htmlFor="investContact" label="연락처">
              <input id="investContact" name="contact" placeholder="전화번호 또는 메신저 ID" required />
            </Field>
            <CheckboxField>
              <input type="checkbox" name="guardianConfirmed" value="true" />
              미성년자인 경우 보호자 동의는 서비스 외부에서 수동으로 제출합니다.
            </CheckboxField>
            <Field htmlFor="investNote" label="메모">
              <textarea id="investNote" name="note" />
            </Field>
            <button type="submit">
              <CircleDollarSign size={17} />
              제출
            </button>
          </Form>
        </Panel>

        <Panel>
          <h2>
            <ArrowDownToLine size={18} /> 출금 의향서
          </h2>
          <Form action="/api/intents/withdraw" method="post">
            <Field htmlFor="withdrawAmount" label="의향 금액">
              <input id="withdrawAmount" name="amountKrw" type="number" min="10000" step="10000" required />
            </Field>
            <Field htmlFor="bankName" label="은행">
              <input id="bankName" name="bankName" required />
            </Field>
            <Field htmlFor="accountNumber" label="계좌번호">
              <input id="accountNumber" name="accountNumber" inputMode="numeric" required />
            </Field>
            <Field htmlFor="accountHolder" label="예금주">
              <input id="accountHolder" name="accountHolder" defaultValue={user.name} required />
            </Field>
            <Field htmlFor="withdrawContact" label="연락처">
              <input id="withdrawContact" name="contact" placeholder="전화번호 또는 메신저 ID" required />
            </Field>
            <Field htmlFor="withdrawNote" label="메모">
              <textarea id="withdrawNote" name="note" />
            </Field>
            <button type="submit">제출</button>
          </Form>
        </Panel>
      </Grid>

      <SectionHeader title="내 제출 내역" description="투자와 출금 의향서 상태를 한곳에서 확인합니다." />

      <List>
        {myIntents.map((intent) => (
          <ListRow
            key={intent.id}
            title={intent.type === "INVESTMENT" ? "투자 의향" : "출금 의향"}
            description={formatDateTime(intent.createdAt)}
            value={
              <>
                {formatKrw(intent.amountKrw)}
                <RowMeta>
                  <Badge tone={statusClass(intent.status)}>{statusLabel(intent.status)}</Badge>
                </RowMeta>
              </>
            }
          />
        ))}
        {myIntents.length === 0 ? <Empty>제출 내역이 없습니다.</Empty> : null}
      </List>

      <Notice className="mt-18">
        <ShieldAlert size={17} /> 이 서비스는 투자 권유, 투자자문, 자동매매, 금전 보관 기능을 제공하지 않는 의향서
        관리 서비스입니다.
      </Notice>
    </AppShell>
  );
}
