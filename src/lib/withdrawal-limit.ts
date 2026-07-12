import type { AppStore, PortfolioOverview } from "./types";
import { portfolioCostBasisKrw } from "./portfolio-math";

export type WithdrawalLimit = {
  principalKrw: number;
  pendingWithdrawalKrw: number;
  drawdownRate: number;
  maxAmountKrw: number;
};

export function acceptedInvestmentPrincipal(store: AppStore, userId: string) {
  return store.investmentIntents
    .filter((intent) => intent.userId === userId && intent.status === "ACCEPTED")
    .reduce((sum, intent) => sum + intent.amountKrw, 0);
}

export function acceptedWithdrawalAmount(store: AppStore, userId: string) {
  return store.withdrawalIntents
    .filter((intent) => intent.userId === userId && intent.status === "ACCEPTED")
    .reduce((sum, intent) => sum + intent.amountKrw, 0);
}

export function pendingWithdrawalAmount(store: AppStore, userId: string) {
  return store.withdrawalIntents
    .filter((intent) => intent.userId === userId && intent.status === "PENDING")
    .reduce((sum, intent) => sum + intent.amountKrw, 0);
}

export function netAcceptedInvestmentPrincipal(store: AppStore, userId: string) {
  return Math.max(
    acceptedInvestmentPrincipal(store, userId) - acceptedWithdrawalAmount(store, userId),
    0
  );
}

export function portfolioDrawdownRate(portfolio: PortfolioOverview) {
  const costBasisKrw = portfolioCostBasisKrw(portfolio.holdings);
  if (!costBasisKrw || costBasisKrw <= 0) return 0;

  return Math.min(0, (portfolio.totalMarketValueKrw - costBasisKrw) / costBasisKrw);
}

export function withdrawalLimitFromPrincipal(
  principalKrw: number,
  drawdownRate: number,
  pendingWithdrawalKrw = 0
): WithdrawalLimit {
  const normalizedPrincipal = Math.max(0, Math.floor(principalKrw));
  const normalizedPendingWithdrawal = Math.max(0, Math.floor(pendingWithdrawalKrw));
  const normalizedDrawdown = Math.min(0, Math.max(-1, drawdownRate));
  const drawdownAdjustedPrincipal = Math.floor(normalizedPrincipal * (1 + normalizedDrawdown));
  const maxAmountKrw = drawdownAdjustedPrincipal - normalizedPendingWithdrawal;

  return {
    principalKrw: normalizedPrincipal,
    pendingWithdrawalKrw: normalizedPendingWithdrawal,
    drawdownRate: normalizedDrawdown,
    maxAmountKrw: Math.max(0, Math.min(normalizedPrincipal, maxAmountKrw))
  };
}

export function withdrawalLimitForUser(store: AppStore, portfolio: PortfolioOverview, userId: string) {
  return withdrawalLimitFromPrincipal(
    netAcceptedInvestmentPrincipal(store, userId),
    portfolioDrawdownRate(portfolio),
    pendingWithdrawalAmount(store, userId)
  );
}
