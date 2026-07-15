import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AllocatePurchaseCapitalService } from "../src/application/allocate-purchase-capital-service.js";

describe("AllocatePurchaseCapitalService", () => {
  describe("given accepted intentions but no contract-deposit capital source", () => {
    describe("when a purchase is executed", () => {
      it("then allocates none of the purchase to investor deployed principal", () => {
        const result = new AllocatePurchaseCapitalService().execute({
          purchaseCostKrw: 60_000,
          sources: []
        });

        assert.deepEqual(result.allocations, []);
        assert.equal(result.investorDeployedKrw, 0);
        assert.equal(result.nonInvestorFundedKrw, 60_000);
      });
    });
  });

  describe("given contract deposits and reinvestment cash waiting for deployment", () => {
    describe("when a purchase is executed", () => {
      it("then consumes available sources FIFO and leaves the remainder un-deployed", () => {
        const result = new AllocatePurchaseCapitalService().execute({
          purchaseCostKrw: 120_000,
          sources: [
            { id: "deposit-old", userId: "user-1", availableKrw: 70_000, availableAt: "2026-07-01T00:00:00.000Z" },
            { id: "reinvest", userId: "user-1", availableKrw: 20_000, availableAt: "2026-07-02T00:00:00.000Z" },
            { id: "deposit-new", userId: "user-2", availableKrw: 50_000, availableAt: "2026-07-03T00:00:00.000Z" }
          ]
        });

        assert.deepEqual(result.allocations, [
          { sourceId: "deposit-old", userId: "user-1", amountKrw: 70_000 },
          { sourceId: "reinvest", userId: "user-1", amountKrw: 20_000 },
          { sourceId: "deposit-new", userId: "user-2", amountKrw: 30_000 }
        ]);
        assert.equal(result.investorDeployedKrw, 120_000);
        assert.equal(result.nonInvestorFundedKrw, 0);
      });
    });
  });
});
