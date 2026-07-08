import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { holdingCostBasisKrw, portfolioCostBasisKrw } from "./portfolio-math";
import type { Holding } from "./types";

function holding(overrides: Partial<Holding>): Holding {
  return {
    symbol: "TEST",
    name: "Test",
    marketCountry: "NASDAQ",
    currency: "USD",
    quantity: 10,
    lastPrice: 12,
    averagePurchasePrice: 10,
    marketValue: 120,
    marketValueKrw: 156000,
    ...overrides
  };
}

describe("holdingCostBasisKrw", () => {
  it("requires purchase exchange rate for USD cost basis", () => {
    assert.equal(holdingCostBasisKrw(holding({ purchaseExchangeRate: undefined })), undefined);
  });

  it("uses purchase exchange rate for USD cost basis", () => {
    assert.equal(holdingCostBasisKrw(holding({ purchaseExchangeRate: 1000 })), 100000);
  });

  it("does not require exchange rate for KRW cost basis", () => {
    assert.equal(holdingCostBasisKrw(holding({
      currency: "KRW",
      marketCountry: "KOSPI",
      marketValue: 120000,
      marketValueKrw: 120000,
      purchaseExchangeRate: undefined
    })), 100);
  });
});

describe("portfolioCostBasisKrw", () => {
  it("does not estimate portfolio cost basis from partial holding coverage", () => {
    assert.equal(portfolioCostBasisKrw([
      holding({ symbol: "A", purchaseExchangeRate: 1000 }),
      holding({ symbol: "B", purchaseExchangeRate: undefined })
    ]), undefined);
  });
});
