import type { AppStore } from "./types.js";

export type WithdrawalIntentReference = {
  acceptedNetInvestmentIntentKrw: number;
  pendingWithdrawalIntentKrw: number;
  maxRequestIntentKrw: number;
};

export function acceptedInvestmentIntentAmount(store: AppStore, userId: string) {
  return store.investmentIntents
    .filter((intent) => intent.userId === userId && intent.status === "ACCEPTED")
    .reduce((sum, intent) => sum + intent.amountKrw, 0);
}

export function acceptedWithdrawalIntentAmount(store: AppStore, userId: string) {
  return store.withdrawalIntents
    .filter((intent) => intent.userId === userId && intent.status === "ACCEPTED")
    .reduce((sum, intent) => sum + intent.amountKrw, 0);
}

export function pendingWithdrawalIntentAmount(store: AppStore, userId: string) {
  return store.withdrawalIntents
    .filter((intent) => intent.userId === userId && intent.status === "PENDING")
    .reduce((sum, intent) => sum + intent.amountKrw, 0);
}

export function withdrawalIntentReferenceFromAmounts(
  acceptedNetInvestmentIntentKrw: number,
  pendingWithdrawalIntentKrw = 0
): WithdrawalIntentReference {
  const acceptedNet = Math.max(0, Math.floor(acceptedNetInvestmentIntentKrw));
  const pending = Math.max(0, Math.floor(pendingWithdrawalIntentKrw));
  return {
    acceptedNetInvestmentIntentKrw: acceptedNet,
    pendingWithdrawalIntentKrw: pending,
    maxRequestIntentKrw: Math.max(acceptedNet - pending, 0)
  };
}

export function withdrawalIntentReferenceForUser(store: AppStore, userId: string) {
  const acceptedNet = Math.max(
    acceptedInvestmentIntentAmount(store, userId) - acceptedWithdrawalIntentAmount(store, userId),
    0
  );
  return withdrawalIntentReferenceFromAmounts(
    acceptedNet,
    pendingWithdrawalIntentAmount(store, userId)
  );
}
