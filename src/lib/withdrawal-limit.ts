import type { AppStore, PortfolioOverview } from "./types";
import { portfolioCostBasisKrw } from "./portfolio-math";

export type WithdrawalLimit = {
  principalKrw: number;
  drawdownRate: number;
  maxAmountKrw: number;
};

export function acceptedInvestmentPrincipal(store: AppStore, userId: string) {
  return store.investmentIntents
    .filter((intent) => intent.userId === userId && intent.status === "ACCEPTED")
    .reduce((sum, intent) => sum + intent.amountKrw, 0);
}

export function portfolioDrawdownRate(portfolio: PortfolioOverview) {
  const costBasisKrw = portfolioCostBasisKrw(portfolio.holdings);
  if (!costBasisKrw || costBasisKrw <= 0) return 0;

  return Math.min(0, (portfolio.totalMarketValueKrw - costBasisKrw) / costBasisKrw);
}

export function withdrawalLimitFromPrincipal(principalKrw: number, drawdownRate: number): WithdrawalLimit {
  const normalizedPrincipal = Math.max(0, Math.floor(principalKrw));
  const normalizedDrawdown = Math.min(0, Math.max(-1, drawdownRate));
  const maxAmountKrw = Math.floor(normalizedPrincipal * (1 + normalizedDrawdown));

  return {
    principalKrw: normalizedPrincipal,
    drawdownRate: normalizedDrawdown,
    maxAmountKrw: Math.max(0, Math.min(normalizedPrincipal, maxAmountKrw))
  };
}

export function withdrawalLimitForUser(store: AppStore, portfolio: PortfolioOverview, userId: string) {
  return withdrawalLimitFromPrincipal(acceptedInvestmentPrincipal(store, userId), portfolioDrawdownRate(portfolio));
}
