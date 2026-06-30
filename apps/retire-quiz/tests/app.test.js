const test = require('node:test');
const assert = require('node:assert/strict');

const {
  APP_VIEW,
  buildResultHeroCopy,
  buildShareCopy,
  init,
  buildGuidedSummaries,
  formatResultCurrency,
  formatWholeCurrency,
  normalizeFormData,
  validateForReport,
} = require('../js/app.js');

test('APP_VIEW defines the four H5 shell states', () => {
  assert.deepEqual(APP_VIEW, {
    LANDING: 'landing',
    FORM: 'form',
    RESULT: 'result',
    POSTER: 'poster',
  });
});

test('normalizeFormData falls back target cost to current cost', () => {
  const data = normalizeFormData({
    currentMonthlyCost: '8000',
    targetMonthlyCost: '',
  });

  assert.equal(data.currentMonthlyCost, 8000);
  assert.equal(data.targetMonthlyCost, 8000);
});

test('normalizeFormData maps property value and mortgage balance to calculator input', () => {
  const data = normalizeFormData({
    propertyValue: '3000000',
    mortgageBalance: '1000000',
  });

  assert.equal(data.propertyValue, 3000000);
  assert.equal(data.mortgageBalance, 1000000);
  assert.equal(data.assets.propertyValue, 3000000);
  assert.equal(data.debts.mortgageBalance, 1000000);
});

test('normalizeFormData safely migrates legacy property value fields', () => {
  assert.equal(normalizeFormData({ propertyEquity: '1200000' }).propertyValue, 1200000);
  assert.equal(normalizeFormData({ propertyNetValue: '1300000' }).propertyValue, 1300000);
  assert.equal(normalizeFormData({ realEstateNetValue: '1400000' }).propertyValue, 1400000);
});

test('formatWholeCurrency displays whole yuan without meaningless decimals', () => {
  assert.equal(formatWholeCurrency(1354000), '¥1,354,000');
  assert.equal(formatWholeCurrency(1340209.4), '¥1,340,209');
});

test('formatResultCurrency displays monthly result money without meaningless decimals', () => {
  assert.equal(formatResultCurrency(3), '¥3');
  assert.equal(formatResultCurrency(2200), '¥2,200');
  assert.equal(formatResultCurrency(2200.4), '¥2,200');
});

test('buildResultHeroCopy presents zero freedom progress as foundation building', () => {
  const copy = buildResultHeroCopy({
    cashflowRetirementRate: 0,
    laborDependencyRate: 1,
    statuses: {
      cashFlowStatus: { label: '完全工资依赖期' },
      posterSummary: {
        stageLabel: '现金流萌芽中',
        summaryText: '资产刚刚开始发力，但生活大部分还要靠工资支撑。',
      },
    },
  });

  assert.deepEqual(copy, {
    rateText: '0%',
    stageLabel: '打基础中',
    summaryText: '稳定现金流还没真正接班，现在主要还是靠自己扛。',
    detailText: '现在有 0% 的生活成本，不用完全靠工资来扛。',
    cautionText: '本结果仅用于个人财务观察，不构成投资、理财、保险或退休决策建议。',
  });
});

test('buildShareCopy creates concise copy for manual sharing', () => {
  const copy = buildShareCopy({
    freedomProgress: '40%',
  });

  assert.equal(copy, [
    '测一测你的自由进度｜退了吗',
    '',
    '我的自由进度是 40%。',
    '现在有 40% 的生活成本，不用完全靠工资来扛。',
    '',
    '你也可以测测自己的自由进度。',
  ].join('\n'));
});

test('buildGuidedSummaries explains each live form summary', () => {
  const summaries = buildGuidedSummaries({
    cash: 100000,
    funds: 200000,
    stocks: 300000,
    gold: 40000,
    propertyValue: 700000,
    otherAssets: 14000,
    mortgageBalance: 10000,
    carLoan: 2000,
    consumerLoan: 1000,
    otherDebt: 791,
    monthlySalary: 20000,
    monthlySideIncome: 3000,
    monthlyLivingExpense: 9000,
    monthlyFixedExpense: 4000,
    monthlyDebtPayment: 2000,
    dividends: 12000,
    dividendsFrequency: 'year',
    rent: 3000,
    rentFrequency: 'month',
    semiPassive: 6000,
    semiPassiveFrequency: 'quarter',
  });

  assert.match(summaries.assets, /资产小结/);
  assert.match(summaries.assets, /当前总资产：¥1,354,000/);
  assert.match(summaries.assets, /系统会用“总资产 - 总负债”计算你的净资产/);
  assert.doesNotMatch(summaries.assets, /\.00/);

  assert.match(summaries.debts, /净资产小结/);
  assert.match(summaries.debts, /总负债：¥13,791/);
  assert.match(summaries.debts, /当前净资产：¥1,340,209/);
  assert.match(summaries.debts, /净资产 = 总资产 - 总负债/);

  assert.match(summaries.cashflow, /每月现金流小结/);
  assert.match(summaries.cashflow, /月收入：¥23,000/);
  assert.match(summaries.cashflow, /月支出：¥15,000/);
  assert.match(summaries.cashflow, /月可投入金额：¥8,000/);

  assert.match(summaries.passive, /资产收入小结/);
  assert.match(summaries.passive, /稳定被动收入：¥4,000 \/ 月/);
  assert.match(summaries.passive, /半被动收入：¥2,000 \/ 月/);
  assert.match(summaries.passive, /资产月收入：¥6,000 \/ 月/);
  assert.match(summaries.passive, /自由进度主要看稳定被动收入能覆盖多少生活成本/);
});

test('validateForReport returns actionable required-field errors', () => {
  const errors = validateForReport({
    age: 0,
    currentMonthlyCost: 0,
    targetMonthlyCost: 0,
  });

  assert.deepEqual(Object.keys(errors), [
    'age',
    'currentMonthlyCost',
    'targetMonthlyCost',
  ]);
});

test('desired freedom age cannot be below current age', () => {
  const errors = validateForReport({
    age: 40,
    desiredRetirementAge: 35,
    currentMonthlyCost: 8000,
    targetMonthlyCost: 8000,
  });

  assert.equal(errors.desiredRetirementAge, '希望达成自由状态的年龄不能低于当前年龄');
});

test('current age below 18 returns a clear age error', () => {
  const errors = validateForReport({
    age: 5,
    currentMonthlyCost: 8000,
    targetMonthlyCost: 8000,
  });

  assert.equal(errors.age, '当前年龄需在 18 到 100 岁之间');
});

test('current age above 100 returns an age error', () => {
  const errors = validateForReport({
    age: 101,
    currentMonthlyCost: 8000,
    targetMonthlyCost: 8000,
  });

  assert.equal(errors.age, '当前年龄需在 18 到 100 岁之间');
});

test('desired freedom age above 100 returns a desired freedom age error', () => {
  const errors = validateForReport({
    age: 40,
    desiredRetirementAge: 150,
    currentMonthlyCost: 8000,
    targetMonthlyCost: 8000,
  });

  assert.equal(errors.desiredRetirementAge, '希望达成自由状态的年龄需在 18 到 100 岁之间');
});

test('empty desired retirement age remains allowed', () => {
  const errors = validateForReport({
    age: 40,
    desiredRetirementAge: '',
    currentMonthlyCost: 8000,
    targetMonthlyCost: 8000,
  });

  assert.equal(errors.desiredRetirementAge, undefined);
});

test('init tolerates a blocked localStorage getter', () => {
  const doc = {
    defaultView: {
      get localStorage() {
        throw new Error('blocked localStorage getter');
      },
    },
    getElementById() {
      return null;
    },
  };

  assert.doesNotThrow(() => init({ document: doc }));
});
