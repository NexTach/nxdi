export type PortfolioValuation = {
  portfolioNetAssetsKrw: number;
  totalInvestorPrincipalKrw: number;
};

export function investorDrawdownRateFromValuation(valuation: PortfolioValuation) {
  const investorPrincipal = Math.max(0, valuation.totalInvestorPrincipalKrw);
  if (investorPrincipal <= 0) return 0;
  const netAssets = Math.max(0, valuation.portfolioNetAssetsKrw);
  return Math.min(0, Math.max(-1, (netAssets - investorPrincipal) / investorPrincipal));
}
