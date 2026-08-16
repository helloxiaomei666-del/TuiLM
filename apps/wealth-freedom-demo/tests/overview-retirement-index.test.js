const assert = require("node:assert/strict");
const test = require("node:test");

const fixtures = require("./fixtures/retirement-index-v1.fixture.js");
const { getOverviewModel } = require("../wechat-miniapp/utils/overview-model.js");
const canonicalAdapter = require("../wechat-miniapp/utils/retirement-index-adapter.js");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createMiniappState() {
  const state = clone(fixtures.adapterInputs.miniapp);
  state.userProfile = {
    ...state.userProfile,
    target: state.targetRetirementAssets,
  };
  return state;
}

function calculateCanonical(state) {
  return canonicalAdapter.calculateCanonicalRetirement(state);
}

test("separates total asset progress from the primary retirement index", () => {
  const state = createMiniappState();
  const canonical = calculateCanonical(state);
  const overview = getOverviewModel(state);

  assert.equal(overview.totalAssetProgress, canonical.totalAssetProgress);
  assert.equal(overview.retirementIndex, canonical.retirementIndex);
  assert.notEqual(overview.retirementIndex, overview.totalAssetProgress);
});

test("gets the primary retirement index from the canonical adapter result", () => {
  const state = createMiniappState();
  const canonical = calculateCanonical(state);
  const overview = getOverviewModel(state);

  assert.equal(overview.retirementIndex, canonical.retirementIndex);
  assert.equal(overview.retirementIndexCompleteness, canonical.completeness.status);
});

test("exposes passive income coverage independently from the retirement index", () => {
  const state = createMiniappState();
  const overview = getOverviewModel(state);

  assert.equal(overview.monthlyStablePassiveIncome, 7130);
  assert.equal(overview.passiveIncomeCoverageRate, 7130 / 6000);
  assert.equal(overview.passiveIncomeCoverageText, "118.8%");
  assert.notEqual(overview.passiveIncomeCoverageRate, overview.retirementIndex);
});

test("changing market value changes asset progress without changing passive coverage", () => {
  const base = createMiniappState();
  const revalued = createMiniappState();
  revalued.investableAssets = {
    ...revalued.investableAssets,
    marketValue: 1200000,
    total: 1218000,
  };

  const baseOverview = getOverviewModel(base);
  const revaluedOverview = getOverviewModel(revalued);
  const baseCanonical = calculateCanonical(base);
  const revaluedCanonical = calculateCanonical(revalued);

  assert.equal(baseOverview.passiveIncomeCoverageRate, baseCanonical.passiveIncomeCoverageRate);
  assert.equal(revaluedOverview.passiveIncomeCoverageRate, revaluedCanonical.passiveIncomeCoverageRate);
  assert.equal(baseOverview.monthlyStablePassiveIncome, 7130);
  assert.equal(revaluedOverview.monthlyStablePassiveIncome, 7130);
  assert.equal(baseOverview.passiveIncomeCoverageRate, revaluedOverview.passiveIncomeCoverageRate);
  assert.equal(baseOverview.totalAssetProgress, baseCanonical.totalAssetProgress);
  assert.equal(revaluedOverview.totalAssetProgress, revaluedCanonical.totalAssetProgress);
  assert.notEqual(baseOverview.totalAssetProgress, revaluedOverview.totalAssetProgress);
});

test("does not present an insufficient canonical result as an available retirement index", () => {
  const state = {
    ...createMiniappState(),
    liquidCash: null,
    investableAssets: null,
    securityAccounts: [],
    manualDrags: [],
  };
  const canonical = calculateCanonical(state);
  const overview = getOverviewModel(state);

  assert.equal(canonical.completeness.status, "INSUFFICIENT");
  assert.equal(canonical.retirementIndex, null);
  assert.equal(overview.retirementIndexCompleteness, "INSUFFICIENT");
  assert.equal(overview.retirementIndexAvailable, false);
  assert.notEqual(overview.retirementIndexText, "0.0%");
});

test("future pension does not increase current passive income coverage", () => {
  const base = createMiniappState();
  const withFuturePension = createMiniappState();
  withFuturePension.incomeStreams = [
    ...withFuturePension.incomeStreams,
    {
      id: "future-pension-added",
      originKey: "future:pension:added",
      sourceType: "future_pension",
      amount: 10000,
      frequency: "monthly",
      status: "future",
      actualReceived: false,
    },
  ];

  const baseOverview = getOverviewModel(base);
  const futureOverview = getOverviewModel(withFuturePension);

  assert.equal(baseOverview.monthlyStablePassiveIncome, 7130);
  assert.equal(futureOverview.monthlyStablePassiveIncome, 7130);
  assert.equal(baseOverview.passiveIncomeCoverageRate, 7130 / 6000);
  assert.equal(futureOverview.passiveIncomeCoverageRate, 7130 / 6000);
});

test("selling principal does not increase current passive income coverage", () => {
  const state = createMiniappState();
  state.incomeStreams = [
    ...state.incomeStreams,
    {
      id: "principal-sale-added",
      originKey: "sale:principal:added",
      sourceType: "principal_sale",
      amount: 10000,
      frequency: "monthly",
      status: "current",
      actualReceived: true,
      isPrincipalSale: true,
    },
  ];
  const overview = getOverviewModel(state);

  assert.equal(overview.monthlyStablePassiveIncome, 7130);
  assert.equal(overview.passiveIncomeCoverageRate, 7130 / 6000);
});

test("does not count a duplicated income origin twice", () => {
  const state = createMiniappState();
  state.incomeStreams = [
    ...state.incomeStreams,
    {
      id: "duplicate-rent-added",
      originKey: "holding:canonical-rent:rent",
      sourceType: "rental_property",
      amount: 5000,
      frequency: "monthly",
      status: "current",
      actualReceived: true,
      netMonthlyCashflow: 5000,
    },
  ];
  const overview = getOverviewModel(state);

  assert.equal(overview.monthlyStablePassiveIncome, 7130);
  assert.equal(overview.passiveIncomeCoverageRate, 7130 / 6000);
});

test("keeps legacy progress fields as total asset progress aliases only", () => {
  const state = createMiniappState();
  state.holdings = [
    ...state.holdings,
    { id: "market-fund", type: "stock", currentValue: 1000000, costAmount: 1000000 },
  ];
  const canonical = calculateCanonical(state);
  const overview = getOverviewModel(state);

  assert.equal(overview.totalAssetProgress, canonical.totalAssetProgress);
  assert.equal(overview.totalAssetProgressText, "50.9%");
  assert.equal(overview.progress, 50);
  assert.equal(overview.progressText, "50.0%");
  assert.notEqual(overview.retirementIndex, overview.progress);
  assert.notEqual(overview.assetRetirementRateText, overview.retirementIndexText);
});

test("uses canonical eligible income instead of summing every net monthly cashflow", () => {
  const state = createMiniappState();
  state.incomeStreams = [
    ...state.incomeStreams,
    {
      id: "salary-not-passive",
      originKey: "active:salary:not-passive",
      sourceType: "salary",
      amount: 9999,
      frequency: "monthly",
      status: "current",
      actualReceived: true,
      netMonthlyCashflow: 9999,
    },
  ];
  const overview = getOverviewModel(state);

  assert.equal(overview.monthlyStablePassiveIncome, 7130);
  assert.equal(overview.passiveIncomeCoverageRate, 7130 / 6000);
});
