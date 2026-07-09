import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeManualPortfolioStore,
  portfolioSnapshotDate,
  previousPortfolioSnapshotDate
} from "./portfolio-store";
import type { Holding, ManualPortfolioStore } from "./types";

function holding(overrides: Partial<Holding>): Holding {
  return {
    symbol: "SCHD",
    name: "Schwab US Dividend Equity ETF",
    marketCountry: "NASDAQ",
    currency: "USD",
    quantity: 1,
    lastPrice: 100,
    marketValue: 0,
    marketValueKrw: 0,
    profitLossRate: 0,
    ...overrides
  };
}

describe("portfolio snapshot dates", () => {
  it("uses the Korea Standard Time calendar date", () => {
    assert.equal(portfolioSnapshotDate(new Date("2026-07-08T14:59:00.000Z")), "2026-07-08");
    assert.equal(portfolioSnapshotDate(new Date("2026-07-08T15:00:00.000Z")), "2026-07-09");
  });

  it("selects the previous Korea Standard Time date after midnight", () => {
    assert.equal(previousPortfolioSnapshotDate(new Date("2026-07-08T15:10:00.000Z")), "2026-07-08");
  });
});

describe("normalizeManualPortfolioStore", () => {
  it("sorts holdings by KRW market value descending", () => {
    const store: ManualPortfolioStore = {
      exchangeRate: 1400,
      updatedAt: "2026-07-09T00:00:00.000Z",
      holdings: [
        holding({
          symbol: "LOW",
          name: "Low Value",
          currency: "KRW",
          marketCountry: "KOSPI",
          quantity: 1,
          lastPrice: 10000
        }),
        holding({
          symbol: "ZZZ",
          name: "Tie Value Z",
          currency: "KRW",
          marketCountry: "KOSPI",
          quantity: 2,
          lastPrice: 10000
        }),
        holding({
          symbol: "USD",
          name: "USD Value",
          currency: "USD",
          marketCountry: "NASDAQ",
          quantity: 10,
          lastPrice: 2
        }),
        holding({
          symbol: "AAA",
          name: "Tie Value A",
          currency: "KRW",
          marketCountry: "KOSPI",
          quantity: 2,
          lastPrice: 10000
        })
      ]
    };

    const normalized = normalizeManualPortfolioStore(store);

    assert.deepEqual(
      normalized.holdings.map((item) => item.symbol),
      ["USD", "AAA", "ZZZ", "LOW"]
    );
    assert.equal(normalized.holdings[0].marketValueKrw, 28000);
  });
});
