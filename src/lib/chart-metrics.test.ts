import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  candlesFromSnapshots,
  changeRateFromSnapshots,
  dividendYieldCandlesFromSnapshots,
  holdingDividendYieldCandles,
  holdingReturnCandles,
  portfolioChangeRateFromMarketValue,
  pointsFromSnapshots,
  returnCandlesFromSnapshots
} from "./chart-metrics";
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

  it("does not estimate a total rate from partial holding coverage", () => {
    const rate = portfolioChangeRateFromMarketValue({
      holdings: [
        holding({}),
        holding({
          symbol: "MISS",
          name: "Missing",
          quantity: 10,
          lastPrice: 50,
          marketValue: 500,
          marketValueKrw: 500
        })
      ],
      charts: new Map([["TEST", chart({})]]),
      exchangeRate: 1300
    });

    assert.equal(rate, undefined);
  });
});

describe("changeRateFromSnapshots", () => {
  it("does not estimate from unclosed previous snapshots", () => {
    const rate = changeRateFromSnapshots([
      {
        date: "2026-07-07",
        totalMarketValueKrw: 100000,
        exchangeRate: 1300,
        createdAt: "2026-07-07T00:00:00.000Z",
        updatedAt: "2026-07-07T00:00:00.000Z"
      },
      {
        date: "2026-07-08",
        totalMarketValueKrw: 102500,
        exchangeRate: 1310,
        createdAt: "2026-07-08T00:00:00.000Z",
        updatedAt: "2026-07-08T00:00:00.000Z"
      }
    ]);

    assert.equal(rate, undefined);
  });

  it("compares the latest market value with the previous closed market value", () => {
    const rate = changeRateFromSnapshots([
      {
        date: "2026-07-07",
        totalMarketValueKrw: 100000,
        exchangeRate: 1300,
        closeTotalMarketValueKrw: 101000,
        closeExchangeRate: 1300,
        closedAt: "2026-07-07T14:55:00.000Z",
        createdAt: "2026-07-07T00:00:00.000Z",
        updatedAt: "2026-07-07T14:55:00.000Z"
      },
      {
        date: "2026-07-08",
        totalMarketValueKrw: 102010,
        exchangeRate: 1310,
        closeTotalMarketValueKrw: 99000,
        closeExchangeRate: 1310,
        closedAt: "2026-07-08T14:55:00.000Z",
        createdAt: "2026-07-08T00:00:00.000Z",
        updatedAt: "2026-07-08T14:55:00.000Z"
      }
    ]);

    assert.equal(rate, 0.01);
  });

  it("does not estimate a rate when fewer than two snapshots exist", () => {
    const rate = changeRateFromSnapshots([
      {
        date: "2026-07-08",
        totalMarketValueKrw: 102500,
        exchangeRate: 1310,
        createdAt: "2026-07-08T00:00:00.000Z",
        updatedAt: "2026-07-08T00:00:00.000Z"
      }
    ]);

    assert.equal(rate, undefined);
  });
});

describe("snapshot market value series", () => {
  it("uses closed values for historical points and latest values for the current point", () => {
    const snapshots = [
      {
        date: "2026-07-07",
        totalMarketValueKrw: 100000,
        exchangeRate: 1300,
        closeTotalMarketValueKrw: 101000,
        closeExchangeRate: 1300,
        closedAt: "2026-07-07T14:55:00.000Z",
        createdAt: "2026-07-07T00:00:00.000Z",
        updatedAt: "2026-07-07T14:55:00.000Z"
      },
      {
        date: "2026-07-08",
        totalMarketValueKrw: 102500,
        exchangeRate: 1310,
        closeTotalMarketValueKrw: 99000,
        closeExchangeRate: 1310,
        closedAt: "2026-07-08T14:55:00.000Z",
        createdAt: "2026-07-08T00:00:00.000Z",
        updatedAt: "2026-07-08T14:55:00.000Z"
      }
    ];

    assert.deepEqual(pointsFromSnapshots(snapshots), [
      { date: "2026-07-07", value: 101000 },
      { date: "2026-07-08", value: 102500 }
    ]);
    assert.equal(candlesFromSnapshots(snapshots)[0].close, 101000);
    assert.equal(candlesFromSnapshots(snapshots)[1].close, 102500);
  });

  it("omits unclosed historical points instead of using stale values", () => {
    const snapshots = [
      {
        date: "2026-07-07",
        totalMarketValueKrw: 100000,
        exchangeRate: 1300,
        createdAt: "2026-07-07T00:00:00.000Z",
        updatedAt: "2026-07-07T12:00:00.000Z"
      },
      {
        date: "2026-07-08",
        totalMarketValueKrw: 102500,
        exchangeRate: 1310,
        createdAt: "2026-07-08T00:00:00.000Z",
        updatedAt: "2026-07-08T12:00:00.000Z"
      }
    ];

    assert.deepEqual(pointsFromSnapshots(snapshots), [
      { date: "2026-07-08", value: 102500 }
    ]);
    assert.deepEqual(candlesFromSnapshots(snapshots).map((candle) => candle.date), ["2026-07-08"]);
  });
});

describe("returnCandlesFromSnapshots", () => {
  it("uses stored market value and cost basis snapshots", () => {
    const candles = returnCandlesFromSnapshots([
      {
        date: "2026-07-08",
        totalMarketValueKrw: 143000,
        exchangeRate: 1300,
        costBasisKrw: 100000,
        annualDividendKrw: 5000,
        createdAt: "2026-07-08T00:00:00.000Z",
        updatedAt: "2026-07-08T00:00:00.000Z"
      }
    ]);

    assert.equal(candles[0].close, 0.43);
  });

  it("uses closed market value and closed cost basis for historical returns", () => {
    const candles = returnCandlesFromSnapshots([
      {
        date: "2026-07-07",
        totalMarketValueKrw: 100000,
        exchangeRate: 1300,
        costBasisKrw: 50000,
        closeTotalMarketValueKrw: 90000,
        closeExchangeRate: 1300,
        closeCostBasisKrw: 60000,
        closedAt: "2026-07-07T14:55:00.000Z",
        createdAt: "2026-07-07T00:00:00.000Z",
        updatedAt: "2026-07-07T14:55:00.000Z"
      },
      {
        date: "2026-07-08",
        totalMarketValueKrw: 120000,
        exchangeRate: 1310,
        costBasisKrw: 100000,
        closeTotalMarketValueKrw: 1,
        closeExchangeRate: 1310,
        closeCostBasisKrw: 1,
        closedAt: "2026-07-08T14:55:00.000Z",
        createdAt: "2026-07-08T00:00:00.000Z",
        updatedAt: "2026-07-08T14:55:00.000Z"
      }
    ]);

    assert.equal(candles[0].close, 0.5);
    assert.equal(candles[1].close, 0.2);
  });
});

describe("dividendYieldCandlesFromSnapshots", () => {
  it("uses stored annual dividend and market value snapshots", () => {
    const candles = dividendYieldCandlesFromSnapshots([
      {
        date: "2026-07-08",
        totalMarketValueKrw: 143000,
        exchangeRate: 1300,
        costBasisKrw: 100000,
        annualDividendKrw: 7150,
        createdAt: "2026-07-08T00:00:00.000Z",
        updatedAt: "2026-07-08T00:00:00.000Z"
      }
    ]);

    assert.equal(candles[0].close, 0.05);
  });

  it("uses closed annual dividend and closed market value for historical dividend yield", () => {
    const candles = dividendYieldCandlesFromSnapshots([
      {
        date: "2026-07-07",
        totalMarketValueKrw: 100000,
        exchangeRate: 1300,
        annualDividendKrw: 10000,
        closeTotalMarketValueKrw: 120000,
        closeExchangeRate: 1300,
        closeAnnualDividendKrw: 6000,
        closedAt: "2026-07-07T14:55:00.000Z",
        createdAt: "2026-07-07T00:00:00.000Z",
        updatedAt: "2026-07-07T14:55:00.000Z"
      },
      {
        date: "2026-07-08",
        totalMarketValueKrw: 200000,
        exchangeRate: 1310,
        annualDividendKrw: 10000,
        closeTotalMarketValueKrw: 1,
        closeExchangeRate: 1310,
        closeAnnualDividendKrw: 1,
        closedAt: "2026-07-08T14:55:00.000Z",
        createdAt: "2026-07-08T00:00:00.000Z",
        updatedAt: "2026-07-08T14:55:00.000Z"
      }
    ]);

    assert.equal(candles[0].close, 0.05);
    assert.equal(candles[1].close, 0.05);
  });
});

describe("holdingReturnCandles", () => {
  it("uses current exchange rate for market value and purchase exchange rate for cost basis", () => {
    const candles = holdingReturnCandles(
      [{ date: "2026-01-02T00:00:00.000Z", open: 10, high: 12, low: 9, close: 11 }],
      holding({
        currency: "USD",
        marketCountry: "NASDAQ",
        quantity: 2,
        averagePurchasePrice: 10,
        purchaseExchangeRate: 1000
      }),
      1300
    );

    assert.equal(candles[0].close, 0.43);
  });
});

describe("holdingDividendYieldCandles", () => {
  it("uses current exchange rate adjusted holding market value as denominator", () => {
    const candles = holdingDividendYieldCandles(
      [{ date: "2026-01-02T00:00:00.000Z", open: 10, high: 12, low: 9, close: 11 }],
      2860,
      holding({
        currency: "USD",
        marketCountry: "NASDAQ",
        quantity: 2
      }),
      1300
    );

    assert.equal(candles[0].close, 0.1);
  });
});
