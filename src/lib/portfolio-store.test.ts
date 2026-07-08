import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { portfolioSnapshotDate, previousPortfolioSnapshotDate } from "./portfolio-store";

describe("portfolio snapshot dates", () => {
  it("uses the Korea Standard Time calendar date", () => {
    assert.equal(portfolioSnapshotDate(new Date("2026-07-08T14:59:00.000Z")), "2026-07-08");
    assert.equal(portfolioSnapshotDate(new Date("2026-07-08T15:00:00.000Z")), "2026-07-09");
  });

  it("selects the previous Korea Standard Time date after midnight", () => {
    assert.equal(previousPortfolioSnapshotDate(new Date("2026-07-08T15:10:00.000Z")), "2026-07-08");
  });
});
