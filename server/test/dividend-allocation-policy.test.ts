import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateDividendAllocation,
  calculateExpectedInvestorDividend,
  PRODUCT_ANNUAL_INVESTOR_DIVIDEND_CAP_RATE
} from "../src/domain/dividend-allocation.js";

describe("DividendAllocationPolicy", () => {
  describe("given investor and company principal with a company transfer allowance", () => {
    describe("when the investor base dividend is below the monthly cap", () => {
      it("then transfers only the allowed portion of the company dividend and allocates by investor weight", () => {
        const result = calculateDividendAllocation({
          actualDividendKrw: 1_000,
          selectedInvestmentKrw: 60_000,
          investorPrincipalKrw: 120_000,
          totalMarketValueKrw: 1_000_000
        });
        assert.equal(result.investorBaseDividendKrw, 120);
        assert.equal(result.companyTransferredDividendKrw, 176);
        assert.equal(result.managementFeeKrw, 14.8);
        assert.equal(result.investorDistributionPoolKrw, 281.2);
        assert.equal(result.allocationKrw, 140.6);
      });
    });
  });

  describe("given a high-yield portfolio", () => {
    describe("when expected investor payout is projected", () => {
      it("then never exceeds the product annual payout cap", () => {
        const result = calculateExpectedInvestorDividend({
          investmentKrw: 100_000,
          currentPortfolioMarketValueKrw: 1_000_000,
          annualPortfolioDividendYield: 0.12
        });
        assert.ok(result.expectedAnnualPayoutRate !== undefined);
        assert.ok(result.expectedAnnualPayoutRate <= PRODUCT_ANNUAL_INVESTOR_DIVIDEND_CAP_RATE);
      });
    });

    describe("when investor entitlement exceeds the monthly cash payout cap", () => {
      it("then credits the excess to investor reinvestment instead of company retained income", () => {
        const result = calculateDividendAllocation({
          actualDividendKrw: 20_000,
          selectedInvestmentKrw: 1_000_000,
          investorPrincipalKrw: 1_000_000,
          totalMarketValueKrw: 1_250_000
        }) as unknown as Record<string, number>;

        assert.equal(result.investorBaseDividendKrw, 16_000);
        assert.equal(result.managementFeeKrw, 800);
        assert.equal(result.investorDistributionPoolKrw, 15_000);
        assert.equal(result.investorReinvestmentPoolKrw, 200);
        assert.equal(result.companyRetainedDividendKrw, 4_800);
        assert.equal(
          result.investorDistributionPoolKrw +
            result.investorReinvestmentPoolKrw +
            result.companyRetainedDividendKrw,
          result.actualDividendKrw
        );
      });
    });
  });
});
