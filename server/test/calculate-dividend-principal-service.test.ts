import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CalculateDividendPrincipalService } from "../src/application/calculate-dividend-principal-service.js";

describe("CalculateDividendPrincipalService", () => {
  describe("given accepted investments and a partial accepted withdrawal", () => {
    describe("when dividend principal is calculated for the withdrawal month", () => {
      it("then subtracts the withdrawal FIFO before returning eligible principal", () => {
        const result = new CalculateDividendPrincipalService().execute({
          dividendMonth: "2026-08",
          investments: [
            { id: "old", userId: "user-1", amountKrw: 100_000, acceptedAt: "2026-06-10T00:00:00.000Z" },
            { id: "new", userId: "user-1", amountKrw: 50_000, acceptedAt: "2026-07-10T00:00:00.000Z" }
          ],
          withdrawals: [
            { id: "withdrawal-1", userId: "user-1", amountKrw: 120_000, acceptedAt: "2026-08-05T00:00:00.000Z" }
          ]
        });

        assert.deepEqual(result.map(({ id, amountKrw }) => ({ id, amountKrw })), [
          { id: "new", amountKrw: 30_000 }
        ]);
      });
    });
  });

  describe("given a withdrawal accepted after the selected month", () => {
    describe("when an earlier month is calculated", () => {
      it("then does not reduce that earlier month retroactively", () => {
        const result = new CalculateDividendPrincipalService().execute({
          dividendMonth: "2026-07",
          investments: [
            { id: "investment-1", userId: "user-1", amountKrw: 100_000, acceptedAt: "2026-06-10T00:00:00.000Z" }
          ],
          withdrawals: [
            { id: "withdrawal-1", userId: "user-1", amountKrw: 100_000, acceptedAt: "2026-08-05T00:00:00.000Z" }
          ]
        });

        assert.equal(result[0]?.amountKrw, 100_000);
      });
    });
  });
});
