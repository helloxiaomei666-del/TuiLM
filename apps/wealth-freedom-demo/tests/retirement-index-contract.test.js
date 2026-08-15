const assert = require("node:assert/strict");
const test = require("node:test");

const fixtures = require("./fixtures/retirement-index-v1.fixture.js");

function loadCanonicalAdapter() {
  try {
    return require("../wechat-miniapp/utils/retirement-index-adapter.js");
  } catch (error) {
    if (
      error &&
      error.code === "MODULE_NOT_FOUND" &&
      String(error.message).includes("retirement-index-adapter")
    ) {
      return {};
    }
    throw error;
  }
}

function requireContractFunction(adapter, name) {
  assert.equal(
    typeof adapter[name],
    "function",
    `canonical adapter/schema contract not implemented: ${name}`,
  );
  return adapter[name];
}

test("exposes the canonical adapter, expense, calculation, and completeness contracts", () => {
  const adapter = loadCanonicalAdapter();

  [
    "normalizeCanonicalInput",
    "normalizeMonthlyEssentialExpense",
    "calculateCanonicalRetirement",
    "getCompletenessStatus",
  ].forEach((name) => requireContractFunction(adapter, name));
});

test("normalizes miniapp Web and H5 inputs to the same canonical core object", () => {
  const adapter = loadCanonicalAdapter();
  const normalize = requireContractFunction(adapter, "normalizeCanonicalInput");

  Object.entries(fixtures.adapterInputs).forEach(([platform, input]) => {
    assert.deepEqual(
      normalize(platform, input),
      fixtures.canonicalV1Input,
      `${platform} adapter must preserve canonical facts`,
    );
  });
});

test("normalizes legacy living cost aliases into monthly essential expense", () => {
  const adapter = loadCanonicalAdapter();
  const normalizeExpense = requireContractFunction(adapter, "normalizeMonthlyEssentialExpense");

  [
    { livingCost: 6000 },
    { targetMonthlyLivingCost: 6000 },
    { targetMonthlyCost: 6000 },
  ].forEach((input) => {
    const result = normalizeExpense(input);
    assert.equal(result.ok, true);
    assert.equal(result.value, 6000);
  });

  const missing = normalizeExpense({});
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, "missing_monthly_essential_expense");
});

test("keeps future pension in protection facts without current passive income coverage", () => {
  const adapter = loadCanonicalAdapter();
  const calculate = requireContractFunction(adapter, "calculateCanonicalRetirement");
  const futurePension = fixtures.canonicalIncomeSources.find(
    (source) => source.sourceType === "future_pension",
  );

  const result = calculate({
    ...fixtures.canonicalV1Input,
    incomeSources: [futurePension],
  });

  assert.equal(result.monthlyStablePassiveIncome, 0);
  assert.equal(result.passiveIncomeCoverageRate, 0);
  assert.equal(result.excludedIncomeSources[0].reason, "future_benefit");
});

test("excludes stock fund and property principal sales from passive income", () => {
  const adapter = loadCanonicalAdapter();
  const calculate = requireContractFunction(adapter, "calculateCanonicalRetirement");
  const principalSale = fixtures.canonicalIncomeSources.find(
    (source) => source.sourceType === "principal_sale",
  );

  const result = calculate({
    ...fixtures.canonicalV1Input,
    incomeSources: [principalSale],
  });

  assert.equal(result.monthlyStablePassiveIncome, 0);
  assert.equal(result.passiveIncomeCoverageRate, 0);
  assert.equal(result.excludedIncomeSources[0].reason, "principal_sale");
});

test("keeps passive income coverage unchanged when asset market value changes", () => {
  const adapter = loadCanonicalAdapter();
  const calculate = requireContractFunction(adapter, "calculateCanonicalRetirement");

  const base = calculate(fixtures.canonicalV1Input);
  const revalued = calculate({
    ...fixtures.canonicalV1Input,
    investableAssets: {
      ...fixtures.canonicalV1Input.investableAssets,
      marketValue: 1200000,
      total: 1218000,
    },
  });

  assert.equal(base.monthlyStablePassiveIncome, fixtures.canonicalExpectedCoreResult.monthlyStablePassiveIncome);
  assert.equal(base.passiveIncomeCoverageRate, fixtures.canonicalExpectedCoreResult.passiveIncomeCoverageRate);
  assert.equal(revalued.monthlyStablePassiveIncome, base.monthlyStablePassiveIncome);
  assert.equal(revalued.passiveIncomeCoverageRate, base.passiveIncomeCoverageRate);
});

test("calculates rental income from net costs without allowing negative costs to inflate it", () => {
  const adapter = loadCanonicalAdapter();
  const calculate = requireContractFunction(adapter, "calculateCanonicalRetirement");
  const rental = fixtures.canonicalIncomeSources.find(
    (source) => source.sourceType === "rental_property",
  );

  const normal = calculate({
    ...fixtures.canonicalV1Input,
    incomeSources: [rental],
  });
  const negativeCost = calculate({
    ...fixtures.canonicalV1Input,
    incomeSources: [{ ...rental, taxOrFee: -100 }],
  });

  assert.equal(normal.monthlyStablePassiveIncome, 5000);
  assert.ok(
    negativeCost.monthlyStablePassiveIncome <= normal.monthlyStablePassiveIncome,
    "invalid negative costs must not increase net rent",
  );
});

test("deduplicates the same ETF distribution origin across adapter inputs", () => {
  const adapter = loadCanonicalAdapter();
  const calculate = requireContractFunction(adapter, "calculateCanonicalRetirement");
  const distribution = fixtures.canonicalIncomeSources.find(
    (source) => source.sourceType === "dividend_etf_distribution" && source.id === "canonical-etf-distribution",
  );
  const duplicate = fixtures.canonicalIncomeSources.find(
    (source) => source.id === "canonical-duplicate-etf",
  );

  const result = calculate({
    ...fixtures.canonicalV1Input,
    incomeSources: [distribution, duplicate],
  });

  assert.equal(result.monthlyStablePassiveIncome, 50);
  assert.deepEqual(
    result.excludedIncomeSources.map((item) => item.reason),
    ["duplicate_origin"],
  );
});

test("marks the aggregate index insufficient when secondary metrics are missing", () => {
  const adapter = loadCanonicalAdapter();
  const getCompletenessStatus = requireContractFunction(adapter, "getCompletenessStatus");
  const calculate = requireContractFunction(adapter, "calculateCanonicalRetirement");

  const completeness = getCompletenessStatus(fixtures.canonicalIncompleteInput);
  const result = calculate(fixtures.canonicalIncompleteInput);

  assert.equal(completeness.status, "INSUFFICIENT");
  assert.ok(completeness.missing.includes("cashSafetyRunway"));
  assert.ok(completeness.missing.includes("protectionAccount"));
  assert.equal(result.completeness.status, "INSUFFICIENT");
  assert.equal(result.retirementIndex, null);
});

test("preserves the canonical source facts required by all supported income categories", () => {
  const adapter = loadCanonicalAdapter();
  const normalizeSource = requireContractFunction(adapter, "normalizeCanonicalIncomeSource");
  const requiredTypes = [
    "rental_property",
    "stock_dividend",
    "dividend_etf_distribution",
    "bond_coupon",
    "deposit_interest",
    "money_market_fund_income",
    "pension_received",
    "annuity_received",
    "royalty_license",
    "passive_business_cashflow",
    "semi_passive_income",
    "salary",
    "part_time_income",
    "principal_sale",
    "future_pension",
    "expected_dividend",
  ];

  requiredTypes.forEach((sourceType) => {
    const source = fixtures.canonicalIncomeSources.find((item) => item.sourceType === sourceType);
    assert.ok(source, `fixture must include ${sourceType}`);
    const normalized = normalizeSource(source);
    assert.equal(normalized.sourceType, sourceType);
    assert.equal(normalized.originKey, source.originKey);
    assert.equal(normalized.actualReceived, source.actualReceived);
    assert.equal(normalized.requiresLabor, source.requiresLabor);
    assert.equal(normalized.isPrincipalSale, source.isPrincipalSale);
  });
});

test("separates net cashflow from the eligible core-rate contribution", () => {
  const adapter = loadCanonicalAdapter();
  const normalizeSource = requireContractFunction(adapter, "normalizeCanonicalIncomeSource");
  const sourceTypes = [
    "semi_passive_income",
    "future_pension",
    "expected_dividend",
    "principal_sale",
    "dividend_etf_distribution",
    "rental_property",
  ];

  sourceTypes.forEach((sourceType) => {
    const source = fixtures.canonicalIncomeSources.find((item) => {
      if (sourceType === "dividend_etf_distribution") {
        return item.id === "canonical-duplicate-etf";
      }
      return item.sourceType === sourceType;
    });
    const normalized = normalizeSource(source);
    if (normalized.exclusionReason !== null) {
      assert.equal(normalized.includedInCoreRate, false);
      assert.equal(normalized.eligibleMonthlyPassiveIncome, 0);
    } else {
      assert.equal(normalized.includedInCoreRate, true);
      assert.equal(
        normalized.eligibleMonthlyPassiveIncome,
        normalized.netMonthlyCashflow,
      );
    }
  });
});
