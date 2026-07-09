import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isKoreanStock, stockFullLabel, stockPrimaryLabel, stockSecondaryLabel } from "./stock-display";

describe("isKoreanStock", () => {
  it("detects Korean stocks by currency, market, and six digit symbols", () => {
    assert.equal(isKoreanStock({ symbol: "AAPL", currency: "KRW" }), true);
    assert.equal(isKoreanStock({ symbol: "AAPL", marketCountry: "KOSPI" }), true);
    assert.equal(isKoreanStock({ symbol: "123456" }), true);
    assert.equal(isKoreanStock({ symbol: "123456.KQ" }), true);
    assert.equal(isKoreanStock({ symbol: "AAPL", marketCountry: "NASDAQ", currency: "USD" }), false);
  });
});

describe("stock labels", () => {
  it("uses a cleaned Korean company name as the primary label and symbol as secondary", () => {
    const stock = {
      symbol: "005930",
      name: "005930 - 삼성전자",
      marketCountry: "KOSPI" as const,
      currency: "KRW" as const
    };

    assert.equal(stockPrimaryLabel(stock), "삼성전자");
    assert.equal(stockSecondaryLabel(stock), "005930");
    assert.equal(stockFullLabel(stock), "삼성전자 (005930)");
  });

  it("uses aliases as primary labels while preserving the cleaned original name", () => {
    const stock = {
      symbol: "005930",
      name: "삼성전자",
      alias: "삼성",
      marketCountry: "KOSPI" as const,
      currency: "KRW" as const
    };

    assert.equal(stockPrimaryLabel(stock), "삼성");
    assert.equal(stockSecondaryLabel(stock), "삼성전자");
    assert.equal(stockFullLabel(stock), "삼성 (삼성전자)");
  });

  it("keeps foreign stock symbols primary and uses cleaned names as secondary labels", () => {
    const stock = {
      symbol: "AAPL",
      name: "AAPL: Apple Inc.",
      marketCountry: "NASDAQ" as const,
      currency: "USD" as const
    };

    assert.equal(stockPrimaryLabel(stock), "AAPL");
    assert.equal(stockSecondaryLabel(stock), "Apple Inc.");
    assert.equal(stockFullLabel(stock), "AAPL (Apple Inc.)");
  });
});
