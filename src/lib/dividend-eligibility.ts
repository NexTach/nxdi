const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function dividendAcceptanceMonth(updatedAt: string) {
  const acceptedAt = new Date(updatedAt);
  if (Number.isNaN(acceptedAt.getTime())) return undefined;
  return new Date(acceptedAt.getTime() + KST_OFFSET_MS).toISOString().slice(0, 7);
}

export function isEligibleForDividendMonth(updatedAt: string, dividendMonth: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(dividendMonth)) return false;
  const acceptedMonth = dividendAcceptanceMonth(updatedAt);
  return typeof acceptedMonth === "string" && acceptedMonth < dividendMonth;
}

export function eligibleDividendIntents<T extends { updatedAt: string }>(
  intents: T[],
  dividendMonth: string
) {
  return intents.filter((intent) => isEligibleForDividendMonth(intent.updatedAt, dividendMonth));
}
