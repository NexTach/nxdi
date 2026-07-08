import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cronAuthorized } from "./cron-auth";

function withCronEnv(
  env: {
    CRON_SECRET?: string;
    PORTFOLIO_SNAPSHOT_SECRET?: string;
  },
  callback: () => void
) {
  const previousCronSecret = process.env.CRON_SECRET;
  const previousPortfolioSecret = process.env.PORTFOLIO_SNAPSHOT_SECRET;

  setOptionalEnv("CRON_SECRET", env.CRON_SECRET);
  setOptionalEnv("PORTFOLIO_SNAPSHOT_SECRET", env.PORTFOLIO_SNAPSHOT_SECRET);

  try {
    callback();
  } finally {
    setOptionalEnv("CRON_SECRET", previousCronSecret);
    setOptionalEnv("PORTFOLIO_SNAPSHOT_SECRET", previousPortfolioSecret);
  }
}

function setOptionalEnv(name: "CRON_SECRET" | "PORTFOLIO_SNAPSHOT_SECRET", value?: string) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

describe("cronAuthorized", () => {
  it("accepts the Vercel CRON_SECRET bearer token", () => {
    withCronEnv({ CRON_SECRET: "cron-secret" }, () => {
      const request = new Request("https://example.com/api/cron/portfolio/refresh", {
        headers: { authorization: "Bearer cron-secret" }
      });

      assert.equal(cronAuthorized(request), true);
    });
  });

  it("keeps the portfolio snapshot query secret for manual calls", () => {
    withCronEnv({ PORTFOLIO_SNAPSHOT_SECRET: "snapshot-secret" }, () => {
      const request = new Request("https://example.com/api/admin/portfolio/snapshot/finalize?secret=snapshot-secret");

      assert.equal(cronAuthorized(request), true);
    });
  });

  it("rejects requests when no cron secret is configured", () => {
    withCronEnv({}, () => {
      const request = new Request("https://example.com/api/cron/portfolio/refresh", {
        headers: { authorization: "Bearer cron-secret" }
      });

      assert.equal(cronAuthorized(request), false);
    });
  });
});
