import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { adminEmails, isAdminUser } from "./admin";
import type { AppUser } from "./types";

const previousAdminEmails = process.env.ADMIN_EMAILS;
const previousAdminEmail = process.env.ADMIN_EMAIL;

afterEach(() => {
  setOptionalEnv("ADMIN_EMAILS", previousAdminEmails);
  setOptionalEnv("ADMIN_EMAIL", previousAdminEmail);
});

function setOptionalEnv(name: "ADMIN_EMAILS" | "ADMIN_EMAIL", value?: string) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function user(email: string): AppUser {
  return {
    id: "user-1",
    email,
    name: "User",
    role: "user",
    userType: "student"
  };
}

describe("adminEmails", () => {
  it("normalizes comma separated admin emails", () => {
    process.env.ADMIN_EMAILS = " Admin@Example.com, second@example.com ,,";
    process.env.ADMIN_EMAIL = "fallback@example.com";

    assert.deepEqual(adminEmails(), ["admin@example.com", "second@example.com"]);
  });

  it("falls back to the single ADMIN_EMAIL value", () => {
    delete process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAIL = " owner@example.com ";

    assert.deepEqual(adminEmails(), ["owner@example.com"]);
  });
});

describe("isAdminUser", () => {
  it("matches users case-insensitively", () => {
    process.env.ADMIN_EMAILS = "admin@example.com";

    assert.equal(isAdminUser(user("Admin@Example.com")), true);
  });

  it("rejects missing or non-admin users", () => {
    process.env.ADMIN_EMAILS = "admin@example.com";

    assert.equal(isAdminUser(null), false);
    assert.equal(isAdminUser(user("user@example.com")), false);
  });
});
