const assert = require("node:assert/strict");
const test = require("node:test");

const { getOverviewModel, buildCalculationValues } = require("../wechat-miniapp/utils/overview-model.js");
const canonicalAdapter = require("../wechat-miniapp/utils/retirement-index-adapter.js");
const canonicalFixture = require("./fixtures/retirement-index-v1.fixture.js");
const liabilityFixture = require("./fixtures/liability-facts-phase4a.fixture.js");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function completeInput(liabilities) {
  return {
    schemaVersion: 3,
    mode: "user",
    inputCompletion: {
      profile: true,
      assets: true,
      incomeSources: true,
      protectionAccounts: true,
      dragItems: true,
      liabilities,
    },
    userProfile: {
      livingCost: 6000,
      targetMonthlyLivingCost: 6000,
      target: 2000000,
      mortgage: 3000,
      carLoan: 400,
      otherDebt: 200,
    },
    holdings: [
      { id: "cash", type: "cash", currentValue: 18000 },
      { id: "fund", type: "stock", currentValue: 1000000 },
    ],
    incomeStreams: [],
    manualDrags: [{ id: "legacy-drag", category: "mortgage", amount: 3000 }],
    securityAccounts: {},
    liabilities: [],
  };
}

test("raw liabilities and their completion do not alter retirement or legacy simulation outputs", () => {
  const withoutLiabilities = completeInput(false);
  const withLiabilities = {
    ...completeInput(true),
    liabilities: clone(liabilityFixture.validLiabilities),
  };
  const before = getOverviewModel(withoutLiabilities);
  const after = getOverviewModel(withLiabilities);

  [
    "retirementIndex",
    "totalAssetProgress",
    "passiveIncomeCoverageRate",
    "cashSafetyRunwayMonths",
    "retirementIndexCompleteness",
    "dragTotalText",
  ].forEach((key) => assert.deepEqual(after[key], before[key], key));
  assert.deepEqual(after.result.monthlyInvestable, before.result.monthlyInvestable);
  assert.deepEqual(after.result.months, before.result.months);
  assert.deepEqual(buildCalculationValues(withLiabilities), buildCalculationValues(withoutLiabilities));
  assert.deepEqual(withLiabilities.manualDrags, withoutLiabilities.manualDrags);

  const complete = canonicalAdapter.getCompletenessStatus({
    ...clone(canonicalFixture.canonicalV1Input),
    inputCompletion: {
      profile: true,
      assets: true,
      incomeSources: true,
      protectionAccounts: true,
      dragItems: true,
      liabilities: true,
    },
  });
  const withoutLiabilityCompletion = canonicalAdapter.getCompletenessStatus({
    ...clone(canonicalFixture.canonicalV1Input),
    inputCompletion: {
      profile: true,
      assets: true,
      incomeSources: true,
      protectionAccounts: true,
      dragItems: true,
      liabilities: false,
    },
  });

  assert.deepEqual(complete, withoutLiabilityCompletion);
});
