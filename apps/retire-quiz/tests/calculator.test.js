const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const {
  toAmount,
  toMonthly,
  calculateMetrics,
  deriveCashFlowStatus,
  deriveAssetStatus,
  getPosterSummaryByCashFlowRate,
  estimateRetirement,
  calculateAccelerators,
  formatCurrency,
  formatPercent,
} = require('../js/calculator.js');

test('toAmount normalizes invalid and negative values to zero', () => {
  assert.equal(toAmount(''), 0);
  assert.equal(toAmount('oops'), 0);
  assert.equal(toAmount(-1), 0);
});

test('toAmount converts a numeric string to an amount', () => {
  assert.equal(toAmount('1200.50'), 1200.5);
});

test('toMonthly converts supported frequencies to monthly amounts', () => {
  assert.equal(toMonthly(1200, 'month'), 1200);
  assert.equal(toMonthly(1200, 'quarter'), 400);
  assert.equal(toMonthly(1200, 'year'), 100);
  assert.equal(toMonthly(1200, 'irregular'), 0);
});

test('classic script exposes the calculator when globalThis is unavailable', () => {
  const source = fs.readFileSync(require.resolve('../js/calculator.js'), 'utf8');
  const context = vm.createContext({});

  vm.runInContext('delete this.globalThis', context);
  vm.runInContext(source, context);

  assert.equal(context.RetirementCalculator.toAmount('1200.50'), 1200.5);
});

test('calculateMetrics calculates retirement progress from assets, debts, and income', () => {
  const metrics = calculateMetrics({
    currentMonthlyCost: 8000,
    targetMonthlyCost: 10000,
    assets: {
      cash: 120000,
      funds: 180000,
      stocks: 90000,
      gold: 30000,
      propertyEquity: 500000,
      other: 80000,
    },
    debts: {
      mortgage: 300000,
      carLoan: 20000,
      consumerLoan: 10000,
      other: 0,
    },
    passiveIncome: {
      dividends: { amount: 3600, frequency: 'year' },
      rent: { amount: 1200, frequency: 'month' },
      interest: { amount: 600, frequency: 'quarter' },
      reits: { amount: 0, frequency: 'month' },
      pension: { amount: 0, frequency: 'month' },
      annuity: { amount: 0, frequency: 'month' },
      royalties: { amount: 0, frequency: 'month' },
      other: { amount: 1200, frequency: 'year' },
    },
    semiPassiveIncome: { amount: 600, frequency: 'month' },
  });

  assert.deepEqual(metrics, {
    totalAssets: 1000000,
    totalDebts: 330000,
    netAssets: 670000,
    retirementTargetAssets: 3000000,
    monthlyPassiveIncome: 1800,
    monthlySemiPassiveIncome: 600,
    cashflowRetirementRate: 0.18,
    assetRetirementRate: 670000 / 3000000,
    targetAssetProgress: 670000 / 3000000,
    laborDependencyRate: 0.82,
    assetWorkPower: 2400,
    safetyMonths: 15,
    stage: { key: 'freedom-starting' },
    statuses: {
      cashFlowStatus: {
        key: 'freedom-starting',
        label: '刚刚起步',
        description: '稳定被动收入已经出现，但覆盖比例仍较低。',
      },
      assetStatus: {
        key: 'asset-accumulation-progress',
        label: '资产积累推进期',
        description: '净资产正在向目标资产推进。',
      },
      overallStatus: {
        title: '资产积累与现金流建设阶段',
        description: '当前仍处于资产积累与现金流建设阶段，需要继续观察净资产、稳定现金流和安全垫。',
        caution: '本结果仅供自我观察，不构成投资、理财、保险或退休决策建议。',
      },
      posterSummary: {
        stageLabel: '刚刚起步',
        summaryText: '稳定现金流刚刚出现，大部分生活成本仍需要工资支持。',
      },
    },
    cashflowCovered: false,
    assetTargetReached: false,
  });
});

test('calculateMetrics treats property value and mortgage balance without double subtraction', () => {
  const metrics = calculateMetrics({
    currentMonthlyCost: 10000,
    targetMonthlyCost: 10000,
    assets: {
      cash: 100000,
      funds: 200000,
      stocks: 300000,
      gold: 50000,
      propertyValue: 3000000,
      other: 50000,
    },
    debts: {
      mortgageBalance: 1000000,
      carLoan: 50000,
      consumerLoan: 20000,
      other: 30000,
    },
    passiveIncome: {},
    semiPassiveIncome: {},
  });

  assert.equal(metrics.totalAssets, 3700000);
  assert.equal(metrics.totalDebts, 1100000);
  assert.equal(metrics.netAssets, 2600000);
  assert.equal(metrics.retirementTargetAssets, 3000000);
  assert.equal(metrics.targetAssetProgress, 2600000 / 3000000);
  assert.equal(metrics.assetRetirementRate, metrics.targetAssetProgress);
});

test('deriveCashFlowStatus classifies V0.3 freedom progress boundaries', () => {
  const cases = [
    [0, 'freedom-starting', '刚刚起步'],
    [0.19, 'freedom-starting', '刚刚起步'],
    [0.2, 'freedom-building', '正在积累'],
    [0.5, 'freedom-improving', '明显改善'],
    [0.8, 'freedom-near', '高度接近自由'],
    [1, 'cashflow-covered', '现金流已覆盖'],
  ];

  for (const [rate, key, label] of cases) {
    const status = deriveCashFlowStatus(rate);
    assert.equal(status.key, key, `rate ${rate}`);
    assert.equal(status.label, label, `rate ${rate}`);
  }
});

test('deriveAssetStatus classifies V0.2 target asset progress boundaries', () => {
  const cases = [
    [-0.01, 'asset-debt-repair', '资产负债修复期'],
    [0, 'asset-accumulation-start', '资产积累起步期'],
    [0.2, 'asset-accumulation-progress', '资产积累推进期'],
    [0.5, 'asset-near-target', '资产接近目标期'],
    [0.8, 'asset-target-close', '资产临近达标期'],
    [1, 'asset-model-reached', '资产模型达标期'],
  ];

  for (const [progress, key, label] of cases) {
    const status = deriveAssetStatus(progress);
    assert.equal(status.key, key, `progress ${progress}`);
    assert.equal(status.label, label, `progress ${progress}`);
  }
});

test('calculateMetrics separates cashflow, asset, and overall statuses', () => {
  const metrics = calculateMetrics({
    currentMonthlyCost: 10000,
    targetMonthlyCost: 10000,
    assets: { cash: 3000000 },
    debts: {},
    passiveIncome: {
      rent: { amount: 4000, frequency: 'month' },
    },
    semiPassiveIncome: {},
  });

  assert.equal(metrics.cashflowRetirementRate, 0.4);
  assert.equal(metrics.targetAssetProgress, 1);
  assert.equal(metrics.statuses.cashFlowStatus.label, '正在积累');
  assert.equal(metrics.statuses.assetStatus.label, '资产模型达标期');
  assert.equal(metrics.statuses.overallStatus.title, '资产模型达标，现金流尚未达标');
  assert.match(metrics.statuses.overallStatus.description, /仍需工资或主动收入支持/);
  assert.doesNotMatch(
    `${metrics.statuses.overallStatus.title}${metrics.statuses.overallStatus.description}`,
    /已达到目标状态|可以退休|财务自由/,
  );
});

test('getPosterSummaryByCashFlowRate returns dynamic safe summaries', () => {
  const cases = [
    [-1, 100, -1000, '资产负债修复中', '当前优先级不是退休，而是先修复资产负债表。'],
    [0, 0, 1000, '打基础中', '稳定现金流还没真正接班，现在主要还是靠自己扛。'],
    [0.05, 500, 1000, '刚刚起步', '稳定现金流刚刚出现，大部分生活成本仍需要工资支持。'],
    [0.2, 2000, 1000, '正在积累', '稳定现金流正在积累，已经开始分担一部分生活成本。'],
    [0.4, 4000, 1000, '正在积累', '稳定现金流正在积累，已经开始分担一部分生活成本。'],
    [0.7, 7000, 1000, '明显改善', '稳定现金流已经覆盖较多目标生活成本，选择权正在变多。'],
    [0.95, 9500, 1000, '高度接近自由', '距离覆盖目标生活成本已经不远，下一步更要看稳定性和安全垫。'],
    [1.2, 12000, 1000, '现金流已覆盖', '从现金流看，目标生活成本已被覆盖，但仍要看稳定性、安全垫和长期风险。'],
  ];

  for (const [rate, income, netAssets, label, text] of cases) {
    const summary = getPosterSummaryByCashFlowRate(rate, income, netAssets);
    assert.equal(summary.stageLabel, label);
    assert.equal(summary.summaryText, text);
    assert.doesNotMatch(summary.summaryText, /可以退休|财务自由|已达到目标状态|资产已接管生活|稳赚|保证收益/);
  }
});

test('calculateMetrics preserves negative net assets and returns null for zero denominators', () => {
  const metrics = calculateMetrics({
    currentMonthlyCost: 0,
    targetMonthlyCost: 0,
    assets: { cash: 1000 },
    debts: { consumerLoan: 3000 },
    passiveIncome: {},
    semiPassiveIncome: {},
  });

  assert.equal(metrics.netAssets, -2000);
  assert.equal(metrics.retirementTargetAssets, null);
  assert.equal(metrics.cashflowRetirementRate, null);
  assert.equal(metrics.assetRetirementRate, null);
  assert.equal(metrics.safetyMonths, null);
});

test('calculateMetrics keeps rates above 100 percent while clamping labor dependency to zero', () => {
  const metrics = calculateMetrics({
    currentMonthlyCost: 1000,
    targetMonthlyCost: 1000,
    assets: { cash: 400000 },
    debts: {},
    passiveIncome: {
      rent: { amount: 1500, frequency: 'month' },
    },
    semiPassiveIncome: { amount: 5000, frequency: 'month' },
  });

  assert.equal(metrics.cashflowRetirementRate, 1.5);
  assert.ok(metrics.assetRetirementRate > 1);
  assert.equal(metrics.laborDependencyRate, 0);
  assert.equal(metrics.cashflowCovered, true);
  assert.equal(metrics.assetTargetReached, true);
});

test('calculateMetrics saturates aggregate overflow and nulls an overflowing retirement target', () => {
  const metrics = calculateMetrics({
    currentMonthlyCost: 1,
    targetMonthlyCost: Number.MAX_VALUE,
    assets: {
      cash: Number.MAX_VALUE,
      funds: Number.MAX_VALUE,
    },
    debts: {},
    passiveIncome: {
      dividends: { amount: Number.MAX_VALUE, frequency: 'month' },
      rent: { amount: Number.MAX_VALUE, frequency: 'month' },
    },
    semiPassiveIncome: { amount: Number.MAX_VALUE, frequency: 'month' },
  });

  assert.equal(metrics.totalAssets, Number.MAX_VALUE);
  assert.equal(metrics.retirementTargetAssets, null);
  assert.equal(metrics.assetRetirementRate, null);

  for (const [key, value] of Object.entries(metrics)) {
    if (typeof value === 'number') {
      assert.equal(Number.isFinite(value), true, `${key} must be finite`);
    } else if (value === null) {
      assert.equal(value, null);
    }
  }
});

test('calculateMetrics ignores inherited known asset, debt, and income properties', () => {
  const assets = Object.create({ cash: 1000 });
  assets.funds = 2000;

  const debts = Object.create({ consumerLoan: 500 });
  debts.carLoan = 200;

  const passiveIncome = Object.create({
    rent: { amount: 1200, frequency: 'month' },
  });
  passiveIncome.dividends = { amount: 1200, frequency: 'year' };

  const metrics = calculateMetrics({
    currentMonthlyCost: 1000,
    targetMonthlyCost: 1000,
    assets,
    debts,
    passiveIncome,
    semiPassiveIncome: {},
  });

  assert.equal(metrics.totalAssets, 2000);
  assert.equal(metrics.totalDebts, 200);
  assert.equal(metrics.netAssets, 1800);
  assert.equal(metrics.monthlyPassiveIncome, 100);
  assert.equal(metrics.safetyMonths, 0);
});

test('calculateMetrics classifies exact freedom progress boundaries', () => {
  const cases = [
    { rate: 0.19, key: 'freedom-starting' },
    { rate: 0.2, key: 'freedom-building' },
    { rate: 0.5, key: 'freedom-improving' },
    { rate: 0.8, key: 'freedom-near' },
    { rate: 1, key: 'cashflow-covered' },
  ];

  for (const expected of cases) {
    const metrics = calculateMetrics({
      currentMonthlyCost: 1000,
      targetMonthlyCost: 1000,
      assets: {},
      debts: {},
      passiveIncome: {
        rent: { amount: expected.rate * 1000, frequency: 'month' },
      },
      semiPassiveIncome: {},
    });

    assert.equal(metrics.stage.key, expected.key, `rate ${expected.rate}`);
  }
});

test('calculateMetrics returns null when finite ratio operands produce an infinite quotient', () => {
  const metrics = calculateMetrics({
    currentMonthlyCost: Number.MIN_VALUE,
    targetMonthlyCost: Number.MIN_VALUE,
    assets: { cash: Number.MAX_VALUE },
    debts: {},
    passiveIncome: {
      rent: { amount: Number.MAX_VALUE, frequency: 'month' },
    },
    semiPassiveIncome: {},
  });

  assert.equal(metrics.cashflowRetirementRate, null);
  assert.equal(metrics.assetRetirementRate, null);
  assert.equal(metrics.safetyMonths, null);
});

test('estimateRetirement estimates timing with the conservative zero-return model', () => {
  const estimate = estimateRetirement({
    age: 35,
    targetMonthlyCost: 10000,
    monthlyPassiveIncome: 2000,
    netAssets: 600000,
    monthlySalary: 20000,
    monthlySideIncome: 2000,
    monthlyLivingExpense: 8000,
    monthlyFixedExpense: 2000,
    monthlyDebtPayment: 2000,
  });

  assert.equal(estimate.status, 'estimated');
  assert.equal(estimate.monthlyInvestable, 10000);
  assert.equal(estimate.adjustedTargetAssets, 2400000);
  assert.equal(estimate.monthsRemaining, 180);
  assert.equal(estimate.estimatedAge, 50);
  assert.equal(estimate.daysRemaining, 5479);
});

test('estimateRetirement distinguishes reached and unavailable outcomes', () => {
  assert.equal(estimateRetirement({
    age: 40,
    targetMonthlyCost: 1000,
    monthlyPassiveIncome: 1000,
    netAssets: 0,
  }).status, 'reached');

  const unavailable = estimateRetirement({
    age: 40,
    targetMonthlyCost: 1000,
    monthlyPassiveIncome: 0,
    netAssets: 0,
  });
  assert.equal(unavailable.status, 'unavailable');
  assert.equal(unavailable.monthsRemaining, null);
  assert.equal(unavailable.estimatedAge, null);
  assert.equal(unavailable.daysRemaining, null);
});

test('estimateRetirement normalizes invalid and negative active cash flow amounts', () => {
  const estimate = estimateRetirement({
    age: 35,
    targetMonthlyCost: 1000,
    monthlyPassiveIncome: 0,
    netAssets: -1000,
    monthlySalary: -5000,
    monthlySideIncome: 'invalid',
    monthlyLivingExpense: -100,
    monthlyFixedExpense: Number.POSITIVE_INFINITY,
    monthlyDebtPayment: Number.NaN,
  });

  assert.equal(estimate.monthlyIncome, 0);
  assert.equal(estimate.monthlySpend, 0);
  assert.equal(estimate.monthlyInvestable, 0);
  assert.equal(estimate.assetGap, 301000);
  assert.equal(estimate.status, 'unavailable');
});

test('estimateRetirement contains non-finite derived calculations in a safe status', () => {
  const estimate = estimateRetirement({
    age: Number.MAX_VALUE,
    targetMonthlyCost: Number.MAX_VALUE,
    monthlyPassiveIncome: 0,
    netAssets: -Number.MAX_VALUE,
    monthlySalary: Number.MAX_VALUE,
  });

  assert.equal(estimate.status, 'unavailable');
  for (const value of Object.values(estimate)) {
    assert.equal(typeof value !== 'number' || Number.isFinite(value), true);
  }
});

test('calculateAccelerators reports conservative timing improvements', () => {
  const accelerators = calculateAccelerators({
    age: 35,
    targetMonthlyCost: 10000,
    monthlyPassiveIncome: 2000,
    netAssets: 600000,
    monthlySalary: 20000,
    monthlySideIncome: 2000,
    monthlyLivingExpense: 8000,
    monthlyFixedExpense: 2000,
    monthlyDebtPayment: 2000,
  });

  assert.deepEqual(accelerators.map((item) => item.addedMonthlyIncome), [100, 500, 1000]);
  assert.deepEqual(accelerators.map((item) => item.monthsEarlier), [3, 15, 30]);
  assert.deepEqual(accelerators.map((item) => item.yearsEarlier), [0.3, 1.3, 2.5]);
});

test('estimateRetirement rounds non-terminating months to two decimals', () => {
  const estimate = estimateRetirement({
    age: 30,
    targetMonthlyCost: 1000,
    monthlyPassiveIncome: 0,
    netAssets: 0,
    monthlySalary: 700,
  });

  assert.equal(estimate.monthsRemaining, 428.57);
});

test('estimateRetirement derives age and days from rounded months', () => {
  const estimate = estimateRetirement({
    age: 35,
    targetMonthlyCost: 1000,
    monthlyPassiveIncome: 0,
    netAssets: 299975,
    monthlySalary: 42,
  });

  assert.equal(estimate.monthsRemaining, 0.6);
  assert.equal(estimate.estimatedAge, 35.1);
  assert.equal(estimate.daysRemaining, 18);
});

test('calculateAccelerators preserves reached and unavailable baseline statuses', () => {
  for (const input of [
    { age: 40, targetMonthlyCost: 1000, monthlyPassiveIncome: 1000, netAssets: 0 },
    { age: 40, targetMonthlyCost: 1000, monthlyPassiveIncome: 0, netAssets: 0 },
  ]) {
    const baselineStatus = estimateRetirement(input).status;
    const accelerators = calculateAccelerators(input);

    assert.deepEqual(accelerators.map((item) => item.status), [
      baselineStatus,
      baselineStatus,
      baselineStatus,
    ]);
    assert.deepEqual(accelerators.map((item) => item.monthsEarlier), [null, null, null]);
    assert.deepEqual(accelerators.map((item) => item.yearsEarlier), [null, null, null]);
  }
});

test('formatCurrency and formatPercent return safe localized text', () => {
  assert.match(formatCurrency(1234.5), /1,234\.50/);
  assert.equal(formatPercent(0.1811), '18.1%');
  assert.equal(formatPercent(null), '暂无法计算');
  assert.equal(formatCurrency(Number.POSITIVE_INFINITY), '暂无法计算');
  assert.equal(formatPercent(Number.NaN), '暂无法计算');
});
