import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CalculateMonthlyDistributionSettlementService } from "../src/application/calculate-monthly-distribution-settlement-service.js";

describe("CalculateMonthlyDistributionSettlementService", () => {
  describe("given actual deployed principal for two investors", () => {
    describe("when the monthly distribution is settled", () => {
      it("then applies fee, cash cap, reinvestment and exact proportional allocation", () => {
        const result = new CalculateMonthlyDistributionSettlementService().execute({
          actualDividendKrw: 20_000,
          portfolioNetAssetsKrw: 1_250_000,
          investors: [
            { userId: "user-1", userName: "가", userEmail: "a@example.com", principalKrw: 600_000 },
            { userId: "user-2", userName: "나", userEmail: "b@example.com", principalKrw: 400_000 }
          ]
        });

        assert.equal(result.investorPrincipalKrw, 1_000_000);
        assert.equal(result.managementFeeKrw, 800);
        assert.equal(result.cashDistributionKrw, 15_000);
        assert.equal(result.reinvestmentCreditKrw, 200);
        assert.equal(result.companyRetainedKrw, 4_800);
        assert.deepEqual(result.allocations.map((item) => ({
          userId: item.userId,
          cashDistributionKrw: item.cashDistributionKrw,
          reinvestmentCreditKrw: item.reinvestmentCreditKrw,
          managementFeeKrw: item.managementFeeKrw
        })), [
          { userId: "user-1", cashDistributionKrw: 9_000, reinvestmentCreditKrw: 120, managementFeeKrw: 480 },
          { userId: "user-2", cashDistributionKrw: 6_000, reinvestmentCreditKrw: 80, managementFeeKrw: 320 }
        ]);
      });
    });
  });

  describe("given intention amounts but no deployed investor principal", () => {
    describe("when the monthly distribution is settled", () => {
      it("then creates no investor distribution or fee", () => {
        const result = new CalculateMonthlyDistributionSettlementService().execute({
          actualDividendKrw: 20_000,
          portfolioNetAssetsKrw: 1_250_000,
          investors: []
        });

        assert.equal(result.investorPrincipalKrw, 0);
        assert.equal(result.cashDistributionKrw, 0);
        assert.equal(result.reinvestmentCreditKrw, 0);
        assert.equal(result.managementFeeKrw, 0);
        assert.equal(result.companyRetainedKrw, 20_000);
      });
    });
  });

  describe("given a whole-won formula remainder and an eligible investor", () => {
    describe("when the monthly distribution is settled", () => {
      it("then credits the remainder to investor reinvestment instead of company income", () => {
        const result = new CalculateMonthlyDistributionSettlementService().execute({
          actualDividendKrw: 1,
          portfolioNetAssetsKrw: 300,
          investors: [
            { userId: "user-1", userName: "가", userEmail: "a@example.com", principalKrw: 100 }
          ]
        });

        assert.equal(result.cashDistributionKrw, 0);
        assert.equal(result.reinvestmentCreditKrw, 1);
        assert.equal(result.companyRetainedKrw, 0);
        assert.equal(result.roundingCarryKrw, 0);
        assert.equal(result.allocations[0]?.reinvestmentCreditKrw, 1);
      });
    });
  });
});
