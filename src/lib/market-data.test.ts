import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { fetchDividendRecordFromMarket, fetchMarketCandles, fetchMarketQuote } from "./market-data";

const originalFetch = globalThis.fetch;
const originalFmpApiKey = process.env.FMP_API_KEY;
const originalOpenDartApiKey = process.env.OPENDART_API_KEY;
const originalDartApiKey = process.env.DART_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.FMP_API_KEY = originalFmpApiKey;
  process.env.OPENDART_API_KEY = originalOpenDartApiKey;
  process.env.DART_API_KEY = originalDartApiKey;
});

function mockYahooChartFetch(capturedUrls: string[]) {
  globalThis.fetch = async (input) => {
    capturedUrls.push(String(input));
    return new Response(JSON.stringify({
      chart: {
        result: [
          {
            meta: {
              symbol: "123456.KQ",
              currency: "KRW",
              fullExchangeName: "KOSDAQ"
            },
            timestamp: [1767225600],
            indicators: {
              quote: [
                {
                  open: [100],
                  high: [110],
                  low: [90],
                  close: [105]
                }
              ]
            }
          }
        ]
      }
    }));
  };
}

describe("fetchMarketCandles", () => {
  it("preserves an explicit KOSDAQ suffix when building the Yahoo lookup symbol", async () => {
    const capturedUrls: string[] = [];
    mockYahooChartFetch(capturedUrls);

    await fetchMarketCandles("123456.KQ", { range: "1mo", interval: "1d", limit: 1 });

    assert.equal(new URL(capturedUrls[0]).pathname.endsWith("/123456.KQ"), true);
  });
});

describe("fetchMarketQuote", () => {
  it("tries KOSDAQ when an unsuffixed Korean code is not found on KOSPI", async () => {
    const capturedUrls: string[] = [];
    globalThis.fetch = async (input) => {
      const url = String(input);
      capturedUrls.push(url);

      if (url.includes("123456.KS")) {
        return new Response("not found", { status: 404 });
      }

      return new Response(JSON.stringify({
        chart: {
          result: [
            {
              meta: {
                symbol: "123456.KQ",
                currency: "KRW",
                fullExchangeName: "KOSDAQ",
                regularMarketPrice: 1000,
                shortName: "KQ Test"
              }
            }
          ]
        }
      }));
    };

    const quote = await fetchMarketQuote("123456");

    assert.equal(new URL(capturedUrls[0]).pathname.endsWith("/123456.KS"), true);
    assert.equal(new URL(capturedUrls[1]).pathname.endsWith("/123456.KQ"), true);
    assert.equal(quote?.symbol, "123456.KQ");
    assert.equal(quote?.marketCountry, "KOSDAQ");
  });
});

describe("fetchDividendRecordFromMarket", () => {
  it("uses only the latest trailing year for Yahoo annual dividend estimates", async () => {
    process.env.FMP_API_KEY = "";
    process.env.OPENDART_API_KEY = "";
    process.env.DART_API_KEY = "";

    globalThis.fetch = async () => new Response(JSON.stringify({
      chart: {
        result: [
          {
            meta: {
              symbol: "123456.KS",
              currency: "KRW",
              regularMarketPrice: 10000
            },
            events: {
              dividends: {
                "1": { amount: 100, date: Date.UTC(2026, 2, 1) / 1000 },
                "2": { amount: 100, date: Date.UTC(2025, 2, 1) / 1000 },
                "3": { amount: 100, date: Date.UTC(2024, 2, 1) / 1000 },
                "4": { amount: 100, date: Date.UTC(2023, 2, 1) / 1000 }
              }
            }
          }
        ]
      }
    }));

    const record = await fetchDividendRecordFromMarket("123456");

    assert.equal(record?.annualDividendPerShare, 100);
    assert.equal(record?.trailingYield, 0.01);
  });
});
