"use strict";

// Platform-neutral boundary for legacy miniapp, Web, and H5 inputs.
// The domain formulas remain in retirement-index-model.js; this module only
// normalizes facts, applies canonical eligibility/deduplication, and adapts
// the result into the cross-platform contract.
const retirementModel = require("./retirement-index-model.js");

const CONTRACT_VERSION = "retirement-index-canonical-v1";
const EXPENSE_ALIASES = [
  "monthlyEssentialExpense",
  "targetMonthlyLivingCost",
  "targetMonthlyCost",
  "livingCost",
];

const SOURCE_EXCLUSION_REASONS = {
  salary: "active_salary",
  active_salary: "active_salary",
  part_time_income: "active_part_time_income",
  active_part_time_income: "active_part_time_income",
  one_off_income: "one_off_income",
  one_off_bonus: "one_off_income",
  stock_unrealized_gain: "unrealized_stock_gain",
  fund_unrealized_gain: "unrealized_fund_gain",
  property_appreciation: "property_appreciation",
  short_term_trading_gain: "trading_gain",
  trading_gain: "trading_gain",
  principal_sale: "principal_sale",
  future_pension: "future_benefit",
  expected_dividend: "expected_not_received",
  temporary_subsidy: "temporary_income",
  temporary_income: "temporary_income",
  semi_passive_income: "requires_continuous_labor",
};

const ALLOWED_SOURCE_TYPES = new Set([
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

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nonNegativeNumber(value, fallback = 0) {
  const number = finiteNumber(value);
  return number === null ? fallback : Math.max(0, number);
}

function firstDefined() {
  for (let index = 0; index < arguments.length; index += 1) {
    if (arguments[index] !== undefined && arguments[index] !== null) {
      return arguments[index];
    }
  }
  return null;
}

function normalizeFrequency(value) {
  const frequency = String(value || "monthly").toLowerCase();
  if (frequency === "month") return "monthly";
  if (frequency === "quarter" || frequency === "quarterly") return "quarterly";
  if (frequency === "year" || frequency === "yearly" || frequency === "annual") {
    return "annual";
  }
  return frequency === "irregular" ? "irregular" : "monthly";
}

function monthlyFromRaw(rawAmount, frequency) {
  const amount = nonNegativeNumber(rawAmount);
  if (frequency === "quarterly") return amount / 3;
  if (frequency === "annual") return amount / 12;
  return amount;
}

function normalizeMonthlyEssentialExpense(input = {}) {
  for (const alias of EXPENSE_ALIASES) {
    const value = finiteNumber(input[alias]);
    if (value !== null && value > 0) {
      return { ok: true, value };
    }
  }
  return {
    ok: false,
    value: null,
    reason: "missing_monthly_essential_expense",
  };
}

function inferSourceType(source = {}) {
  if (source.sourceType) {
    if (source.sourceType === "rent") return "rental_property";
    if (source.sourceType === "etf" || source.sourceType === "reits") {
      return "dividend_etf_distribution";
    }
    return source.sourceType;
  }
  if (source.cashflowType === "rent" || source.type === "rent") {
    return "rental_property";
  }
  const type = String(source.type || "").toLowerCase();
  if (type === "dividend" || type === "stock_dividend") return "stock_dividend";
  if (type === "etf" || type === "reits" || type === "red_dividend") {
    return "dividend_etf_distribution";
  }
  if (type === "interest" || type === "bond") return "bond_coupon";
  if (type === "pension") return "pension_received";
  if (type === "annuity") return "annuity_received";
  if (type === "royalties" || type === "royalty") return "royalty_license";
  if (type === "semi_passive") return "semi_passive_income";
  return type || "other";
}

function inferRawAmount(source = {}) {
  if (finiteNumber(source.rawAmount) !== null) return source.rawAmount;
  if (finiteNumber(source.amount) !== null) return source.amount;
  if (finiteNumber(source.grossRent) !== null) return source.grossRent;
  if (finiteNumber(source.cashflowAmount) !== null) return source.cashflowAmount;
  return 0;
}

function normalizeCanonicalIncomeSource(source = {}) {
  const sourceType = inferSourceType(source);
  const frequency = normalizeFrequency(source.frequency || source.cashflowFrequency);
  const rawAmount = nonNegativeNumber(inferRawAmount(source));
  const monthlyAmount =
    finiteNumber(source.monthlyAmount) !== null
      ? nonNegativeNumber(source.monthlyAmount)
      : monthlyFromRaw(rawAmount, frequency);
  const actualReceived = source.actualReceived !== false;
  const status = source.status || source.cashflowStatus || "current";
  const requiresLabor = Boolean(source.requiresLabor);
  const isOneOff = Boolean(source.isOneOff || source.oneOff);
  const isPrincipalSale = Boolean(source.isPrincipalSale || source.principalSale);
  const originKey = source.originKey || source.id || source.sourceId || sourceType;
  const taxOrFee = nonNegativeNumber(source.taxOrFee);
  const maintenanceCost = nonNegativeNumber(source.maintenanceCost);
  const otherNecessaryCost = nonNegativeNumber(source.otherNecessaryCost);

  let exclusionReason = source.exclusionReason || null;
  if (!exclusionReason && SOURCE_EXCLUSION_REASONS[sourceType]) {
    exclusionReason = SOURCE_EXCLUSION_REASONS[sourceType];
  }
  if (!exclusionReason && status !== "current") exclusionReason = "future_benefit";
  if (!exclusionReason && requiresLabor) exclusionReason = "requires_continuous_labor";
  if (!exclusionReason && isPrincipalSale) exclusionReason = "principal_sale";
  if (!exclusionReason && isOneOff) exclusionReason = "one_off_income";
  if (!exclusionReason && !actualReceived) {
    exclusionReason =
      sourceType === "expected_dividend"
        ? "expected_not_received"
        : "actual_cashflow_not_received";
  }

  const declaredNetMonthlyCashflow = finiteNumber(source.netMonthlyCashflow);
  let netMonthlyCashflow =
    declaredNetMonthlyCashflow !== null
      ? nonNegativeNumber(declaredNetMonthlyCashflow)
      : monthlyAmount;

  if (sourceType === "rental_property") {
    // Canonical rental costs are monthly values. Clamp invalid negative costs
    // so bad input cannot increase net rent.
    const grossMonthlyRent =
      finiteNumber(source.grossRent) !== null
        ? monthlyFromRaw(source.grossRent, frequency)
        : monthlyAmount;
    const calculatedNet = Math.max(
      0,
      grossMonthlyRent - taxOrFee - maintenanceCost - otherNecessaryCost,
    );
    // When a source already declares a trusted net amount, malformed negative
    // costs cannot make the normalized result larger than that amount.
    netMonthlyCashflow =
      declaredNetMonthlyCashflow === null
        ? calculatedNet
        : Math.min(nonNegativeNumber(declaredNetMonthlyCashflow), calculatedNet);
  }

  if (!ALLOWED_SOURCE_TYPES.has(sourceType) && !exclusionReason) {
    netMonthlyCashflow = 0;
  }

  const includedInCoreRate = exclusionReason === null;
  const eligibleMonthlyPassiveIncome = includedInCoreRate ? netMonthlyCashflow : 0;
  const normalized = {
    id: source.id || originKey,
    originKey,
    sourceType,
    rawAmount,
    frequency,
    monthlyAmount,
    status,
    actualReceived,
    requiresLabor,
    stabilityLevel:
      source.stabilityLevel || source.stability || (sourceType === "rental_property" ? "high" : "medium"),
    isOneOff,
    isPrincipalSale,
    taxOrFee,
    maintenanceCost,
    otherNecessaryCost,
    netMonthlyCashflow,
    eligibleMonthlyPassiveIncome,
    includedInCoreRate,
    exclusionReason,
  };

  if (source.duplicateOfOriginKey) {
    normalized.duplicateOfOriginKey = source.duplicateOfOriginKey;
  }
  return normalized;
}

function normalizeAssetFacts(platform, input = {}) {
  if (input.investableAssets !== undefined) return input.investableAssets;
  const cash = finiteNumber(input.liquidCash) !== null ? input.liquidCash : input.cash;
  let marketValue = input.marketValue;
  if (marketValue === undefined) marketValue = input.investments;
  if (marketValue === undefined) marketValue = input.funds;
  if (marketValue === undefined && platform === "h5") {
    marketValue = input.stocks;
  }
  if (cash === undefined && marketValue === undefined) return null;
  const safeCash = nonNegativeNumber(cash);
  const safeMarketValue = nonNegativeNumber(marketValue);
  return {
    cash: safeCash,
    marketValue: safeMarketValue,
    total: safeCash + safeMarketValue,
  };
}

function mapMiniappSources(input = {}) {
  const holdings = Array.isArray(input.holdings) ? input.holdings : [];
  const streams = Array.isArray(input.incomeStreams) ? input.incomeStreams : [];
  return [
    ...holdings.map((holding) => ({
      ...holding,
      sourceType: holding.sourceType || holding.cashflowType,
      rawAmount: firstDefined(holding.rawAmount, holding.grossRent, holding.cashflowAmount),
      frequency: holding.frequency || holding.cashflowFrequency,
      status: holding.status || holding.cashflowStatus,
      actualReceived: holding.actualReceived !== false,
      netMonthlyCashflow: holding.netMonthlyCashflow,
    })),
    ...streams,
  ];
}

function mapH5Sources(input = {}) {
  const typeMap = {
    rent: "rental_property",
    dividends: "stock_dividend",
    reits: "dividend_etf_distribution",
    interest: "bond_coupon",
    pension: "pension_received",
    annuity: "annuity_received",
    royalties: "royalty_license",
    other: "passive_business_cashflow",
  };
  const sources = Object.entries(input.passiveIncome || {}).map(([key, value]) => ({
    ...value,
    id: value.id || `h5-${key}`,
    originKey: value.originKey || `h5:${key}`,
    sourceType: value.sourceType || typeMap[key] || "other",
    rawAmount: firstDefined(value.rawAmount, value.amount),
    monthlyAmount: value.monthlyAmount,
    actualReceived: value.actualReceived !== false,
    status: value.status || "current",
  }));
  if (input.futurePension) {
    sources.push({ ...input.futurePension, sourceType: "future_pension", status: "future" });
  }
  if (input.principalSale) {
    sources.push({ ...input.principalSale, sourceType: "principal_sale", isPrincipalSale: true });
  }
  if (input.semiPassive) {
    sources.push({ ...input.semiPassive, sourceType: "semi_passive_income", requiresLabor: true });
  }
  return sources;
}

function normalizeCanonicalInput(platform, input = {}) {
  const source = platform === "canonical" ? input : input || {};
  const profile = source.userProfile || source;
  const expense = normalizeMonthlyEssentialExpense({
    monthlyEssentialExpense: source.monthlyEssentialExpense,
    livingCost: firstDefined(profile.livingCost, source.livingCost),
    targetMonthlyLivingCost: firstDefined(profile.targetMonthlyLivingCost, source.targetMonthlyLivingCost),
    targetMonthlyCost: firstDefined(profile.targetMonthlyCost, source.targetMonthlyCost),
    currentMonthlyCost: source.currentMonthlyCost,
  });

  let rawSources = source.incomeSources;
  if (!Array.isArray(rawSources)) {
    rawSources = platform === "h5" ? mapH5Sources(source) : mapMiniappSources(source);
  }
  const normalizedSources = rawSources.map(normalizeCanonicalIncomeSource);
  const sourceByOrigin = new Set();
  normalizedSources.forEach((item, index) => {
    const raw = rawSources[index] || {};
    if (sourceByOrigin.has(item.originKey)) {
      item.duplicateOfOriginKey = item.originKey;
      item.exclusionReason = "duplicate_origin";
      item.includedInCoreRate = false;
      item.eligibleMonthlyPassiveIncome = 0;
      return;
    }
    sourceByOrigin.add(item.originKey);
    if (raw.includeInPassiveIncome === false && !item.exclusionReason) {
      item.exclusionReason = SOURCE_EXCLUSION_REASONS[item.sourceType] || "not_included";
      item.includedInCoreRate = false;
      item.eligibleMonthlyPassiveIncome = 0;
    }
  });

  const normalized = {
    contractVersion: source.contractVersion || CONTRACT_VERSION,
    monthlyEssentialExpense: expense.ok ? expense.value : null,
    liquidCash:
      source.liquidCash !== undefined
        ? source.liquidCash
        : source.cash !== undefined
          ? source.cash
          : null,
    investableAssets: normalizeAssetFacts(platform, source),
    targetRetirementAssets:
      source.targetRetirementAssets !== undefined
        ? source.targetRetirementAssets
        : firstDefined(source.targetAssets, source.target),
    incomeSources: normalizedSources,
    protectionAccounts: Array.isArray(source.protectionAccounts)
      ? source.protectionAccounts
      : Array.isArray(source.securityAccounts)
        ? source.securityAccounts
        : [],
    dragItems: Array.isArray(source.dragItems)
      ? source.dragItems
      : Array.isArray(source.manualDrags)
        ? source.manualDrags
        : [],
  };

  if (source.inputCompletion && typeof source.inputCompletion === "object") {
    normalized.inputCompletion = source.inputCompletion;
  }

  // H5 stores cash and funds separately; normalizeAssetFacts handles those
  // aliases. Web/miniapp can provide an already canonical asset object.
  return normalized;
}

function getCompletenessStatus(input = {}) {
  const normalized = normalizeCanonicalInput("canonical", input);
  const missing = [];
  const completion = normalized.inputCompletion || null;
  const hasCompletion = completion !== null;
  const sectionConfirmed = (key) => hasCompletion && completion[key] === true;
  if (!finiteNumber(normalized.monthlyEssentialExpense) || normalized.monthlyEssentialExpense <= 0) {
    missing.push("monthlyEssentialExpense");
  } else if (hasCompletion && !sectionConfirmed("profile")) {
    missing.push("profile");
  }
  if (!finiteNumber(normalized.liquidCash) || normalized.liquidCash < 0) {
    missing.push("cashSafetyRunway");
  } else if (hasCompletion && !sectionConfirmed("assets")) {
    missing.push("assets");
  }
  const assets = normalized.investableAssets;
  if (!assets || !finiteNumber(assets.total)) missing.push("totalAssetProgress");
  if (!finiteNumber(normalized.targetRetirementAssets) || normalized.targetRetirementAssets <= 0) {
    missing.push("targetRetirementAssets");
  }
  if (
    (hasCompletion && !sectionConfirmed("incomeSources")) ||
    (!hasCompletion && (!Array.isArray(normalized.incomeSources) || normalized.incomeSources.length === 0))
  ) {
    missing.push("incomeSource");
  }
  if (
    (hasCompletion && !sectionConfirmed("protectionAccounts")) ||
    (!hasCompletion && (!Array.isArray(normalized.protectionAccounts) || normalized.protectionAccounts.length === 0))
  ) {
    missing.push("protectionAccount");
  }
  if (
    (hasCompletion && !sectionConfirmed("dragItems")) ||
    (!hasCompletion && (!Array.isArray(normalized.dragItems) || normalized.dragItems.length === 0))
  ) {
    missing.push("dragItems");
  }
  const status = missing.length === 0 ? "COMPLETE" : missing.length >= 2 ? "INSUFFICIENT" : "PARTIAL";
  return { status, missing };
}

function calculateCanonicalRetirement(input = {}) {
  const normalized = normalizeCanonicalInput("canonical", input);
  const excludedIncomeSources = [];
  const eligibleSources = [];
  const seenOrigins = new Set();

  normalized.incomeSources.forEach((source) => {
    if (seenOrigins.has(source.originKey) || source.duplicateOfOriginKey) {
      excludedIncomeSources.push({ source, reason: "duplicate_origin" });
      return;
    }
    seenOrigins.add(source.originKey);
    if (source.exclusionReason) {
      excludedIncomeSources.push({ source, reason: source.exclusionReason });
      return;
    }
    eligibleSources.push(source);
  });

  const modelIncomeSources = eligibleSources.map((source) => ({
    ...source,
    // The committed domain model still consumes this legacy internal key.
    // It is populated only from the canonical eligible contribution.
    netMonthlyPassiveIncome: source.eligibleMonthlyPassiveIncome,
  }));
  const stableIncome = retirementModel.calculateStablePassiveIncome({
    incomeSources: modelIncomeSources,
  });
  const monthlyStablePassiveIncome = stableIncome.value;
  const coverage = retirementModel.computePassiveIncomeCoverage({
    monthlyStablePassiveIncome,
    monthlyEssentialExpense: normalized.monthlyEssentialExpense,
  });
  const expense = normalized.monthlyEssentialExpense;
  const cashSafetyRunwayMonths =
    finiteNumber(normalized.liquidCash) !== null && finiteNumber(expense) !== null && expense > 0
      ? normalized.liquidCash / expense
      : null;
  const target = finiteNumber(normalized.targetRetirementAssets);
  const total = normalized.investableAssets && finiteNumber(normalized.investableAssets.total);
  const totalAssetProgress = target && target > 0 && total !== null ? total / target : null;
  const completeness = getCompletenessStatus(normalized);

  let retirementIndex = null;
  if (completeness.status === "COMPLETE") {
    const dragPenalty = retirementModel.computeDragPenalty(normalized.dragItems);
    const result = retirementModel.composeRetirementIndex({
      passiveIncomeCoverageRate: coverage.value,
      cashSafetyRunwayMonths,
      assetIncomeQuality: normalized.incomeSources.length > 0 ? 1 : null,
      totalAssetProgress,
      protectionAccountCompletion: normalized.protectionAccounts.length > 0 ? 1 : null,
    }, dragPenalty.value);
    retirementIndex = result.value;
  }

  const stablePassiveIncomeDetails = {
    ...stableIncome,
    included: stableIncome.included.map((source) => {
      const details = { ...source };
      delete details.netMonthlyPassiveIncome;
      details.netMonthlyCashflow = source.netMonthlyCashflow;
      details.eligibleMonthlyPassiveIncome = source.eligibleMonthlyPassiveIncome;
      details.includedInCoreRate = true;
      return details;
    }),
  };

  return {
    contractVersion: normalized.contractVersion,
    monthlyStablePassiveIncome,
    monthlyEssentialExpense: normalized.monthlyEssentialExpense,
    passiveIncomeCoverageRate: coverage.ok ? coverage.value : 0,
    cashSafetyRunwayMonths,
    totalAssetProgress,
    excludedIncomeSources,
    completeness,
    retirementIndex,
    stablePassiveIncomeDetails,
  };
}

module.exports = {
  CONTRACT_VERSION,
  normalizeCanonicalInput,
  normalizeMonthlyEssentialExpense,
  normalizeCanonicalIncomeSource,
  calculateCanonicalRetirement,
  getCompletenessStatus,
};
