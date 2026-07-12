import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  makeHolding,
  makeInvestmentIntent,
  makePortfolio,
  makeStore,
  makeWithdrawalIntent
} from "@/test/factories";
import {
  acceptedInvestmentPrincipal,
  acceptedWithdrawalAmount,
  netAcceptedInvestmentPrincipal,
  pendingWithdrawalAmount,
  portfolioDrawdownRate,
  withdrawalLimitForUser,
  withdrawalLimitFromPrincipal
} from "./withdrawal-limit";

describe("acceptedInvestmentPrincipal", () => {
  it("sums only accepted investment intents for the selected user", () => {
    const store = makeStore({
      investmentIntents: [
        makeInvestmentIntent({ id: "accepted-1", userId: "user-1", amountKrw: 100000, status: "ACCEPTED" }),
        makeInvestmentIntent({ id: "pending-1", userId: "user-1", amountKrw: 50000, status: "PENDING" }),
        makeInvestmentIntent({ id: "accepted-2", userId: "user-2", amountKrw: 70000, status: "ACCEPTED" }),
        makeInvestmentIntent({ id: "accepted-3", userId: "user-1", amountKrw: 25000, status: "ACCEPTED" })
      ]
    });

    assert.equal(acceptedInvestmentPrincipal(store, "user-1"), 125000);
  });
});

describe("withdrawal principal accounting", () => {
  it("subtracts accepted withdrawals and tracks pending withdrawals separately", () => {
    const store = makeStore({
      investmentIntents: [
        makeInvestmentIntent({ amountKrw: 150000, status: "ACCEPTED" })
      ],
      withdrawalIntents: [
        makeWithdrawalIntent({ id: "accepted", amountKrw: 20000, status: "ACCEPTED" }),
        makeWithdrawalIntent({ id: "pending", amountKrw: 10000, status: "PENDING" }),
        makeWithdrawalIntent({ id: "other", userId: "user-2", amountKrw: 50000, status: "ACCEPTED" })
      ]
    });

    assert.equal(acceptedWithdrawalAmount(store, "user-1"), 20000);
    assert.equal(pendingWithdrawalAmount(store, "user-1"), 10000);
    assert.equal(netAcceptedInvestmentPrincipal(store, "user-1"), 130000);
  });
});

describe("portfolioDrawdownRate", () => {
  it("returns the negative drawdown from complete cost basis data", () => {
    const portfolio = makePortfolio({
      totalMarketValueKrw: 80000,
      holdings: [
        makeHolding({
          quantity: 10,
          lastPrice: 8000,
          averagePurchasePrice: 10000,
          marketValue: 80000,
          marketValueKrw: 80000
        })
      ]
    });

    assert.equal(portfolioDrawdownRate(portfolio), -0.2);
  });

  it("does not increase withdrawal limits when the portfolio is above cost basis", () => {
    const portfolio = makePortfolio({
      totalMarketValueKrw: 120000,
      holdings: [
        makeHolding({
          quantity: 10,
          lastPrice: 12000,
          averagePurchasePrice: 10000,
          marketValue: 120000,
          marketValueKrw: 120000
        })
      ]
    });

    assert.equal(portfolioDrawdownRate(portfolio), 0);
  });

  it("uses zero drawdown when cost basis coverage is incomplete", () => {
    const portfolio = makePortfolio({
      totalMarketValueKrw: 80000,
      holdings: [
        makeHolding({
          averagePurchasePrice: undefined,
          marketValue: 80000,
          marketValueKrw: 80000
        })
      ]
    });

    assert.equal(portfolioDrawdownRate(portfolio), 0);
  });
});

describe("withdrawalLimitFromPrincipal", () => {
  it("floors principal and applies negative drawdown to the maximum amount", () => {
    assert.deepEqual(withdrawalLimitFromPrincipal(1000.9, -0.234), {
      principalKrw: 1000,
      pendingWithdrawalKrw: 0,
      drawdownRate: -0.234,
      maxAmountKrw: 766
    });
  });

  it("clamps positive drawdown and extreme loss values", () => {
    assert.deepEqual(withdrawalLimitFromPrincipal(1000, 0.5), {
      principalKrw: 1000,
      pendingWithdrawalKrw: 0,
      drawdownRate: 0,
      maxAmountKrw: 1000
    });
    assert.deepEqual(withdrawalLimitFromPrincipal(1000, -2), {
      principalKrw: 1000,
      pendingWithdrawalKrw: 0,
      drawdownRate: -1,
      maxAmountKrw: 0
    });
  });

  it("reserves pending withdrawal amounts from the available maximum", () => {
    assert.deepEqual(withdrawalLimitFromPrincipal(1000, -0.2, 300), {
      principalKrw: 1000,
      pendingWithdrawalKrw: 300,
      drawdownRate: -0.2,
      maxAmountKrw: 500
    });
  });
});

describe("withdrawalLimitForUser", () => {
  it("combines accepted principal with portfolio drawdown", () => {
    const store = makeStore({
      investmentIntents: [
        makeInvestmentIntent({ id: "accepted-1", userId: "user-1", amountKrw: 100000, status: "ACCEPTED" }),
        makeInvestmentIntent({ id: "accepted-2", userId: "user-1", amountKrw: 50000, status: "ACCEPTED" })
      ],
      withdrawalIntents: [
        makeWithdrawalIntent({ id: "accepted", amountKrw: 20000, status: "ACCEPTED" }),
        makeWithdrawalIntent({ id: "pending", amountKrw: 10000, status: "PENDING" })
      ]
    });
    const portfolio = makePortfolio({
      totalMarketValueKrw: 75000,
      holdings: [
        makeHolding({
          quantity: 10,
          lastPrice: 7500,
          averagePurchasePrice: 10000,
          marketValue: 75000,
          marketValueKrw: 75000
        })
      ]
    });

    assert.deepEqual(withdrawalLimitForUser(store, portfolio, "user-1"), {
      principalKrw: 130000,
      pendingWithdrawalKrw: 10000,
      drawdownRate: -0.25,
      maxAmountKrw: 87500
    });
  });
});
