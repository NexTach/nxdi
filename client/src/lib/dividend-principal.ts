type InvestmentIntent = {
  id: string;
  userId: string;
  amountKrw: number;
  updatedAt: string;
  eligibleFromMonth: string;
};

type WithdrawalIntent = {
  userId: string;
  amountKrw: number;
  acceptedAt: string;
};

function acceptanceMonth(acceptedAt: string) {
  const accepted = new Date(acceptedAt);
  if (Number.isNaN(accepted.getTime())) return undefined;
  return new Date(accepted.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

export function intentBasedDividendPrincipal<T extends InvestmentIntent>(
  investments: T[],
  withdrawals: WithdrawalIntent[],
  dividendMonth: string
) {
  const withdrawalByUser = new Map<string, number>();
  for (const withdrawal of withdrawals) {
    const month = acceptanceMonth(withdrawal.acceptedAt);
    if (!month || month > dividendMonth) continue;
    withdrawalByUser.set(
      withdrawal.userId,
      (withdrawalByUser.get(withdrawal.userId) ?? 0) + Math.max(0, withdrawal.amountKrw)
    );
  }

  const byUser = new Map<string, T[]>();
  for (const investment of investments.filter((item) => item.eligibleFromMonth <= dividendMonth)) {
    const entries = byUser.get(investment.userId) ?? [];
    entries.push(investment);
    byUser.set(investment.userId, entries);
  }

  const result: T[] = [];
  for (const [userId, entries] of byUser) {
    let withdrawal = withdrawalByUser.get(userId) ?? 0;
    for (const investment of entries.sort((left, right) =>
      left.updatedAt.localeCompare(right.updatedAt) || left.id.localeCompare(right.id)
    )) {
      const amountKrw = Math.max(0, investment.amountKrw - withdrawal);
      withdrawal = Math.max(0, withdrawal - investment.amountKrw);
      if (amountKrw > 0) result.push({ ...investment, amountKrw });
    }
  }
  return result;
}
