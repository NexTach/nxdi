import { createHash } from "node:crypto";

export type DistributionReceiptReferenceInput = {
  symbol: string;
  currency: "KRW" | "USD";
  grossAmountNative: number;
  exchangeRate?: number;
  foreignTaxKrw: number;
  brokerageFeeKrw: number;
  fxCostKrw: number;
  receivedAt: Date;
};

function kstDateTimeKey(date: Date) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16)
    .replace(/[-:T]/g, "");
}

export function distributionReceiptReference(input: DistributionReceiptReferenceInput) {
  const symbol = input.symbol.trim().toUpperCase();
  const readableSymbol = symbol.replace(/[^A-Z0-9]/g, "") || "UNKNOWN";
  const fingerprint = [
    "NXDI_DISTRIBUTION_V1",
    symbol,
    input.currency,
    String(input.grossAmountNative),
    input.exchangeRate === undefined ? "" : String(input.exchangeRate),
    String(input.foreignTaxKrw),
    String(input.brokerageFeeKrw),
    String(input.fxCostKrw),
    input.receivedAt.toISOString()
  ].join("|");
  const digest = createHash("sha256").update(fingerprint).digest("hex").slice(0, 12).toUpperCase();

  return `NXDI-DIST-${kstDateTimeKey(input.receivedAt)}-${readableSymbol}-${digest}`;
}
