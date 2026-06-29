const assert = require("node:assert/strict");
const test = require("node:test");

const {
  annualizeToMonthly,
  getCashflowRetirementRate,
  getLaborDependenceRate,
  getMonthlyPassiveIncome,
  getMonthlySemiPassiveIncome,
  getPassiveIncomeGap,
  getRetirementStatus,
  getRunwayMonths,
} = require("../wechat-miniapp/utils/passive-income-model.js");

function passiveStream(amount, overrides = {}) {
  return {
    id: "passive-stream",
    type: "passive",
    amount,
    frequency: "monthly",
    status: "current",
    requiresLabor: false,
    includeInPassiveIncome: true,
    ...overrides,
  };
}

test("converts monthly quarterly and annual cashflow to monthly values", () => {
  assert.equal(annualizeToMonthly(1200, "monthly").value, 1200);
  assert.equal(annualizeToMonthly(3600, "quarterly").value, 1200);
  assert.equal(annualizeToMonthly(14400, "annual").value, 1200);
});

test("rejects invalid amount and unknown frequency instead of guessing", () => {
  assert.equal(annualizeToMonthly(-1, "monthly").ok, false);
  assert.equal(annualizeToMonthly(Number.NaN, "monthly").ok, false);
  assert.equal(annualizeToMonthly(1200, "weekly_guess").ok, false);
});

test("keeps semi-passive income out of strict passive income", () => {
  const streams = [
    {
      id: "rent",
      type: "passive",
      amount: 800,
      frequency: "monthly",
      status: "current",
      requiresLabor: false,
      includeInPassiveIncome: true,
    },
    {
      id: "app",
      type: "semi_passive",
      amount: 300,
      frequency: "monthly",
      status: "current",
      requiresLabor: true,
      includeInPassiveIncome: true,
      includeInSemiPassiveIncome: true,
    },
  ];

  assert.equal(getMonthlyPassiveIncome([], streams).value, 800);
  assert.equal(getMonthlySemiPassiveIncome(streams).value, 300);
});

test("excludes future and labor-dependent income from strict passive income", () => {
  const streams = [
    {
      id: "future-pension",
      type: "passive",
      amount: 2600,
      frequency: "monthly",
      status: "future",
      requiresLabor: false,
      includeInPassiveIncome: true,
    },
    {
      id: "active-project",
      type: "passive",
      amount: 1000,
      frequency: "monthly",
      status: "current",
      requiresLabor: true,
      includeInPassiveIncome: true,
    },
  ];

  assert.equal(getMonthlyPassiveIncome([], streams).value, 0);
});

test("averages irregular income over the covered calendar months including zero months", () => {
  const result = annualizeToMonthly(0, "irregular", {
    monthlyHistory: [800, 0, 400],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value, 400);
  assert.match(result.warnings.join(" "), /12/);
});

test("does not double count the same origin key", () => {
  const holdings = [{
    id: "rental-home",
    producesCashflow: true,
    cashflowType: "rent",
    cashflowAmount: 800,
    cashflowFrequency: "monthly",
    cashflowStatus: "current",
    requiresLabor: false,
    includeInPassiveIncome: true,
  }];
  const streams = [passiveStream(800, {
    id: "duplicate-rent",
    originKey: "holding:rental-home:rent",
  })];

  const result = getMonthlyPassiveIncome(holdings, streams);

  assert.equal(result.value, 800);
  assert.match(result.warnings.join(" "), /duplicate/);
});

test("calculates cashflow retirement rate and caps only the progress display", () => {
  const normal = getCashflowRetirementRate(800, 6000);
  const surplus = getCashflowRetirementRate(7500, 6000);

  assert.equal(normal.value, 800 / 6000);
  assert.equal(normal.displayProgress, 800 / 6000);
  assert.equal(surplus.value, 1.25);
  assert.equal(surplus.displayProgress, 1);
});

test("returns unavailable metrics when living cost is missing or invalid", () => {
  assert.equal(getCashflowRetirementRate(800, 0).ok, false);
  assert.equal(getCashflowRetirementRate(800, undefined).ok, false);
  assert.equal(getRunwayMonths(51000, -1).ok, false);
});

test("calculates labor dependence runway gap and surplus", () => {
  assert.equal(getLaborDependenceRate(800 / 6000).value, 1 - (800 / 6000));
  assert.equal(getLaborDependenceRate(1.25).value, 0);
  assert.equal(getRunwayMonths(51000, 6000).value, 8.5);
  assert.deepEqual(getPassiveIncomeGap(800, 6000).value, { gap: 5200, surplus: 0 });
  assert.deepEqual(getPassiveIncomeGap(7500, 6000).value, { gap: 0, surplus: 1500 });
});

test("uses target living cost before current living cost", () => {
  const result = getRetirementStatus(
    { targetMonthlyLivingCost: 6000, monthlyLivingCost: 4000 },
    [],
    [passiveStream(800)],
  );

  assert.equal(result.ok, true);
  assert.equal(result.denominator.amount, 6000);
  assert.equal(result.denominator.source, "targetMonthlyLivingCost");
  assert.equal(result.metrics.cashflowRetirementRate, 800 / 6000);
  assert.equal(result.status.code, "cashflow_seed");
});

test("falls back to current living cost and preserves independent options", () => {
  const result = getRetirementStatus(
    { monthlyLivingCost: 4000 },
    [],
    [passiveStream(2000)],
    { liquidAssets: 24000, currentRequiredMonthlyOutflow: 6000, assetRetirementRate: 0.2 },
  );

  assert.equal(result.denominator.source, "monthlyLivingCost");
  assert.equal(result.metrics.assetRetirementRate, 0.2);
  assert.equal(result.metrics.runwayMonths, 4);
});

test("assigns exact cashflow status boundaries without gaps", () => {
  const cases = [
    [0.099, "survival_dependent"],
    [0.1, "cashflow_seed"],
    [0.299, "cashflow_seed"],
    [0.3, "semi_free"],
    [0.599, "semi_free"],
    [0.6, "near_retirement"],
    [0.899, "near_retirement"],
    [0.9, "cashflow_retirement"],
    [1.2, "cashflow_retirement"],
  ];

  cases.forEach(([rate, expected]) => {
    const result = getRetirementStatus(
      { targetMonthlyLivingCost: 10000 },
      [],
      [passiveStream(rate * 10000)],
    );
    assert.equal(result.status.code, expected, `${rate} should map to ${expected}`);
  });
});

test("shows semi-passive combined coverage without changing the main status", () => {
  const result = getRetirementStatus(
    { targetMonthlyLivingCost: 10000 },
    [],
    [
      passiveStream(2000),
      passiveStream(8000, {
        id: "maintained-subscription",
        type: "semi_passive",
        requiresLabor: true,
        includeInPassiveIncome: true,
        includeInSemiPassiveIncome: true,
      }),
    ],
  );

  assert.equal(result.metrics.cashflowRetirementRate, 0.2);
  assert.equal(result.metrics.monthlySemiPassiveIncome, 8000);
  assert.equal(result.metrics.combinedCoverageRate, 1);
  assert.equal(result.status.code, "cashflow_seed");
});
