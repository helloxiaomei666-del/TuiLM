function result(value, extras) {
  return {
    ok: true,
    value,
    reason: null,
    warnings: [],
    ...(extras || {}),
  };
}

function invalid(reason, extras) {
  return {
    ok: false,
    value: null,
    reason,
    warnings: [],
    ...(extras || {}),
  };
}

function isNonNegativeNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0;
}

function annualizeToMonthly(amount, frequency, options) {
  if (!isNonNegativeNumber(amount)) return invalid("invalid_amount");
  const numericAmount = Number(amount);
  if (frequency === "monthly") return result(numericAmount);
  if (frequency === "quarterly") return result(numericAmount / 3);
  if (frequency === "annual") return result(numericAmount / 12);
  if (frequency === "irregular") {
    const history = options && Array.isArray(options.monthlyHistory) ? options.monthlyHistory : [];
    if (!history.length || history.some((item) => !isNonNegativeNumber(item))) {
      return invalid("missing_irregular_history");
    }
    const total = history.reduce((sum, item) => sum + Number(item), 0);
    const warnings = history.length < 12 ? ["irregular_history_less_than_12_months"] : [];
    return result(total / history.length, { warnings });
  }
  return invalid("unsupported_frequency");
}

function holdingToStream(holding) {
  if (!holding || !holding.producesCashflow) return null;
  return {
    id: holding.id,
    originKey: `holding:${holding.id || "unknown"}:${holding.cashflowType || "cashflow"}`,
    type: holding.requiresLabor ? "semi_passive" : "passive",
    amount: holding.cashflowAmount,
    frequency: holding.cashflowFrequency || "monthly",
    status: holding.cashflowStatus || "current",
    requiresLabor: holding.requiresLabor === true,
    includeInPassiveIncome: holding.includeInPassiveIncome === true,
    includeInSemiPassiveIncome: holding.includeInSemiPassiveIncome === true,
  };
}

function normalizeIncomeStream(stream) {
  if (!stream || typeof stream !== "object") return invalid("invalid_stream");
  const monthly = annualizeToMonthly(stream.amount, stream.frequency || "monthly", {
    monthlyHistory: stream.monthlyHistory,
  });
  if (!monthly.ok) return monthly;
  return result(
    {
      ...stream,
      originKey: stream.originKey || `stream:${stream.id || "unknown"}`,
      monthlyAmount: monthly.value,
      status: stream.status || "current",
      requiresLabor: stream.requiresLabor === true,
    },
    { warnings: monthly.warnings },
  );
}

function aggregateStreams(streams, predicate) {
  const items = [];
  const excluded = [];
  const warnings = [];
  const seenOrigins = new Set();
  let total = 0;

  streams.forEach((stream) => {
    const normalized = normalizeIncomeStream(stream);
    if (!normalized.ok) {
      excluded.push({ stream, reason: normalized.reason });
      return;
    }
    const item = normalized.value;
    normalized.warnings.forEach((warning) => warnings.push(`${item.originKey}:${warning}`));
    if (!predicate(item)) {
      excluded.push({ stream: item, reason: "not_eligible" });
      return;
    }
    if (seenOrigins.has(item.originKey)) {
      excluded.push({ stream: item, reason: "duplicate_origin" });
      warnings.push(`duplicate_origin:${item.originKey}`);
      return;
    }
    seenOrigins.add(item.originKey);
    total += item.monthlyAmount;
    items.push(item);
  });

  return result(total, { items, excluded, warnings });
}

function getMonthlyPassiveIncome(holdings, incomeStreams) {
  const holdingStreams = (holdings || []).map(holdingToStream).filter(Boolean);
  return aggregateStreams(holdingStreams.concat(incomeStreams || []), (stream) => (
    stream.type === "passive" &&
    stream.status === "current" &&
    stream.requiresLabor === false &&
    stream.includeInPassiveIncome === true
  ));
}

function getMonthlySemiPassiveIncome(incomeStreams) {
  return aggregateStreams(incomeStreams || [], (stream) => (
    stream.type === "semi_passive" &&
    stream.status === "current" &&
    stream.includeInSemiPassiveIncome === true
  ));
}

function getCashflowRetirementRate(monthlyPassiveIncome, monthlyLivingCost) {
  if (!isNonNegativeNumber(monthlyPassiveIncome)) return invalid("invalid_passive_income");
  if (!Number.isFinite(Number(monthlyLivingCost)) || Number(monthlyLivingCost) <= 0) {
    return invalid("invalid_living_cost");
  }
  const rate = Number(monthlyPassiveIncome) / Number(monthlyLivingCost);
  return result(rate, { displayProgress: Math.min(rate, 1) });
}

function getLaborDependenceRate(cashflowRetirementRate) {
  if (!isNonNegativeNumber(cashflowRetirementRate)) return invalid("invalid_cashflow_retirement_rate");
  return result(Math.max(0, 1 - Number(cashflowRetirementRate)));
}

function getRunwayMonths(liquidAssets, monthlyLivingCost) {
  if (!isNonNegativeNumber(liquidAssets)) return invalid("invalid_liquid_assets");
  if (!Number.isFinite(Number(monthlyLivingCost)) || Number(monthlyLivingCost) <= 0) {
    return invalid("invalid_living_cost");
  }
  return result(Number(liquidAssets) / Number(monthlyLivingCost));
}

function getPassiveIncomeGap(monthlyPassiveIncome, monthlyLivingCost) {
  if (!isNonNegativeNumber(monthlyPassiveIncome)) return invalid("invalid_passive_income");
  if (!Number.isFinite(Number(monthlyLivingCost)) || Number(monthlyLivingCost) <= 0) {
    return invalid("invalid_living_cost");
  }
  const income = Number(monthlyPassiveIncome);
  const cost = Number(monthlyLivingCost);
  return result({
    gap: Math.max(0, cost - income),
    surplus: Math.max(0, income - cost),
  });
}

function getStatus(rate) {
  if (rate < 0.1) return { code: "survival_dependent", label: "生存依赖期", range: "<10%" };
  if (rate < 0.3) return { code: "cashflow_seed", label: "现金流萌芽期", range: "10%-30%" };
  if (rate < 0.6) return { code: "semi_free", label: "半自由期", range: "30%-60%" };
  if (rate < 0.9) return { code: "near_retirement", label: "准退休期", range: "60%-90%" };
  return { code: "cashflow_retirement", label: "现金流退休期", range: ">=90%" };
}

function getRetirementStatus(profile, holdings, incomeStreams, options) {
  const safeProfile = profile || {};
  const safeOptions = options || {};
  const targetCost = Number(safeProfile.targetMonthlyLivingCost);
  const currentCost = Number(safeProfile.monthlyLivingCost);
  const hasTargetCost = Number.isFinite(targetCost) && targetCost > 0;
  const hasCurrentCost = Number.isFinite(currentCost) && currentCost > 0;
  const denominator = hasTargetCost
    ? { amount: targetCost, source: "targetMonthlyLivingCost" }
    : hasCurrentCost
      ? { amount: currentCost, source: "monthlyLivingCost" }
      : { amount: null, source: null };
  const passive = getMonthlyPassiveIncome(holdings || [], incomeStreams || []);
  const semiPassive = getMonthlySemiPassiveIncome(incomeStreams || []);
  const rate = getCashflowRetirementRate(passive.value, denominator.amount);
  const labor = rate.ok ? getLaborDependenceRate(rate.value) : invalid("cashflow_rate_unavailable");
  const gap = getPassiveIncomeGap(passive.value, denominator.amount);
  const runway = getRunwayMonths(
    safeOptions.liquidAssets,
    safeOptions.currentRequiredMonthlyOutflow,
  );
  const combinedRate = rate.ok
    ? getCashflowRetirementRate(passive.value + semiPassive.value, denominator.amount)
    : invalid("cashflow_rate_unavailable");
  const status = rate.ok
    ? getStatus(rate.value)
    : { code: "unavailable", label: "暂不可计算", range: "" };

  return {
    ok: rate.ok,
    metrics: {
      cashflowRetirementRate: rate.ok ? rate.value : null,
      cashflowRetirementRateDisplay: rate.ok ? rate.displayProgress : null,
      assetRetirementRate: Number.isFinite(Number(safeOptions.assetRetirementRate))
        ? Number(safeOptions.assetRetirementRate)
        : null,
      runwayMonths: runway.ok ? runway.value : null,
      laborDependenceRate: labor.ok ? labor.value : null,
      passiveIncomeGap: gap.ok ? gap.value.gap : null,
      passiveIncomeSurplus: gap.ok ? gap.value.surplus : null,
      monthlyPassiveIncome: passive.value,
      monthlySemiPassiveIncome: semiPassive.value,
      combinedCoverageRate: combinedRate.ok ? combinedRate.value : null,
    },
    status,
    denominator,
    warnings: passive.warnings.concat(semiPassive.warnings),
    provenance: passive.items.concat(semiPassive.items),
  };
}

module.exports = {
  annualizeToMonthly,
  normalizeIncomeStream,
  getCashflowRetirementRate,
  getLaborDependenceRate,
  getMonthlyPassiveIncome,
  getMonthlySemiPassiveIncome,
  getPassiveIncomeGap,
  getRetirementStatus,
  getRunwayMonths,
};
