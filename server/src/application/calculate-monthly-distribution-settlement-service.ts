import { calculateDividendAllocation } from "../domain/dividend-allocation.js";

export type DistributionInvestorPrincipal = {
  userId: string;
  userName: string;
  userEmail: string;
  principalKrw: number;
};

function allocateWholeWon<T extends { userId: string; principalKrw: number }>(
  investors: T[],
  poolKrw: number,
  totalPrincipalKrw: number
) {
  const integerPool = Math.max(0, Math.floor(poolKrw));
  if (integerPool <= 0 || totalPrincipalKrw <= 0) {
    return new Map(investors.map((investor) => [investor.userId, 0]));
  }
  const shares = investors.map((investor) => {
    const raw = integerPool * investor.principalKrw / totalPrincipalKrw;
    return { userId: investor.userId, amountKrw: Math.floor(raw), fraction: raw - Math.floor(raw) };
  });
  let remainder = integerPool - shares.reduce((sum, share) => sum + share.amountKrw, 0);
  for (const share of [...shares].sort((left, right) =>
    right.fraction - left.fraction || left.userId.localeCompare(right.userId)
  )) {
    if (remainder <= 0) break;
    share.amountKrw += 1;
    remainder -= 1;
  }
  return new Map(shares.map((share) => [share.userId, share.amountKrw]));
}

export class CalculateMonthlyDistributionSettlementService {
  execute(input: {
    actualDividendKrw: number;
    portfolioNetAssetsKrw: number;
    investors: DistributionInvestorPrincipal[];
  }) {
    const investors = input.investors
      .map((investor) => ({ ...investor, principalKrw: Math.max(0, Math.floor(investor.principalKrw)) }))
      .filter((investor) => investor.principalKrw > 0)
      .sort((left, right) => left.userId.localeCompare(right.userId));
    const investorPrincipalKrw = investors.reduce((sum, investor) => sum + investor.principalKrw, 0);
    const calculation = calculateDividendAllocation({
      actualDividendKrw: input.actualDividendKrw,
      selectedInvestmentKrw: investorPrincipalKrw,
      investorPrincipalKrw,
      totalMarketValueKrw: input.portfolioNetAssetsKrw
    });
    const managementFeeKrw = Math.floor(calculation.managementFeeKrw);
    const cashDistributionKrw = Math.floor(calculation.investorDistributionPoolKrw);
    let reinvestmentCreditKrw = Math.floor(calculation.investorReinvestmentPoolKrw);
    let companyRetainedKrw = Math.floor(calculation.companyRetainedDividendKrw);
    const formulaRemainderKrw = Math.max(
      0,
      Math.floor(calculation.actualDividendKrw) -
        cashDistributionKrw -
        reinvestmentCreditKrw -
        companyRetainedKrw
    );
    if (investorPrincipalKrw > 0) reinvestmentCreditKrw += formulaRemainderKrw;
    else companyRetainedKrw += formulaRemainderKrw;
    const roundingCarryKrw = 0;
    const cashByUser = allocateWholeWon(investors, cashDistributionKrw, investorPrincipalKrw);
    const reinvestmentByUser = allocateWholeWon(investors, reinvestmentCreditKrw, investorPrincipalKrw);
    const feeByUser = allocateWholeWon(investors, managementFeeKrw, investorPrincipalKrw);

    return {
      ...calculation,
      investorPrincipalKrw,
      managementFeeKrw,
      cashDistributionKrw,
      reinvestmentCreditKrw,
      companyRetainedKrw,
      roundingCarryKrw,
      allocations: investors.map((investor) => ({
        ...investor,
        cashDistributionKrw: cashByUser.get(investor.userId) ?? 0,
        reinvestmentCreditKrw: reinvestmentByUser.get(investor.userId) ?? 0,
        managementFeeKrw: feeByUser.get(investor.userId) ?? 0
      }))
    };
  }
}
