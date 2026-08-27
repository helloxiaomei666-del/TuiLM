const assert = require("node:assert/strict");
const test = require("node:test");

const fixture = require("./fixtures/liability-facts-phase4a.fixture.js");
const {
  LIABILITY_TYPES,
  validateLiabilityFact,
  validateLiabilityFacts,
  calculateLiabilitySummary,
} = require("../wechat-miniapp/utils/liability-model.js");

function validFact(overrides = {}) {
  return {
    ...fixture.clone(fixture.validLiabilities[0]),
    ...overrides,
  };
}

function assertChineseFailure(result) {
  assert.equal(result.ok, false);
  assert.equal(typeof result.message, "string");
  assert.match(result.message, /[\u4e00-\u9fff]/);
}

test("exposes exactly the five V1 liability types with Chinese labels", () => {
  assert.deepEqual(
    LIABILITY_TYPES.map((item) => [item.value, item.label]),
    [
      ["mortgage", "房贷"],
      ["car_loan", "车贷"],
      ["consumer_loan", "消费贷"],
      ["credit_card_debt", "信用卡债务"],
      ["other", "其他负债"],
    ],
  );
});

test("validates a V1 liability without retaining non-contract fields", () => {
  const source = validFact({ ignored: "not-a-fact" });
  const result = validateLiabilityFact(source, []);

  assert.equal(result.ok, true);
  assert.deepEqual(result.value, fixture.validLiabilities[0]);
  assert.deepEqual(source, validFact({ ignored: "not-a-fact" }));
});

test("rejects every invalid V1 field instead of coercing raw values", () => {
  const cases = [
    ["empty id", { id: "" }],
    ["unknown type", { type: "loan" }],
    ["string balance", { outstandingBalance: "120000" }],
    ["zero balance", { outstandingBalance: 0 }],
    ["negative balance", { outstandingBalance: -1 }],
    ["NaN balance", { outstandingBalance: NaN }],
    ["infinite balance", { outstandingBalance: Infinity }],
    ["negative infinite balance", { outstandingBalance: -Infinity }],
    ["string monthly payment", { monthlyPayment: "1600" }],
    ["negative monthly payment", { monthlyPayment: -1 }],
    ["NaN monthly payment", { monthlyPayment: NaN }],
    ["infinite monthly payment", { monthlyPayment: Infinity }],
    ["null inclusion marker", { includedInEssentialExpense: null }],
    ["undefined inclusion marker", { includedInEssentialExpense: undefined }],
    ["string true inclusion marker", { includedInEssentialExpense: "true" }],
    ["string false inclusion marker", { includedInEssentialExpense: "false" }],
    ["non-manual source", { source: "import" }],
    ["non-string note", { note: 1 }],
  ];

  cases.forEach(([name, overrides]) => {
    const result = validateLiabilityFact(validFact(overrides), []);
    assertChineseFailure(result, name);
  });
});

test("accepts a zero monthly payment but requires a positive outstanding balance", () => {
  const zeroPayment = validateLiabilityFact(validFact({ monthlyPayment: 0 }), []);
  assert.equal(zeroPayment.ok, true);
  assert.equal(zeroPayment.value.monthlyPayment, 0);

  const settled = validateLiabilityFact(validFact({ outstandingBalance: 0 }), []);
  assertChineseFailure(settled);
});

test("rejects duplicate IDs and non-array liability collections", () => {
  const duplicate = validateLiabilityFacts([
    validFact(),
    validFact({ monthlyPayment: 0 }),
  ]);
  assertChineseFailure(duplicate);

  assertChineseFailure(validateLiabilityFacts({}));
});

test("returns new validated facts and leaves collection inputs immutable", () => {
  const source = fixture.clone(fixture.validLiabilities);
  const before = fixture.clone(source);
  const result = validateLiabilityFacts(source);

  assert.equal(result.ok, true);
  assert.deepEqual(result.value, before);
  assert.notEqual(result.value, source);
  assert.notEqual(result.value[0], source[0]);
  assert.deepEqual(source, before);
});

test("derives all five liability summary values with deduplicated monthly payment", () => {
  const source = fixture.clone(fixture.validLiabilities);
  const before = fixture.clone(source);
  const context = fixture.clone(fixture.summaryContext);
  const summary = calculateLiabilitySummary(source, context);

  assert.deepEqual(summary, {
    totalLiabilities: 150000,
    totalMonthlyPayment: 2500,
    uncoveredMonthlyPayment: 900,
    effectiveEssentialExpense: 6900,
    investableNetAssets: -50000,
  });
  assert.deepEqual(source, before);
  assert.deepEqual(context, fixture.summaryContext);
});

test("returns zero totals for no liabilities and null only for unavailable summary bases", () => {
  assert.deepEqual(calculateLiabilitySummary([], {}), {
    totalLiabilities: 0,
    totalMonthlyPayment: 0,
    uncoveredMonthlyPayment: 0,
    effectiveEssentialExpense: null,
    investableNetAssets: null,
  });

  const summary = calculateLiabilitySummary(fixture.validLiabilities, {
    monthlyEssentialExpense: NaN,
    investableAssetsTotal: Infinity,
  });
  assert.equal(summary.effectiveEssentialExpense, null);
  assert.equal(summary.investableNetAssets, null);
  assert.equal(summary.totalLiabilities, 150000);
  assert.equal(summary.uncoveredMonthlyPayment, 900);
});

test("returns null effective essential expense when the base expense is zero", () => {
  const summary = calculateLiabilitySummary(fixture.validLiabilities, {
    monthlyEssentialExpense: 0,
    investableAssetsTotal: 100000,
  });

  assert.equal(summary.effectiveEssentialExpense, null);
  assert.equal(summary.uncoveredMonthlyPayment, 900);
});

test("returns null effective essential expense when the base expense is negative", () => {
  const summary = calculateLiabilitySummary(fixture.validLiabilities, {
    monthlyEssentialExpense: -1,
    investableAssetsTotal: 100000,
  });

  assert.equal(summary.effectiveEssentialExpense, null);
  assert.equal(summary.uncoveredMonthlyPayment, 900);
});
