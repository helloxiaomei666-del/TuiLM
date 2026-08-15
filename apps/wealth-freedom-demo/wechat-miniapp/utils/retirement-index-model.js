const DEFAULT_RETIREMENT_INDEX_CONFIG = {
  weights: {
    passiveIncomeCoverage: 0.4,
    cashSafetyRunway: 0.15,
    incomeAssetQuality: 0.15,
    totalAssetProgress: 0.15,
    protectionAccount: 0.15,
  },
  dragPenaltyCap: 20,
};

const WEIGHT_KEYS = Object.keys(DEFAULT_RETIREMENT_INDEX_CONFIG.weights);
const ELIGIBLE_SOURCE_TYPES = new Set([
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
]);
const EXCLUSION_REASONS = {
  salary: "active_salary",
  part_time_income: "active_part_time_income",
  one_off_bonus: "one_off_income",
  stock_unrealized_gain: "unrealized_stock_gain",
  fund_unrealized_gain: "unrealized_fund_gain",
  property_appreciation: "property_appreciation",
  short_term_trading_gain: "trading_gain",
  principal_sale: "principal_sale",
  expected_dividend: "expected_not_received",
  future_pension: "future_benefit",
  temporary_subsidy: "temporary_income",
};
const DRAG_TYPES = new Set([
  "mortgage",
  "car_loan",
  "consumer_loan",
  "credit_card_debt",
  "high_fixed_expense",
  "dependents",
  "high_risk_exposure",
  "low_liquidity_assets",
]);

function numberOr(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function computePassiveIncomeCoverage(input = {}) {
  const income = nonNegative(input.monthlyStablePassiveIncome);
  const expense = Number(input.monthlyEssentialExpense);
  if (!Number.isFinite(expense) || expense <= 0) {
    return {
      ok: false,
      value: null,
      displayProgress: null,
      reason: "invalid_monthly_essential_expense",
    };
  }
  if (income === null) {
    return {
      ok: false,
      value: null,
      displayProgress: null,
      reason: "invalid_monthly_stable_passive_income",
    };
  }
  const value = income / expense;
  return {
    ok: true,
    value,
    displayProgress: Math.min(value, 1),
    reason: null,
  };
}

function monthlyValue(amount, frequency) {
  const value = nonNegative(amount);
  if (value === null) return null;
  if (!frequency || frequency === "monthly") return value;
  if (frequency === "quarterly") return value / 3;
  if (frequency === "annual") return value / 12;
  return null;
}

function rentalMonthlyValue(source) {
  return Math.max(
    0,
    numberOr(source.monthlyRent)
      - numberOr(source.vacancyAllowance)
      - numberOr(source.taxOrFee)
      - numberOr(source.maintenanceCost)
      - numberOr(source.mortgagePayment),
  );
}

function sourceMonthlyValue(source) {
  const declaredNet = nonNegative(source.netMonthlyPassiveIncome);
  if (declaredNet !== null) return { ok: true, value: declaredNet };
  if (source.sourceType === "rental_property") {
    return { ok: true, value: rentalMonthlyValue(source) };
  }
  if (source.sourceType === "stock_dividend" || source.sourceType === "dividend_etf_distribution") {
    const value = monthlyValue(source.actualDividendReceived, source.frequency);
    return value && value > 0
      ? { ok: true, value }
      : { ok: false, reason: "actual_cashflow_not_received" };
  }
  if (source.sourceType === "bond_coupon") {
    const value = monthlyValue(source.actualInterestReceived, source.frequency);
    return value && value > 0
      ? { ok: true, value }
      : { ok: false, reason: "actual_cashflow_not_received" };
  }
  return { ok: false, reason: "actual_cashflow_not_received" };
}

function eligibilityReason(source) {
  if (!source || typeof source !== "object") return "invalid_source";
  if (EXCLUSION_REASONS[source.sourceType]) return EXCLUSION_REASONS[source.sourceType];
  if (!ELIGIBLE_SOURCE_TYPES.has(source.sourceType)) return "unsupported_source_type";
  if (source.status !== "current") return "not_current";
  if (source.stabilityLevel !== "high" && source.stabilityLevel !== "medium") {
    return "insufficient_stability";
  }
  if (source.requiresLabor === true) return "requires_continuous_labor";
  if (source.isOneOff === true) return "one_off_income";
  if (source.isPrincipalSale === true) return "principal_sale";
  return null;
}

function calculateStablePassiveIncome(input = {}) {
  const sources = [].concat(input.holdings || [], input.incomeSources || []);
  const included = [];
  const excluded = [];
  const seenOrigins = new Set();
  let value = 0;

  sources.forEach((source) => {
    const reason = eligibilityReason(source);
    if (reason) {
      excluded.push({ source, reason });
      return;
    }
    const originKey = source.originKey || `source:${source.id || "unknown"}`;
    if (seenOrigins.has(originKey)) {
      excluded.push({ source, reason: "duplicate_origin" });
      return;
    }
    const monthly = sourceMonthlyValue(source);
    if (!monthly.ok) {
      excluded.push({ source, reason: monthly.reason });
      return;
    }
    seenOrigins.add(originKey);
    value += monthly.value;
    included.push({ ...source, originKey, monthlyAmount: monthly.value });
  });

  return { value, included, excluded };
}

function validateRetirementIndexConfig(config = DEFAULT_RETIREMENT_INDEX_CONFIG) {
  if (!config || typeof config !== "object" || !config.weights || typeof config.weights !== "object") {
    return { ok: false, reason: "invalid_weight_configuration" };
  }
  const weights = config.weights;
  if (WEIGHT_KEYS.some((key) => !Number.isFinite(Number(weights[key])) || Number(weights[key]) < 0)) {
    return { ok: false, reason: "invalid_weight_value" };
  }
  const weightSum = WEIGHT_KEYS.reduce((sum, key) => sum + Number(weights[key]), 0);
  if (Math.abs(weightSum - 1) > 1e-9) return { ok: false, reason: "invalid_weight_sum" };
  if (!Number.isFinite(Number(config.dragPenaltyCap)) || Number(config.dragPenaltyCap) < 0 || Number(config.dragPenaltyCap) > 20) {
    return { ok: false, reason: "invalid_drag_penalty_cap" };
  }
  return { ok: true, reason: null };
}

function computeDragPenalty(items = [], config = DEFAULT_RETIREMENT_INDEX_CONFIG) {
  const validation = validateRetirementIndexConfig(config);
  if (!validation.ok) return { ...validation, value: null, items: [] };
  const recognized = (items || []).filter((item) => item && DRAG_TYPES.has(item.type));
  const total = recognized.reduce((sum, item) => sum + Math.max(0, numberOr(item.score)), 0);
  return {
    ok: true,
    value: Math.min(total, Number(config.dragPenaltyCap)),
    items: recognized,
  };
}

function composeRetirementIndex(scores = {}, dragPenaltyScore = 0, config = DEFAULT_RETIREMENT_INDEX_CONFIG) {
  const validation = validateRetirementIndexConfig(config);
  if (!validation.ok) return { ...validation, value: null, contributions: {}, metrics: {} };
  const contributions = {};
  WEIGHT_KEYS.forEach((key) => {
    contributions[key] = clamp(numberOr(scores[key]), 0, 100) * Number(config.weights[key]);
  });
  const dragPenalty = Math.min(Math.max(0, numberOr(dragPenaltyScore)), Number(config.dragPenaltyCap));
  contributions.dragPenalty = -dragPenalty;
  const total = WEIGHT_KEYS.reduce((sum, key) => sum + contributions[key], 0) - dragPenalty;
  return {
    ok: true,
    value: clamp(total, 0, 100),
    contributions,
    metrics: {},
  };
}

module.exports = {
  DEFAULT_RETIREMENT_INDEX_CONFIG,
  computePassiveIncomeCoverage,
  calculateStablePassiveIncome,
  computeDragPenalty,
  composeRetirementIndex,
  validateRetirementIndexConfig,
};
