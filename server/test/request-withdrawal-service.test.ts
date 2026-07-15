import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RequestWithdrawalService,
  type WithdrawalRepository,
  type WithdrawalRequestInput
} from "../src/application/request-withdrawal-service.js";

const request: WithdrawalRequestInput = {
  userId: "user-1",
  userName: "홍길동",
  userEmail: "user@example.com",
  amountKrw: 80_000,
  bankName: "은행",
  accountNumber: "123456789",
  accountHolder: "홍길동",
  contact: "010-0000-0000"
};

function repository(values: { invested: number; withdrawn?: number; pending?: number }) {
  const saved: WithdrawalRequestInput[] = [];
  const fake: WithdrawalRepository = {
    async withUserTransaction(_userId, work) {
      return work({
        async acceptedInvestmentIntentAmount() { return values.invested; },
        async acceptedWithdrawalIntentAmount() { return values.withdrawn ?? 0; },
        async pendingWithdrawalIntentAmount() { return values.pending ?? 0; },
        async save(input) { saved.push(input); return input; }
      });
    }
  };
  return { fake, saved };
}

describe("RequestWithdrawalService", () => {
  describe("given accepted investment intentions and pending withdrawal intentions", () => {
    describe("when a new non-binding withdrawal intention exceeds the reference amount", () => {
      it("then rejects the site input without treating the reference as an actual payout right", async () => {
        const { fake, saved } = repository({ invested: 100_000, pending: 20_000 });
        const result = await new RequestWithdrawalService(fake).execute({ ...request, amountKrw: 90_000 });

        assert.equal(result.status, "limit_exceeded");
        assert.equal(result.reference.maxRequestIntentKrw, 80_000);
        assert.equal(saved.length, 0);
      });
    });
  });

  describe("given accepted investment and withdrawal intention amounts", () => {
    describe("when a new intention is within the remaining reference amount", () => {
      it("then stores exactly one non-binding withdrawal intention", async () => {
        const { fake, saved } = repository({ invested: 200_000, withdrawn: 20_000, pending: 10_000 });
        const result = await new RequestWithdrawalService(fake).execute({ ...request, amountKrw: 100_000 });

        assert.equal(result.status, "created");
        assert.equal(result.reference.maxRequestIntentKrw, 170_000);
        assert.deepEqual(saved, [{ ...request, amountKrw: 100_000 }]);
      });
    });
  });
});
