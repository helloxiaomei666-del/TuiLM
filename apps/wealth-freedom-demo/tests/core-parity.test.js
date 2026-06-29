const assert = require("node:assert/strict");
const test = require("node:test");

const rootCore = require("../calculation-core.js");
const miniappCore = require("../wechat-miniapp/utils/calculation-core.js");

const baseValues = {
  age: 32,
  target: 1800000,
  cash: 120000,
  investments: 260000,
  salary: 22000,
  sideIncome: 3000,
  livingCost: 9000,
  mortgage: 4200,
  carLoan: 0,
  otherDebt: 800,
  manualDragOutflow: 1300,
  salaryYear3: 15000,
  salaryYear2: 18000,
  salaryYear1: 20500,
  assetStart3: 90000,
  assetEnd3: 160000,
  assetContribution3: 52000,
  assetStart2: 160000,
  assetEnd2: 260000,
  assetContribution2: 76000,
  assetStart1: 260000,
  assetEnd1: 380000,
  assetContribution1: 90000,
};

function roundTrip(value) {
  return JSON.parse(JSON.stringify(value));
}

test("root and miniapp calculation cores expose the same public API", () => {
  assert.deepEqual(Object.keys(rootCore).sort(), Object.keys(miniappCore).sort());
});

test("root and miniapp calculation cores produce the same retirement simulation", () => {
  assert.deepEqual(roundTrip(rootCore.simulate(baseValues)), roundTrip(miniappCore.simulate(baseValues)));
});

test("root and miniapp calculation cores produce the same holding totals", () => {
  const holdings = [
    { id: "cash", type: "cash", currentValue: 120000 },
    { id: "fund", type: "fund", quantity: 60000, currentPrice: 1.26, costPrice: 1.08, todayPnl: 320 },
    { id: "gold", type: "gold", quantity: 100, currentPrice: 690, costPrice: 610 },
  ];

  assert.deepEqual(roundTrip(rootCore.getHoldingTotals(holdings)), roundTrip(miniappCore.getHoldingTotals(holdings)));
});

test("root and miniapp calculation cores produce the same security support result", () => {
  const baseRoot = rootCore.simulate(baseValues);
  const baseMiniapp = miniappCore.simulate(baseValues);
  const accounts = {
    pension: { balance: 86000, yearsPaid: 9, estimatedMonthlyBenefit: 2600 },
    housingFund: { balance: 52000, loanOffsetMonthly: 1800 },
    supplementalHousingFund: { balance: 16000, loanOffsetMonthly: 600 },
    enterpriseAnnuity: { balance: 24000, estimatedMonthlyBenefit: 400 },
    occupationalAnnuity: { balance: 12000, estimatedMonthlyBenefit: 200 },
  };

  assert.deepEqual(
    roundTrip(rootCore.getSecuritySupport(baseValues, baseRoot, accounts)),
    roundTrip(miniappCore.getSecuritySupport(baseValues, baseMiniapp, accounts)),
  );
});

test("root and miniapp calculation cores refresh mock holdings identically", () => {
  const holdings = [
    { id: "fund-a", type: "stock", code: "000001", quantity: 8000, currentPrice: 1.25, costPrice: 1.1 },
    { id: "gold-a", type: "commodity", code: "AU9999", quantity: 100, currentPrice: 680, costPrice: 630 },
  ];
  const options = { seed: 13, refreshedAt: "2026-06-25 09:30" };

  assert.deepEqual(
    roundTrip(rootCore.refreshMockHoldings(holdings, options)),
    roundTrip(miniappCore.refreshMockHoldings(holdings, options)),
  );
});
