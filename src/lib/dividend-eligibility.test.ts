import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eligibleDividendIntents, isEligibleForDividendMonth } from "./dividend-eligibility";

describe("isEligibleForDividendMonth", () => {
  it("starts dividend eligibility in the month after acceptance in KST", () => {
    const acceptedAt = "2026-07-31T14:59:59.000Z";

    assert.equal(isEligibleForDividendMonth(acceptedAt, "2026-07"), false);
    assert.equal(isEligibleForDividendMonth(acceptedAt, "2026-08"), true);
  });

  it("uses the KST calendar month across the UTC date boundary", () => {
    const acceptedAt = "2026-07-31T15:00:00.000Z";

    assert.equal(isEligibleForDividendMonth(acceptedAt, "2026-08"), false);
    assert.equal(isEligibleForDividendMonth(acceptedAt, "2026-09"), true);
  });

  it("rejects invalid dates and dividend months", () => {
    assert.equal(isEligibleForDividendMonth("invalid", "2026-08"), false);
    assert.equal(isEligibleForDividendMonth("2026-07-01T00:00:00.000Z", "2026-13"), false);
  });
});

describe("eligibleDividendIntents", () => {
  it("filters out intents accepted in or after the payout month", () => {
    const intents = [
      { id: "eligible", updatedAt: "2026-06-30T14:59:59.000Z" },
      { id: "next-month", updatedAt: "2026-07-01T00:00:00.000Z" }
    ];

    assert.deepEqual(eligibleDividendIntents(intents, "2026-07").map((intent) => intent.id), ["eligible"]);
  });
});
