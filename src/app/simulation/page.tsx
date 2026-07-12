import { RefreshCw } from "lucide-react";
import { AuthNavActions } from "@/app/components/auth-actions";
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
import { calculateExpectedInvestorDividend } from "@/lib/dividend-allocation";
import { forecastDividend } from "@/lib/dividends";
import { formatKrw, formatNumber } from "@/lib/format";
import { getManualPortfolioOverview } from "@/lib/portfolio-store";
import { PRODUCT_MAX_INVESTMENT_KRW, PRODUCT_MIN_INVESTMENT_KRW } from "@/lib/product-policy";
import { getUserSession } from "@/lib/session";
import { readAcceptedNetInvestmentPrincipal } from "@/lib/store";

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

function formatOptionalKrw(value?: number) {
  return typeof value === "number" && Number.isFinite(value) ? formatKrw(value) : "-";
}

export default async function SimulationPage({ searchParams }: SimulationPageProps) {
  const user = await getUserSession();

  const params = (await searchParams) ?? {};
  const requestedAmount = Number(firstParam(params.amountKrw) ?? 100000) || 100000;
  const amount = Math.min(
    PRODUCT_MAX_INVESTMENT_KRW,
    Math.max(PRODUCT_MIN_INVESTMENT_KRW, requestedAmount)
  );
  const [portfolio, currentInvestorPrincipalKrw] = await Promise.all([
    getManualPortfolioOverview(),
    readAcceptedNetInvestmentPrincipal()
  ]);
  const forecast = await forecastDividend(portfolio, amount);
  const annualPortfolioDividendYield =
    forecast.amountKrw > 0 && typeof forecast.annualDividendKrw === "number"
      ? forecast.annualDividendKrw / forecast.amountKrw
      : undefined;
  const expectedPayout =
    typeof annualPortfolioDividendYield === "number"
      ? calculateExpectedInvestorDividend({
          investmentKrw: amount,
          currentPortfolioMarketValueKrw: portfolio.totalMarketValueKrw,
          currentInvestorPrincipalKrw,
          annualPortfolioDividendYield
        })
      : undefined;

  return (
    <AppShell>
      <Navigation
        title="TDIV 투자 시뮬레이션"
        description={user ? `${user.name} · 현재 포트폴리오 비중 기준` : "현재 포트폴리오 비중 기준"}
        actions={<AuthNavActions user={user} />}
      />

      <Top
        title="투자 배당 시뮬레이션"
        description="현재 포트폴리오 배당 전망에 상품의 배당 상한과 당사 몫 이전 정책을 적용해 예상 지급액을 계산합니다."
        backLink={{ href: "/" }}
        actions={
          <ButtonLink href="#forecast-section">
            결과 보기
          </ButtonLink>
        }
      />

      <SectionHeader title="정책 적용 예상 지급액" description="세금과 외부 비용을 차감하기 전의 가정값이며 실제 지급액은 실배당에 따라 달라집니다." />

      <Grid columns={2}>
        <CtaPanel>
          <Form method="get">
            <Field htmlFor="amountKrw" label="가정 투자금 (원화)">
              <FormattedNumberInput
                defaultValue={amount}
                id="amountKrw"
                max={PRODUCT_MAX_INVESTMENT_KRW}
                min={PRODUCT_MIN_INVESTMENT_KRW}
                name="amountKrw"
                placeholder="예: 100,000"
                required
                step="10000"
              />
              <p className="field-help">1만원 이상 100만원 이하로 입력하면 쉼표가 자동으로 표시됩니다.</p>
            </Field>
            <button type="submit">
              <RefreshCw size={17} />
              다시 계산
            </button>
          </Form>
        </CtaPanel>

        <List>
          <ListRow
            title="정책 적용 연 예상 지급액"
            description="월별 예상 지급액을 12개월로 단순 환산한 세전 금액"
            value={formatOptionalKrw(expectedPayout?.annualExpectedDividendKrw)}
          />
          <ListRow
            title="정책 적용 월평균 지급액"
            description="실배당 기반 배분, 당사 몫 20% 이전 및 월 상한 적용"
            value={formatOptionalKrw(expectedPayout?.monthlyExpectedDividendKrw)}
          />
          <ListRow
            title="정책 적용 예상 지급수익률"
            description="가정 투자금 대비 연 예상 지급액, 단순 연 상한 10%"
            value={formatPercent(expectedPayout?.expectedAnnualPayoutRate)}
          />
          <ListRow
            title="포트폴리오 원배당수익률"
            description="정책 배분 전 보유 종목의 연 예상 배당 기준"
            value={formatPercent(annualPortfolioDividendYield)}
          />
        </List>
      </Grid>

      <SectionHeader
        id="forecast-section"
        title="포트폴리오 원배당 전망"
        description="정책 배분 전 가정 투자금의 종목별 예상 배당입니다. 실제 지급액은 위 정책 적용 결과를 확인하세요."
      />

      <DividendForecastView lines={forecast.lines} />
    </AppShell>
  );
}
