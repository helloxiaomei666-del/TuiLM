const assert = require("node:assert/strict");
const test = require("node:test");

const calc = require("../calculation-core.js");

const zeroBacktestValues = {
  age: 30,
  target: 1000,
  cash: 0,
  investments: 0,
  salary: 100,
  sideIncome: 0,
  livingCost: 0,
  mortgage: 0,
  carLoan: 0,
  otherDebt: 0,
  manualDragOutflow: 0,
  salaryYear3: 100,
  salaryYear2: 100,
  salaryYear1: 100,
  assetStart3: 0,
  assetEnd3: 0,
  assetContribution3: 0,
  assetStart2: 0,
  assetEnd2: 0,
  assetContribution2: 0,
  assetStart1: 0,
  assetEnd1: 0,
  assetContribution1: 0,
};

test("calculates first monthly investable cashflow", () => {
  const result = calc.simulate({
    ...zeroBacktestValues,
    target: 100000,
    salary: 18000,
    sideIncome: 2000,
    livingCost: 8500,
    manualDragOutflow: 1200,
  });

  assert.equal(result.monthlyInvestable, 10300);
});

test("derives weighted investment backtest return", () => {
  const backtest = calc.deriveInvestmentReturn({
    assetStart3: 60000,
    assetEnd3: 92000,
    assetContribution3: 28000,
    assetStart2: 92000,
    assetEnd2: 134000,
    assetContribution2: 36000,
    assetStart1: 134000,
    assetEnd1: 180000,
    assetContribution1: 39000,
  });

  assert.equal(backtest.yearly.length, 3);
  assert.equal(Number(backtest.rate.toFixed(4)), 5.037);
});

test("derives salary growth while allowing zero-income history", () => {
  const newGraduateBacktest = calc.deriveSalaryGrowth({
    salaryYear3: 0,
    salaryYear2: 0,
    salaryYear1: 10000,
    salary: 11000,
  });
  const currentOnlyBacktest = calc.deriveSalaryGrowth({
    salaryYear3: 0,
    salaryYear2: 0,
    salaryYear1: 0,
    salary: 11000,
  });

  assert.equal(newGraduateBacktest.years, 1);
  assert.equal(Number(newGraduateBacktest.rate.toFixed(1)), 10.0);
  assert.deepEqual(newGraduateBacktest.points, [0, 0, 10000, 11000]);
  assert.equal(currentOnlyBacktest.rate, 0);
  assert.equal(currentOnlyBacktest.years, 0);
});

test("simulates retirement reaching month with stable zero-return inputs", () => {
  const result = calc.simulate(zeroBacktestValues);

  assert.equal(result.reached, true);
  assert.equal(result.months, 10);
  assert.equal(result.currentAssets, 0);
});

test("refreshes mock quotes and records asset value impact", () => {
  const refreshed = calc.refreshMockHoldings(
    [
      {
        id: "stock-1",
        type: "stock",
        code: "000001",
        quantity: 100,
        costPrice: 9,
        currentPrice: 10,
        currentValue: 1000,
      },
    ],
    { seed: 2, refreshedAt: "2026-06-04 19:00" },
  );

  const [holding] = refreshed.holdings;
  assert.notEqual(holding.currentPrice, 10);
  assert.equal(holding.currentValue, holding.quantity * holding.currentPrice);
  assert.equal(holding.todayPnl, holding.currentValue - 1000);
  assert.equal(refreshed.totals.investments, holding.currentValue);
});

test("keeps security accounts out of investable assets", () => {
  const base = calc.simulate({
    ...zeroBacktestValues,
    target: 1000,
    cash: 100,
    investments: 200,
  });
  const support = calc.getSecuritySupport(
    { ...zeroBacktestValues, target: 1000, cash: 100, investments: 200 },
    base,
    {
      pension: { balance: 500, yearsPaid: 10 },
      housingFund: { balance: 300 },
      enterpriseAnnuity: { balance: 100 },
      occupationalAnnuity: { balance: 50 },
    },
  );

  assert.equal(base.currentAssets, 300);
  assert.equal(support.total, 950);
  assert.equal(support.supportFactor, 0.95);
});

test("applies security cashflow to retirement support without changing current assets", () => {
  const values = {
    ...zeroBacktestValues,
    target: 1200000,
    cash: 100000,
    investments: 200000,
    salary: 20000,
    livingCost: 9000,
    mortgage: 5000,
  };
  const base = calc.simulate(values);
  const support = calc.getSecuritySupport(values, base, {
    pension: { balance: 100000, yearsPaid: 12, estimatedMonthlyBenefit: 3000 },
    housingFund: { balance: 80000, loanOffsetMonthly: 2000 },
    supplementalHousingFund: { balance: 20000, loanOffsetMonthly: 1000 },
    enterpriseAnnuity: { balance: 50000, estimatedMonthlyBenefit: 500 },
  });

  assert.equal(base.currentAssets, 300000);
  assert.equal(support.total, 250000);
  assert.equal(support.monthlyRetirementIncome, 3500);
  assert.equal(support.housingLoanOffsetMonthly, 3000);
  assert.equal(support.incomeEquivalentTarget, 1050000);
  assert.ok(support.reducedMonths > 0);
});

test("marks manual drag insights as removable manual items", () => {
  const values = {
    ...zeroBacktestValues,
    target: 10000,
    salary: 1000,
    livingCost: 100,
    manualDragOutflow: 300,
  };
  const base = calc.simulate(values);
  const [insight] = calc.getManualDragInsights(
    [{ id: "manual-1", category: "medical", title: "医疗", amount: 300 }],
    values,
    base,
  );

  assert.equal(insight.id, "manual-1");
  assert.equal(insight.source, "manual");
  assert.equal(insight.isManual, true);
});

test("formats drag impact text consistently", () => {
  assert.equal(
    calc.formatDragImpactText({ isFlexible: true, savedMonths: 611 }),
    "若减少可提前约 611 个月",
  );
  assert.equal(
    calc.formatDragImpactText({ source: "manual", isManual: true, isFlexible: false, savedMonths: 0 }),
    "已计入现金流",
  );
  assert.equal(
    calc.formatDragImpactText({ isFlexible: false, savedMonths: 12 }, { monthsFormatter: (months) => `${months}个月` }),
    "影响约 12个月",
  );
});
