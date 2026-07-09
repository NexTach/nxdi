import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PRODUCT_COMPANY_DIVIDEND_TRANSFER_RATE,
  PRODUCT_MONTHLY_INVESTOR_DIVIDEND_CAP_RATE,
  calculateDividendAllocation
} from "./dividend-allocation";

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
    assert.equal(allocation.companyTransferNeedKrw, 200000);
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
      totalMarketValueKrw: 200000000
    });

    assert.equal(allocation.investorDividendCapKrw, 250000);
    assert.equal(allocation.investorDistributionPoolKrw, 250000);
    assert.equal(allocation.selectedInvestorWeight, 1);
    assert.equal(allocation.allocationKrw, 250000);
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
});
