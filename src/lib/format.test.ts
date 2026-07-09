import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { currencySymbol, formatCurrency, formatKrw, formatNumber, statusLabel } from "./format";

describe("currency formatting", () => {
  it("rounds KRW values to whole won", () => {
    assert.equal(formatKrw(1234.5), "₩1,235");
    assert.equal(formatCurrency(1234.4, "KRW"), "₩1,234");
  });

  it("formats USD values with sign and configurable digits", () => {
    assert.equal(formatCurrency(-1234.567, "USD"), "-$1,234.57");
    assert.equal(formatCurrency(1234.567, "USD", 1), "$1,234.6");
  });

  it("returns compact currency symbols", () => {
    assert.equal(currencySymbol("KRW"), "₩");
    assert.equal(currencySymbol("USD"), "$");
  });
});

describe("number and status formatting", () => {
  it("formats generic numbers with the requested precision", () => {
    assert.equal(formatNumber(1234.567, 1), "1,234.6");
  });

  it("maps known intent statuses and defaults to pending", () => {
    assert.equal(statusLabel("ACCEPTED"), "수락");
    assert.equal(statusLabel("REJECTED"), "거절");
    assert.equal(statusLabel("PENDING"), "대기");
    assert.equal(statusLabel("UNKNOWN"), "대기");
  });
});
