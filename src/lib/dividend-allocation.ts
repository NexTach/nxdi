export const PRODUCT_COMPANY_DIVIDEND_TRANSFER_RATE = 0.2;
export const PRODUCT_MONTHLY_INVESTOR_DIVIDEND_CAP_RATE = 0.0025;

export type DividendAllocationInput = {
  actualDividendKrw: number;
  selectedInvestmentKrw: number;
  investorPrincipalKrw: number;
  totalMarketValueKrw: number;
  companyDividendTransferRate?: number;
  monthlyInvestorDividendCapRate?: number;
};

function positiveAmount(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function cappedRate(value: number | undefined, fallback: number) {
  const rate = Number.isFinite(value) ? Number(value) : fallback;
  return Math.min(Math.max(rate, 0), 1);
}

export function calculateDividendAllocation(input: DividendAllocationInput) {
  const actualDividendKrw = positiveAmount(input.actualDividendKrw);
  const selectedInvestmentKrw = positiveAmount(input.selectedInvestmentKrw);
  const investorPrincipalKrw = positiveAmount(input.investorPrincipalKrw);
  const totalMarketValueKrw = positiveAmount(input.totalMarketValueKrw);
  const companyDividendTransferRate = cappedRate(
    input.companyDividendTransferRate,
    PRODUCT_COMPANY_DIVIDEND_TRANSFER_RATE
  );
  const monthlyInvestorDividendCapRate = cappedRate(
    input.monthlyInvestorDividendCapRate,
    PRODUCT_MONTHLY_INVESTOR_DIVIDEND_CAP_RATE
  );

  const companyPrincipalKrw = Math.max(totalMarketValueKrw - investorPrincipalKrw, 0);
  const dividendBaseKrw = investorPrincipalKrw + companyPrincipalKrw;
  const investorBaseWeight = dividendBaseKrw > 0 ? investorPrincipalKrw / dividendBaseKrw : 0;
  const investorBaseDividendKrw = actualDividendKrw * investorBaseWeight;
  const companyBaseDividendKrw = Math.max(actualDividendKrw - investorBaseDividendKrw, 0);
  const investorDividendCapKrw = investorPrincipalKrw * monthlyInvestorDividendCapRate;
  const companyTransferNeedKrw = Math.max(investorDividendCapKrw - investorBaseDividendKrw, 0);
  const companyTransferLimitKrw = companyBaseDividendKrw * companyDividendTransferRate;
  const companyTransferredDividendKrw = Math.min(
    companyTransferNeedKrw,
    companyTransferLimitKrw,
    companyBaseDividendKrw
  );
  const investorDistributionPoolKrw = Math.min(
    investorBaseDividendKrw + companyTransferredDividendKrw,
    investorDividendCapKrw,
    actualDividendKrw
  );
  const selectedInvestorWeight =
    investorPrincipalKrw > 0 ? Math.min(selectedInvestmentKrw / investorPrincipalKrw, 1) : 0;
  const allocationKrw = investorDistributionPoolKrw * selectedInvestorWeight;

  return {
    actualDividendKrw,
    investorPrincipalKrw,
    companyPrincipalKrw,
    dividendBaseKrw,
    investorBaseWeight,
    investorBaseDividendKrw,
    companyBaseDividendKrw,
    companyDividendTransferRate,
    companyTransferNeedKrw,
    companyTransferLimitKrw,
    companyTransferredDividendKrw,
    monthlyInvestorDividendCapRate,
    investorDividendCapKrw,
    investorDistributionPoolKrw,
    companyRetainedDividendKrw: Math.max(actualDividendKrw - investorDistributionPoolKrw, 0),
    selectedInvestorWeight,
    allocationKrw
  };
}
