import { LogOut, RefreshCw } from "lucide-react";
import { redirect } from "next/navigation";
import { DividendForecastView } from "@/app/components/dividend-forecast-view";
import { FormattedNumberInput } from "@/app/components/formatted-number-input";
import {
  AppShell,
  ButtonLink,
  CtaPanel,
  Field,
  Form,
  Grid,
  List,
  ListRow,
  Navigation,
  SectionHeader,
  Top
} from "@/app/components/tds";
import { forecastDividend } from "@/lib/dividends";
import { formatKrw, formatNumber } from "@/lib/format";
import { getManualPortfolioOverview } from "@/lib/portfolio-store";
import { getUserSession } from "@/lib/session";

type SimulationPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function formatPercent(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${formatNumber(value * 100, 2)}%`;
}

export default async function SimulationPage({ searchParams }: SimulationPageProps) {
  const user = await getUserSession();
  if (!user) redirect("/login");

  const params = (await searchParams) ?? {};
  const amount = Math.max(10000, Number(firstParam(params.amountKrw) ?? 100000) || 100000);
  const portfolio = await getManualPortfolioOverview();
  const forecast = await forecastDividend(portfolio, amount);

  return (
    <AppShell>
      <Navigation
        title="T-ETF 투자 시뮬레이션"
        description={`${user.name} · 현재 포트폴리오 비중 기준`}
        actions={
          <form action="/api/auth/logout" method="post">
            <button className="ghost" type="submit" title="로그아웃">
              <LogOut size={18} />
            </button>
          </form>
        }
      />

      <Top
        title="투자 배당 시뮬레이션"
        description="가정 투자금을 현재 포트폴리오 비중대로 배정했을 때의 예상 배당을 계산합니다."
        backLink={{ href: "/" }}
        actions={
          <ButtonLink href="#forecast-section">
            결과 보기
          </ButtonLink>
        }
      />

      <SectionHeader title="예상 배당 계산" description="가정 투자금 기준으로 배정금액과 예상 배당을 계산합니다." />

      <Grid columns={2}>
        <CtaPanel>
          <Form method="get">
            <Field htmlFor="amountKrw" label="가정 투자금 (원화)">
              <FormattedNumberInput
                defaultValue={amount}
                id="amountKrw"
                min="10000"
                name="amountKrw"
                placeholder="예: 100,000"
                required
                step="10000"
              />
              <p className="field-help">원화 기준으로 입력하면 쉼표가 자동으로 표시됩니다.</p>
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
            description="현재 USD/KRW 기준이며 세금과 향후 환율 변동은 반영되지 않습니다."
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

      <SectionHeader
        id="forecast-section"
        title="예상 배당"
        description="가정 투자금 기준 예상 배당을 월별 또는 종목별로 확인합니다."
      />

      <DividendForecastView lines={forecast.lines} />
    </AppShell>
  );
}
