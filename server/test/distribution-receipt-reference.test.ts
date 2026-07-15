import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { distributionReceiptReference } from "../src/domain/distribution-receipt-reference.js";

const receipt = {
  symbol: "schd",
  currency: "USD" as const,
  grossAmountNative: 12.34,
  exchangeRate: 1_380.5,
  foreignTaxKrw: 250,
  brokerageFeeKrw: 10,
  fxCostKrw: 20,
  receivedAt: new Date("2026-07-15T01:34:00.000Z")
};

describe("Given 증권사가 별도 명세 ID를 제공하지 않는 실분배금 입금", () => {
  describe("when 서버가 내부 원장 ID를 생성하면", () => {
    it("then KST 입금일시와 정규화한 티커를 포함한다", () => {
      assert.match(
        distributionReceiptReference(receipt),
        /^NXDI-DIST-202607151034-SCHD-[A-F0-9]{12}$/
      );
    });

    it("then 동일한 경제정보의 재제출에는 동일한 ID를 생성한다", () => {
      assert.equal(distributionReceiptReference(receipt), distributionReceiptReference({ ...receipt }));
    });

    it("then 금액이 달라지면 다른 ID를 생성한다", () => {
      assert.notEqual(
        distributionReceiptReference(receipt),
        distributionReceiptReference({ ...receipt, grossAmountNative: 12.35 })
      );
    });
  });
});
