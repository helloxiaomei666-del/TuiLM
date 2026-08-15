const assert = require("node:assert/strict");
const test = require("node:test");

const fixtures = require("./fixtures/retirement-index-v1.fixture.js");

function retirementIndexModel() {
  return require("../wechat-miniapp/utils/retirement-index-model.js");
}

test("computes passive income coverage from stable monthly passive income and essential expense", () => {
  const model = retirementIndexModel();

  const result = model.computePassiveIncomeCoverage({
    monthlyStablePassiveIncome: 3000,
    monthlyEssentialExpense: 6000,
    totalAssetProgress: 1,
    monthlySalarySurplus: 99999,
  });

  assert.deepEqual(result, {
    ok: true,
    value: 0.5,
    displayProgress: 0.5,
    reason: null,
  });
});

test("does not fall back to asset progress or salary surplus when essential expense is missing", () => {
  const model = retirementIndexModel();

  const result = model.computePassiveIncomeCoverage({
    monthlyStablePassiveIncome: 3000,
    totalAssetProgress: 1,
    monthlySalarySurplus: 50000,
    totalMonthlyOutflow: 6000,
  });

  assert.deepEqual(result, {
    ok: false,
    value: null,
    displayProgress: null,
    reason: "invalid_monthly_essential_expense",
  });
});

test("keeps passive income coverage above one while capping display progress at one", () => {
  const model = retirementIndexModel();

  const result = model.computePassiveIncomeCoverage({
    monthlyStablePassiveIncome: 9000,
    monthlyEssentialExpense: 6000,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value, 1.5);
  assert.equal(result.displayProgress, 1);
});

test("includes all qualifying current stable income source types in stable monthly passive income", () => {
  const model = retirementIndexModel();

  const result = model.calculateStablePassiveIncome({
    incomeSources: fixtures.eligibleIncomeSources,
  });

  assert.equal(result.value, 3000);
  assert.equal(result.included.length, 10);
  assert.deepEqual(result.excluded, []);
});

test("excludes salary and one-off income from core passive income", () => {
  const model = retirementIndexModel();

  const result = model.calculateStablePassiveIncome({
    incomeSources: [fixtures.eligibleIncomeSources[0], ...fixtures.excludedIncomeSources],
  });

  assert.equal(result.value, 500);
  assert.equal(result.included.length, 1);
  assert.deepEqual(
    result.excluded.map((item) => item.reason),
    [
      "active_salary",
      "active_part_time_income",
      "one_off_income",
      "unrealized_stock_gain",
      "unrealized_fund_gain",
      "property_appreciation",
      "trading_gain",
      "principal_sale",
      "expected_not_received",
      "future_benefit",
      "temporary_income",
    ],
  );
});

test("counts rental property by net rent instead of property value", () => {
  const model = retirementIndexModel();

  const result = model.calculateStablePassiveIncome({
    incomeSources: [fixtures.rentalProperty],
  });

  assert.equal(result.value, 3000);
  assert.equal(result.included[0].monthlyAmount, 3000);
});

test("does not infer stock or dividend ETF income from market value without an actual received distribution", () => {
  const model = retirementIndexModel();

  const result = model.calculateStablePassiveIncome({
    incomeSources: [
      {
        id: "high-dividend-stock-without-payment",
        originKey: "holding:high-dividend-stock-without-payment:dividend",
        sourceType: "stock_dividend",
        marketValue: 1000000,
        expectedDividendYield: 0.08,
        actualDividendReceived: 0,
        status: "current",
        stabilityLevel: "high",
        requiresLabor: false,
        isOneOff: false,
        isPrincipalSale: false,
      },
      {
        id: "dividend-etf-without-payment",
        originKey: "holding:dividend-etf-without-payment:distribution",
        sourceType: "dividend_etf_distribution",
        marketValue: 1000000,
        expectedDistributionYield: 0.08,
        actualDividendReceived: 0,
        status: "current",
        stabilityLevel: "high",
        requiresLabor: false,
        isOneOff: false,
        isPrincipalSale: false,
      },
    ],
  });

  assert.equal(result.value, 0);
  assert.deepEqual(
    result.excluded.map((item) => item.reason),
    ["actual_cashflow_not_received", "actual_cashflow_not_received"],
  );
});

test("counts a bond by current coupon cashflow without treating principal as passive income", () => {
  const model = retirementIndexModel();

  const result = model.calculateStablePassiveIncome({
    incomeSources: [
      {
        id: "bond-coupon-with-principal",
        originKey: "holding:bond-coupon-with-principal:coupon",
        sourceType: "bond_coupon",
        principal: 500000,
        actualInterestReceived: 1200,
        frequency: "annual",
        status: "current",
        stabilityLevel: "high",
        requiresLabor: false,
        isOneOff: false,
        isPrincipalSale: false,
      },
    ],
  });

  assert.equal(result.value, 100);
});

test("does not count the same income source twice across holdings and income streams", () => {
  const model = retirementIndexModel();

  const result = model.calculateStablePassiveIncome({
    holdings: [fixtures.eligibleIncomeSources[0]],
    incomeSources: [{ ...fixtures.eligibleIncomeSources[0], id: "duplicate-rent" }],
  });

  assert.equal(result.value, 500);
  assert.equal(result.included.length, 1);
  assert.equal(result.excluded[0].reason, "duplicate_origin");
});

test("caps drag penalty at twenty points", () => {
  const model = retirementIndexModel();

  const result = model.computeDragPenalty(fixtures.dragItems, fixtures.retirementIndexV1Config);

  assert.equal(result.value, 20);
  assert.equal(result.items.length, 7);
});

test("applies drag penalty to retirement index without reducing raw passive income", () => {
  const model = retirementIndexModel();

  const withoutDrag = model.composeRetirementIndex(
    fixtures.indexComposition.scores,
    0,
    fixtures.retirementIndexV1Config,
  );
  const withDrag = model.composeRetirementIndex(
    fixtures.indexComposition.scores,
    10,
    fixtures.retirementIndexV1Config,
  );

  assert.equal(withoutDrag.value, 54);
  assert.equal(withDrag.value, 44);
  assert.equal(withDrag.metrics.monthlyStablePassiveIncome, undefined);
});

test("keeps retirement index weights in one configuration object", () => {
  const model = retirementIndexModel();

  assert.deepEqual(model.DEFAULT_RETIREMENT_INDEX_CONFIG.weights, {
    passiveIncomeCoverage: 0.4,
    cashSafetyRunway: 0.15,
    incomeAssetQuality: 0.15,
    totalAssetProgress: 0.15,
    protectionAccount: 0.15,
  });
  assert.equal(model.DEFAULT_RETIREMENT_INDEX_CONFIG.dragPenaltyCap, 20);
  assert.ok(
    model.DEFAULT_RETIREMENT_INDEX_CONFIG.weights.passiveIncomeCoverage
      > model.DEFAULT_RETIREMENT_INDEX_CONFIG.weights.cashSafetyRunway,
  );
});

test("explains retirement index changes after a valid weight change", () => {
  const model = retirementIndexModel();
  const changedWeights = {
    ...fixtures.retirementIndexV1Config,
    weights: {
      passiveIncomeCoverage: 0.2,
      cashSafetyRunway: 0.35,
      incomeAssetQuality: 0.15,
      totalAssetProgress: 0.15,
      protectionAccount: 0.15,
    },
  };

  const result = model.composeRetirementIndex(
    fixtures.indexComposition.scores,
    fixtures.indexComposition.dragPenaltyScore,
    changedWeights,
  );

  assert.equal(result.value, 48);
  assert.deepEqual(result.contributions, {
    passiveIncomeCoverage: 12,
    cashSafetyRunway: 28,
    incomeAssetQuality: 6,
    totalAssetProgress: 7.5,
    protectionAccount: 4.5,
    dragPenalty: -10,
  });
});

test("rejects invalid retirement index weights", () => {
  const model = retirementIndexModel();

  const result = model.validateRetirementIndexConfig({
    ...fixtures.retirementIndexV1Config,
    weights: {
      ...fixtures.retirementIndexV1Config.weights,
      passiveIncomeCoverage: 0.5,
    },
  });

  assert.deepEqual(result, {
    ok: false,
    reason: "invalid_weight_sum",
  });
});
