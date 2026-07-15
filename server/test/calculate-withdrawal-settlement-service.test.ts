import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CalculateWithdrawalSettlementService } from "../src/application/calculate-withdrawal-settlement-service.js";

describe("CalculateWithdrawalSettlementService", () => {
  describe("given losses are smaller than company first-loss capital", () => {
    describe("when deployed investor principal is withdrawn", () => {
      it("then pays the requested principal reduction in full", () => {
        const result = new CalculateWithdrawalSettlementService().execute({
          requestedPrincipalReductionKrw: 100_000,
          userPrincipalKrw: 100_000,
          totalInvestorPrincipalKrw: 100_000,
          portfolioNetAssetsKrw: 950_000,
          availableCashKrw: 100_000
        });

        assert.equal(result.status, "calculated");
        if (result.status !== "calculated") return;
        assert.equal(result.investorLossRate, 0);
        assert.equal(result.payableKrw, 100_000);
        assert.equal(result.principalReductionKrw, 100_000);
      });
    });
  });

  describe("given company first-loss capital is exhausted", () => {
    describe("when deployed investor principal is withdrawn", () => {
      it("then reduces the payout but extinguishes the requested principal amount", () => {
        const result = new CalculateWithdrawalSettlementService().execute({
          requestedPrincipalReductionKrw: 50_000,
          userPrincipalKrw: 100_000,
          totalInvestorPrincipalKrw: 100_000,
          portfolioNetAssetsKrw: 80_000,
          availableCashKrw: 50_000
        });

        assert.equal(result.status, "calculated");
        if (result.status !== "calculated") return;
        assert.equal(result.investorLossRate, -0.2);
        assert.equal(result.payableKrw, 40_000);
        assert.equal(result.principalReductionKrw, 50_000);
      });
    });
  });

  describe("given the portfolio has not produced enough settled cash", () => {
    describe("when a withdrawal is settled", () => {
      it("then stops without treating unsold assets as cash", () => {
        const result = new CalculateWithdrawalSettlementService().execute({
          requestedPrincipalReductionKrw: 50_000,
          userPrincipalKrw: 100_000,
          totalInvestorPrincipalKrw: 100_000,
          portfolioNetAssetsKrw: 100_000,
          availableCashKrw: 30_000
        });

        assert.equal(result.status, "insufficient_liquidity");
      });
    });
  });
});
