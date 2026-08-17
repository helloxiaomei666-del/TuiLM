const assert = require("node:assert/strict");
const test = require("node:test");

const fixture = require("./fixtures/security-protection-accounts-phase3.fixture.js");

function loadBridge() {
  try {
    return require("../wechat-miniapp/utils/security-protection-accounts-bridge.js");
  } catch (error) {
    if (
      error &&
      error.code === "MODULE_NOT_FOUND" &&
      String(error.message).includes("security-protection-accounts-bridge")
    ) {
      return {};
    }
    throw error;
  }
}

function requireBuildProtectionAccounts() {
  const bridge = loadBridge();
  assert.equal(
    typeof bridge.buildProtectionAccounts,
    "function",
    "Phase 3 bridge must export buildProtectionAccounts(securityAccounts = {})",
  );
  return bridge.buildProtectionAccounts;
}

test("maps every persisted Security group to the frozen protection account contract", () => {
  const buildProtectionAccounts = requireBuildProtectionAccounts();
  const result = buildProtectionAccounts(fixture.validSecurityAccounts);

  assert.deepEqual(result, fixture.expectedProtectionAccounts);
});

test("returns no protection records for empty, unknown, or reserved-only Security facts", () => {
  const buildProtectionAccounts = requireBuildProtectionAccounts();

  assert.deepEqual(buildProtectionAccounts({}), []);
  assert.deepEqual(
    buildProtectionAccounts({
      unknownAccount: { balance: 100 },
      commercialPensionInsurance: { balance: 100 },
    }),
    [],
  );
});

test("keeps the raw Security object immutable while producing stable source ids and order", () => {
  const buildProtectionAccounts = requireBuildProtectionAccounts();
  const source = structuredClone(fixture.validSecurityAccounts);

  const result = buildProtectionAccounts(source);

  assert.deepEqual(source, fixture.validSecurityAccounts);
  assert.deepEqual(
    result.map((item) => item.sourceKey),
    ["pension", "housingFund", "supplementalHousingFund", "enterpriseAnnuity", "occupationalAnnuity"],
  );
  assert.deepEqual(
    result.map((item) => item.id),
    result.map((item) => `security:${item.sourceKey}`),
  );
});

test("omits invalid or negative user facts instead of coercing them into canonical values", () => {
  const buildProtectionAccounts = requireBuildProtectionAccounts();

  assert.deepEqual(buildProtectionAccounts(fixture.invalidSecurityAccounts), []);
});

test("sanitizes every managed numeric field across positive, zero, missing, and invalid values", () => {
  const buildProtectionAccounts = requireBuildProtectionAccounts();
  const fields = [
    ["pension", "balance", "balance"],
    ["pension", "yearsPaid", "yearsPaid"],
    ["pension", "personalMonthly", "personalMonthlyContribution"],
    ["pension", "employerMonthly", "employerMonthlyContribution"],
    ["pension", "estimatedMonthlyBenefit", "futureEstimatedMonthlyAmount"],
    ["housingFund", "balance", "balance"],
    ["housingFund", "personalMonthly", "personalMonthlyContribution"],
    ["housingFund", "employerMonthly", "employerMonthlyContribution"],
    ["housingFund", "loanOffsetMonthly", "currentLoanOffsetMonthly"],
    ["supplementalHousingFund", "balance", "balance"],
    ["supplementalHousingFund", "personalMonthly", "personalMonthlyContribution"],
    ["supplementalHousingFund", "employerMonthly", "employerMonthlyContribution"],
    ["supplementalHousingFund", "loanOffsetMonthly", "currentLoanOffsetMonthly"],
    ["enterpriseAnnuity", "balance", "balance"],
    ["enterpriseAnnuity", "personalMonthly", "personalMonthlyContribution"],
    ["enterpriseAnnuity", "employerMonthly", "employerMonthlyContribution"],
    ["enterpriseAnnuity", "estimatedMonthlyBenefit", "futureEstimatedMonthlyAmount"],
    ["occupationalAnnuity", "balance", "balance"],
    ["occupationalAnnuity", "personalMonthly", "personalMonthlyContribution"],
    ["occupationalAnnuity", "employerMonthly", "employerMonthlyContribution"],
    ["occupationalAnnuity", "estimatedMonthlyBenefit", "futureEstimatedMonthlyAmount"],
  ];
  const invalidValues = [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

  for (const [sourceKey, inputKey, outputKey] of fields) {
    const validGroup = fixture.validSecurityAccounts[sourceKey];
    const positive = buildProtectionAccounts({
      [sourceKey]: { ...validGroup, [inputKey]: 7 },
    }).find((item) => item.sourceKey === sourceKey);
    assert.equal(positive[outputKey], 7, `${sourceKey}.${inputKey} positive value`);

    const zero = buildProtectionAccounts({
      [sourceKey]: { ...validGroup, [inputKey]: 0 },
    }).find((item) => item.sourceKey === sourceKey);
    assert.equal(zero[outputKey], 0, `${sourceKey}.${inputKey} zero value`);

    const missingGroup = { ...validGroup };
    delete missingGroup[inputKey];
    const missing = buildProtectionAccounts({ [sourceKey]: missingGroup }).find(
      (item) => item.sourceKey === sourceKey,
    );
    assert.equal(outputKey in missing, false, `${sourceKey}.${inputKey} missing value`);

    for (const invalid of invalidValues) {
      const record = buildProtectionAccounts({
        [sourceKey]: { ...validGroup, [inputKey]: invalid },
      }).find((item) => item.sourceKey === sourceKey);
      assert.equal(outputKey in record, false, `${sourceKey}.${inputKey} invalid value`);
    }
  }
});

test("accepts zero facts and omits undefined facts without inventing defaults", () => {
  const buildProtectionAccounts = requireBuildProtectionAccounts();
  const source = {
    pension: {
      balance: 0,
      yearsPaid: 0,
      personalMonthly: undefined,
      employerMonthly: 0,
      estimatedMonthlyBenefit: 0,
    },
    housingFund: {
      balance: undefined,
      personalMonthly: 0,
      employerMonthly: undefined,
      loanOffsetMonthly: 0,
    },
  };

  const result = buildProtectionAccounts(source);
  const pension = result.find((item) => item.sourceKey === "pension");
  const housing = result.find((item) => item.sourceKey === "housingFund");

  assert.equal(pension.balance, 0);
  assert.equal(pension.yearsPaid, 0);
  assert.equal(pension.employerMonthlyContribution, 0);
  assert.equal(pension.futureEstimatedMonthlyAmount, 0);
  assert.equal("personalMonthlyContribution" in pension, false);
  assert.equal("balance" in housing, false);
  assert.equal(housing.personalMonthlyContribution, 0);
  assert.equal("employerMonthlyContribution" in housing, false);
  assert.equal(housing.currentLoanOffsetMonthly, 0);
});

test("isolates future estimated benefits from current income fields with an explicit safety marker", () => {
  const buildProtectionAccounts = requireBuildProtectionAccounts();
  const result = buildProtectionAccounts(fixture.validSecurityAccounts);
  const futureAccounts = result.filter((item) => [
    "pension",
    "enterpriseAnnuity",
    "occupationalAnnuity",
  ].includes(item.sourceKey));

  futureAccounts.forEach((account) => {
    assert.equal(account.actualMonthlyReceived, 0);
    assert.equal(["pension_received", "annuity_received"].includes(account.type), false);
    assert.equal("netMonthlyPassiveIncome" in account, false);
    assert.equal("monthlyStablePassiveIncome" in account, false);
    assert.equal("incomeSources" in account, false);
  });
});
