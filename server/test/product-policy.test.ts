import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { productPolicyDto } from "../src/domain/product-policy.js";

describe("ProductPolicyDto", () => {
  describe("given the server-owned investment and dividend policy", () => {
    describe("when a public response DTO is requested", () => {
      it("then exposes only the normalized serializable policy fields", () => {
        const policy = productPolicyDto();

        assert.deepEqual(policy, {
          minInvestmentKrw: 10_000,
          maxInvestmentKrw: 1_000_000,
          companyDividendTransferRate: 0.2,
          managementFeeRate: 0.05,
          annualInvestorDividendCapRate: 0.18,
          monthlyInvestorDividendCapRate: 0.18 / 12
        });
        assert.doesNotThrow(() => JSON.stringify(policy));
      });
    });
  });
});
