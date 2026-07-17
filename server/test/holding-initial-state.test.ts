import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { holdingInitialState } from "../src/domain/holding-initial-state.js";

describe("holdingInitialState", () => {
  describe("given a newly registered USD holding with an opening balance", () => {
    describe("when its initial state is created", () => {
      it("then preserves quantity, cost basis, and purchase exchange rate", () => {
        const state = holdingInitialState({
          symbol: " schd ",
          name: "Schwab US Dividend Equity ETF",
          alias: " SCHD ",
          marketCountry: "NYSE",
          currency: "USD",
          quantity: 12.5,
          lastPrice: 28,
          averagePurchasePrice: 25,
          purchaseExchangeRate: 1_380,
          riskLevel: "LOW"
        });

        assert.deepEqual(state, {
          symbol: "SCHD",
          name: "Schwab US Dividend Equity ETF",
          alias: "SCHD",
          marketCountry: "NYSE",
          currency: "USD",
          quantity: 12.5,
          lastPrice: 28,
          averagePurchasePrice: 25,
          purchaseExchangeRate: 1_380,
          profitLossRate: 0.12,
          riskLevel: "LOW"
        });
      });
    });
  });

  describe("given a zero-quantity KRW holding", () => {
    describe("when its initial state is created", () => {
      it("then stores an empty cost basis without inventing an exchange rate", () => {
        const state = holdingInitialState({
          symbol: "005930",
          name: "삼성전자",
          marketCountry: "KOSPI",
          currency: "KRW",
          quantity: 0,
          lastPrice: 80_000
        });

        assert.equal(state.quantity, 0);
        assert.equal(state.averagePurchasePrice, null);
        assert.equal(state.purchaseExchangeRate, null);
        assert.equal(state.profitLossRate, null);
      });
    });
  });
});
