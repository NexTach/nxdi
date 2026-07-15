import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  UpdateIntentStatusService,
  type IntentStatusRepository,
  type StatusIntent
} from "../src/application/update-intent-status-service.js";

function repository(input: {
  target: StatusIntent;
  acceptedInvestmentsExcluding: number;
  acceptedWithdrawalsExcluding: number;
}) {
  const updates: string[] = [];
  const fake: IntentStatusRepository = {
    async withIntentTransaction(_intent, work) {
      return work({
        async findTarget() { return input.target; },
        async acceptedInvestmentAmountExcluding() { return input.acceptedInvestmentsExcluding; },
        async acceptedWithdrawalAmountExcluding() { return input.acceptedWithdrawalsExcluding; },
        async update(status) { updates.push(status); return { ...input.target, status }; }
      });
    }
  };
  return { fake, updates };
}

describe("UpdateIntentStatusService", () => {
  describe("given accepted withdrawal intentions backed by two accepted investment intentions", () => {
    describe("when an admin tries to reject one investment below the withdrawn amount", () => {
      it("then rejects the transition without updating the intent", async () => {
        const { fake, updates } = repository({
          target: { id: "investment-2", type: "INVESTMENT", userId: "user-1", amountKrw: 50_000, status: "ACCEPTED" },
          acceptedInvestmentsExcluding: 50_000,
          acceptedWithdrawalsExcluding: 80_000
        });
        const result = await new UpdateIntentStatusService(fake).execute({
          type: "INVESTMENT",
          id: "investment-2",
          status: "REJECTED"
        });
        assert.equal(result.status, "principal_invariant");
        assert.equal(updates.length, 0);
      });
    });
  });

  describe("given accepted withdrawal intentions close to the accepted investment intention amount", () => {
    describe("when an admin accepts another withdrawal beyond that principal", () => {
      it("then rejects the transition without updating the intent", async () => {
        const { fake, updates } = repository({
          target: { id: "withdrawal-2", type: "WITHDRAWAL", userId: "user-1", amountKrw: 30_000, status: "PENDING" },
          acceptedInvestmentsExcluding: 100_000,
          acceptedWithdrawalsExcluding: 80_000
        });
        const result = await new UpdateIntentStatusService(fake).execute({
          type: "WITHDRAWAL",
          id: "withdrawal-2",
          status: "ACCEPTED"
        });
        assert.equal(result.status, "principal_invariant");
        assert.equal(updates.length, 0);
      });
    });
  });

  describe("given a pending investment intention that increases the remaining intention reference", () => {
    describe("when an admin accepts it without violating the invariant", () => {
      it("then updates the intent once", async () => {
        const { fake, updates } = repository({
          target: { id: "investment-2", type: "INVESTMENT", userId: "user-1", amountKrw: 50_000, status: "PENDING" },
          acceptedInvestmentsExcluding: 50_000,
          acceptedWithdrawalsExcluding: 40_000
        });
        const result = await new UpdateIntentStatusService(fake).execute({
          type: "INVESTMENT",
          id: "investment-2",
          status: "ACCEPTED"
        });
        assert.equal(result.status, "updated");
        assert.deepEqual(updates, ["ACCEPTED"]);
      });
    });
  });

});
