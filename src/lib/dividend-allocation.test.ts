import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PRODUCT_ANNUAL_INVESTOR_DIVIDEND_CAP_RATE,
  PRODUCT_COMPANY_DIVIDEND_TRANSFER_RATE,
  PRODUCT_MONTHLY_INVESTOR_DIVIDEND_CAP_RATE,
  calculateDividendAllocation,
  calculateExpectedInvestorDividend
} from "./dividend-allocation";

function assertNear(actual: number | undefined, expected: number) {
  if (typeof actual !== "number") assert.fail("expected a numeric value");
  assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} should be close to ${expected}`);
}

describe("calculateDividendAllocation", () => {
  it("allocates base dividends and limited company transfers to the selected investor", () => {
    const allocation = calculateDividendAllocation({
      actualDividendKrw: 100000,
      selectedInvestmentKrw: 50000000,
      investorPrincipalKrw: 100000000,
      totalMarketValueKrw: 200000000
    });

    assert.equal(allocation.companyDividendTransferRate, PRODUCT_COMPANY_DIVIDEND_TRANSFER_RATE);
    assert.equal(allocation.monthlyInvestorDividendCapRate, PRODUCT_MONTHLY_INVESTOR_DIVIDEND_CAP_RATE);
    assert.equal(allocation.companyPrincipalKrw, 100000000);
    assert.equal(allocation.dividendBaseKrw, 200000000);
    assert.equal(allocation.investorBaseWeight, 0.5);
    assert.equal(allocation.investorBaseDividendKrw, 50000);
    assert.equal(allocation.companyBaseDividendKrw, 50000);
    assert.equal(
      allocation.companyTransferNeedKrw,
      100000000 * PRODUCT_MONTHLY_INVESTOR_DIVIDEND_CAP_RATE - 50000
    );
    assert.equal(allocation.companyTransferLimitKrw, 10000);
    assert.equal(allocation.companyTransferredDividendKrw, 10000);
    assert.equal(allocation.investorDistributionPoolKrw, 60000);
    assert.equal(allocation.selectedInvestorWeight, 0.5);
    assert.equal(allocation.allocationKrw, 30000);
    assert.equal(allocation.companyRetainedDividendKrw, 40000);
  });

  it("caps investor distributions at the monthly investor dividend cap", () => {
    const allocation = calculateDividendAllocation({
      actualDividendKrw: 1000000,
      selectedInvestmentKrw: 200000000,
      investorPrincipalKrw: 100000000,
      totalMarketValueKrw: 100000000
    });

    assert.equal(
      allocation.investorDividendCapKrw,
      100000000 * PRODUCT_MONTHLY_INVESTOR_DIVIDEND_CAP_RATE
    );
    assert.equal(allocation.investorDistributionPoolKrw, allocation.investorDividendCapKrw);
    assert.equal(allocation.selectedInvestorWeight, 1);
    assert.equal(allocation.allocationKrw, allocation.investorDividendCapKrw);
  });

  it("normalizes invalid amounts and clamps override rates", () => {
    const allocation = calculateDividendAllocation({
      actualDividendKrw: 1000,
      selectedInvestmentKrw: Number.POSITIVE_INFINITY,
      investorPrincipalKrw: -1000,
      totalMarketValueKrw: 1000,
      companyDividendTransferRate: 2,
      monthlyInvestorDividendCapRate: -0.1
    });

    assert.equal(allocation.selectedInvestorWeight, 0);
    assert.equal(allocation.companyDividendTransferRate, 1);
    assert.equal(allocation.monthlyInvestorDividendCapRate, 0);
    assert.equal(allocation.investorDistributionPoolKrw, 0);
    assert.equal(allocation.allocationKrw, 0);
  });

  it("matches the published dividend policy examples", () => {
    const examples = [
      {
        actualDividendKrw: 2000,
        totalMarketValueKrw: 1250000,
        expectedDistributionPoolKrw: 1680,
        expectedCompanyRetainedDividendKrw: 320,
        expectedAllocationKrw: 168
      },
      {
        actualDividendKrw: 500,
        totalMarketValueKrw: 1250000,
        expectedDistributionPoolKrw: 420,
        expectedCompanyRetainedDividendKrw: 80,
        expectedAllocationKrw: 42
      },
      {
        actualDividendKrw: 5000,
        totalMarketValueKrw: 1250000,
        expectedDistributionPoolKrw: 4200,
        expectedCompanyRetainedDividendKrw: 800,
        expectedAllocationKrw: 420
      },
      {
        actualDividendKrw: 2000,
        totalMarketValueKrw: 950000,
        expectedDistributionPoolKrw: 2000,
        expectedCompanyRetainedDividendKrw: 0,
        expectedAllocationKrw: 200
      }
    ];

    for (const example of examples) {
      const allocation = calculateDividendAllocation({
        actualDividendKrw: example.actualDividendKrw,
        investorPrincipalKrw: 1000000,
        selectedInvestmentKrw: 100000,
        totalMarketValueKrw: example.totalMarketValueKrw
      });

      assert.equal(allocation.investorDistributionPoolKrw, example.expectedDistributionPoolKrw);
      assert.equal(allocation.companyRetainedDividendKrw, example.expectedCompanyRetainedDividendKrw);
      assert.equal(allocation.allocationKrw, example.expectedAllocationKrw);
    }
  });

  it("projects policy-adjusted investor payouts separately from portfolio yield", () => {
    const projection = calculateExpectedInvestorDividend({
      investmentKrw: 100000,
      currentPortfolioMarketValueKrw: 300000,
      annualPortfolioDividendYield: 0.04
    });

    assertNear(projection.monthlyExpectedDividendKrw, 533.3333333333334);
    assertNear(projection.annualExpectedDividendKrw, 6400);
    assertNear(projection.expectedAnnualPayoutRate, 0.064);
    assert.equal(projection.annualPayoutCapRate, PRODUCT_ANNUAL_INVESTOR_DIVIDEND_CAP_RATE);
  });

  it("allows small investments to reach but never exceed the annual 10 percent cap", () => {
    const projection = calculateExpectedInvestorDividend({
      investmentKrw: 10000,
      currentPortfolioMarketValueKrw: 300000,
      annualPortfolioDividendYield: 0.04
    });

    assertNear(projection.expectedAnnualPayoutRate, PRODUCT_ANNUAL_INVESTOR_DIVIDEND_CAP_RATE);
  });

  it("shares the investor distribution pool with existing accepted principal", () => {
    const projection = calculateExpectedInvestorDividend({
      investmentKrw: 100000,
      currentPortfolioMarketValueKrw: 300000,
      currentInvestorPrincipalKrw: 100000,
      annualPortfolioDividendYield: 0.04
    });

    assertNear(projection.monthlyExpectedDividendKrw, 400);
    assertNear(projection.expectedAnnualPayoutRate, 0.048);
  });
});
