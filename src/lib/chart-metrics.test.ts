import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { portfolioChangeRateFromMarketValue } from "./chart-metrics";
import type { MarketChart } from "./market-data";
import type { Holding } from "./types";

function holding(overrides: Partial<Holding>): Holding {
  return {
    symbol: "TEST",
    name: "Test",
    marketCountry: "KOSPI",
    currency: "KRW",
    quantity: 10,
    lastPrice: 110,
    marketValue: 1100,
    marketValueKrw: 1100,
    ...overrides
  };
}

function chart(overrides: Partial<MarketChart>): MarketChart {
  return {
    symbol: "TEST",
    currency: "KRW",
    marketCountry: "KOSPI",
    previousClose: 100,
    candles: [
      { date: "2026-01-01T00:00:00.000Z", open: 90, high: 105, low: 85, close: 100 },
      { date: "2026-01-02T00:00:00.000Z", open: 100, high: 999, low: 95, close: 999 }
    ],
    ...overrides
  };
}

describe("portfolioChangeRateFromMarketValue", () => {
  it("uses current holding market value instead of the latest chart close", () => {
    const rate = portfolioChangeRateFromMarketValue({
      holdings: [holding({})],
      charts: new Map([["TEST", chart({})]]),
      exchangeRate: 1300
    });

    assert.equal(rate, 0.1);
  });

  it("prefers the previous candle close over range chartPreviousClose", () => {
    const rate = portfolioChangeRateFromMarketValue({
      holdings: [holding({})],
      charts: new Map([["TEST", chart({ previousClose: 80 })]]),
      exchangeRate: 1300
    });

    assert.equal(rate, 0.1);
  });

  it("uses current exchange rate for USD previous market value", () => {
    const rate = portfolioChangeRateFromMarketValue({
      holdings: [
        holding({
          currency: "USD",
          marketCountry: "NASDAQ",
          quantity: 2,
          lastPrice: 55,
          marketValue: 110,
          marketValueKrw: 143000
        })
      ],
      charts: new Map([[
        "TEST",
        chart({
          currency: "USD",
          marketCountry: "NASDAQ",
          previousClose: 45,
          candles: [
            { date: "2026-01-01T00:00:00.000Z", open: 45, high: 55, low: 44, close: 50 },
            { date: "2026-01-02T00:00:00.000Z", open: 50, high: 60, low: 49, close: 60 }
          ]
        })
      ]]),
      exchangeRate: 1300
    });

    assert.equal(rate, 0.1);
  });

  it("falls back to the previous candle close when chart previousClose is missing", () => {
    const rate = portfolioChangeRateFromMarketValue({
      holdings: [holding({})],
      charts: new Map([["TEST", chart({ previousClose: undefined })]]),
      exchangeRate: 1300
    });

    assert.equal(rate, 0.1);
  });
});
