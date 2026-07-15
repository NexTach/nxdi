import { investorDrawdownRateFromValuation } from "../domain/first-loss.js";

export class CalculateWithdrawalSettlementService {
  execute(input: {
    requestedPrincipalReductionKrw: number;
    userPrincipalKrw: number;
    totalInvestorPrincipalKrw: number;
    portfolioNetAssetsKrw: number;
    availableCashKrw: number;
  }) {
    const requestedPrincipalReductionKrw = Math.max(
      0,
      Math.floor(input.requestedPrincipalReductionKrw)
    );
    const userPrincipalKrw = Math.max(0, Math.floor(input.userPrincipalKrw));
    if (requestedPrincipalReductionKrw <= 0 || requestedPrincipalReductionKrw > userPrincipalKrw) {
      return { status: "principal_exceeded" as const, userPrincipalKrw };
    }
    const investorLossRate = investorDrawdownRateFromValuation({
      portfolioNetAssetsKrw: input.portfolioNetAssetsKrw,
      totalInvestorPrincipalKrw: input.totalInvestorPrincipalKrw
    });
    const payableKrw = Math.floor(requestedPrincipalReductionKrw * (1 + investorLossRate));
    const availableCashKrw = Math.max(0, Math.floor(input.availableCashKrw));
    if (payableKrw > availableCashKrw) {
      return { status: "insufficient_liquidity" as const, payableKrw, availableCashKrw };
    }
    return {
      status: "calculated" as const,
      principalReductionKrw: requestedPrincipalReductionKrw,
      payableKrw,
      investorLossKrw: requestedPrincipalReductionKrw - payableKrw,
      investorLossRate
    };
  }
}
