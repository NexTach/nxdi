import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { appBaseUrl, isProduction, requiredEnv } from "./env";

const previousNodeEnv = process.env.NODE_ENV;
const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const previousRequiredValue = process.env.TEST_REQUIRED_ENV;

afterEach(() => {
  setOptionalEnv("NODE_ENV", previousNodeEnv);
  setOptionalEnv("NEXT_PUBLIC_APP_URL", previousAppUrl);
  setOptionalEnv("TEST_REQUIRED_ENV", previousRequiredValue);
});

function setOptionalEnv(name: "NODE_ENV" | "NEXT_PUBLIC_APP_URL" | "TEST_REQUIRED_ENV", value?: string) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  Reflect.set(process.env, name, value);
}

describe("requiredEnv", () => {
  it("returns configured environment values", () => {
    setOptionalEnv("TEST_REQUIRED_ENV", "configured");

    assert.equal(requiredEnv("TEST_REQUIRED_ENV"), "configured");
  });

  it("throws for missing environment values", () => {
    delete process.env.TEST_REQUIRED_ENV;

    assert.throws(() => requiredEnv("TEST_REQUIRED_ENV"), /Missing required environment variable: TEST_REQUIRED_ENV/);
  });
});

describe("appBaseUrl", () => {
  it("uses the public app URL when configured", () => {
    setOptionalEnv("NEXT_PUBLIC_APP_URL", "https://example.com");

    assert.equal(appBaseUrl(), "https://example.com");
  });

  it("falls back to localhost for local development", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    assert.equal(appBaseUrl(), "http://localhost:3000");
  });
});

describe("isProduction", () => {
  it("checks NODE_ENV exactly", () => {
    setOptionalEnv("NODE_ENV", "production");
    assert.equal(isProduction(), true);

    setOptionalEnv("NODE_ENV", "development");
    assert.equal(isProduction(), false);
  });
});
