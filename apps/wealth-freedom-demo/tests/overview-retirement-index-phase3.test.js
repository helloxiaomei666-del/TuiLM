const assert = require("node:assert/strict");
const test = require("node:test");

const { getOverviewModel } = require("../wechat-miniapp/utils/overview-model.js");
const fixture = require("./fixtures/security-protection-accounts-phase3.fixture.js");

function buildState(securityAccounts) {
  return {
    mode: "user",
    userProfile: {
      livingCost: 6000,
      targetMonthlyLivingCost: 6000,
      target: 2000000,
      age: 35,
    },
    holdings: [
      { id: "cash", type: "cash", currentValue: 18000 },
      { id: "fund", type: "stock", currentValue: 1000000 },
    ],
    incomeStreams: [
      {
        id: "received-interest",
        sourceType: "deposit_interest",
        rawAmount: 100,
        frequency: "monthly",
        status: "current",
        actualReceived: true,
        requiresLabor: false,
      },
    ],
    manualDrags: [{ id: "mortgage", type: "mortgage", score: 2 }],
    securityAccounts,
  };
}

test("passes Security object through bridge into canonical protectionAccounts for Overview", () => {
  const withSecurity = getOverviewModel(buildState(fixture.validSecurityAccounts));
  const withoutSecurity = getOverviewModel(buildState({}));

  assert.equal(withSecurity.retirementIndexCompleteness, "COMPLETE");
  assert.notEqual(withoutSecurity.retirementIndexCompleteness, "COMPLETE");
  assert.equal(
    withSecurity.monthlyStablePassiveIncome,
    withoutSecurity.monthlyStablePassiveIncome,
  );
  assert.equal(
    withSecurity.passiveIncomeCoverageRate,
    withoutSecurity.passiveIncomeCoverageRate,
  );
});

test("keeps future pension estimates out of current passive income and coverage", () => {
  const lowerEstimateState = buildState({
    ...fixture.validSecurityAccounts,
    pension: {
      ...fixture.validSecurityAccounts.pension,
      estimatedMonthlyBenefit: 3000,
    },
  });
  const higherEstimateState = buildState({
    ...fixture.validSecurityAccounts,
    pension: {
      ...fixture.validSecurityAccounts.pension,
      estimatedMonthlyBenefit: 9000,
    },
  });
  const lower = getOverviewModel(lowerEstimateState);
  const higher = getOverviewModel(higherEstimateState);

  assert.equal(higher.monthlyStablePassiveIncome, lower.monthlyStablePassiveIncome);
  assert.equal(higher.passiveIncomeCoverageRate, lower.passiveIncomeCoverageRate);
});

test("keeps housing fund balance and loan offset out of assets and current passive income", () => {
  const base = getOverviewModel(buildState(fixture.validSecurityAccounts));
  const changed = getOverviewModel(buildState({
    ...fixture.validSecurityAccounts,
    housingFund: {
      ...fixture.validSecurityAccounts.housingFund,
      balance: 985000,
      loanOffsetMonthly: 8800,
    },
  }));

  assert.equal(changed.buckets.currentAssets, base.buckets.currentAssets);
  assert.equal(changed.monthlyStablePassiveIncome, base.monthlyStablePassiveIncome);
});
