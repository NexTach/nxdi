import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { exactPortfolioHolding, searchPortfolioHoldings, type HoldingSearchItem } from "./holding-search";

const holdings: HoldingSearchItem[] = [
  { symbol: "SCHD", name: "Schwab US Dividend Equity ETF" },
  { symbol: "SCHE", name: "Schwab Emerging Markets Equity ETF" },
  { symbol: "005930", name: "삼성전자", alias: "삼성" },
  { symbol: "JEPI", name: "JPMorgan Equity Premium Income ETF" }
];

describe("운용 포트폴리오 종목 검색", () => {
  it("티커의 일부가 일치하는 운용 종목을 반환한다", () => {
    assert.deepEqual(
      searchPortfolioHoldings(holdings, "sc").map((holding) => holding.symbol),
      ["SCHD", "SCHE"]
    );
  });

  it("종목명과 별칭도 대소문자 구분 없이 검색한다", () => {
    assert.equal(searchPortfolioHoldings(holdings, "premium")[0]?.symbol, "JEPI");
    assert.equal(searchPortfolioHoldings(holdings, "삼성")[0]?.symbol, "005930");
  });

  it("제출값은 정확한 티커에만 대응시킨다", () => {
    assert.equal(exactPortfolioHolding(holdings, " schd ")?.symbol, "SCHD");
    assert.equal(exactPortfolioHolding(holdings, "sch"), undefined);
  });
});
