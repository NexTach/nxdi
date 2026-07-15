export type DeployableCapitalSource = {
  id: string;
  userId: string;
  availableKrw: number;
  availableAt: string;
};

export class AllocatePurchaseCapitalService {
  execute(input: { purchaseCostKrw: number; sources: DeployableCapitalSource[] }) {
    const purchaseCostKrw = Math.max(0, Math.floor(input.purchaseCostKrw));
    let remainingPurchaseKrw = purchaseCostKrw;
    const allocations: Array<{ sourceId: string; userId: string; amountKrw: number }> = [];
    const sources = [...input.sources].sort((left, right) =>
      left.availableAt.localeCompare(right.availableAt) || left.id.localeCompare(right.id)
    );

    for (const source of sources) {
      if (remainingPurchaseKrw <= 0) break;
      const availableKrw = Math.max(0, Math.floor(source.availableKrw));
      const amountKrw = Math.min(availableKrw, remainingPurchaseKrw);
      if (amountKrw <= 0) continue;
      allocations.push({ sourceId: source.id, userId: source.userId, amountKrw });
      remainingPurchaseKrw -= amountKrw;
    }

    return {
      purchaseCostKrw,
      allocations,
      investorDeployedKrw: purchaseCostKrw - remainingPurchaseKrw,
      nonInvestorFundedKrw: remainingPurchaseKrw
    };
  }
}
