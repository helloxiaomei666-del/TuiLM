const calc = require("./calculation-core");
const format = require("./format");
const passiveIncome = require("./passive-income-model");
const retirementIndexAdapter = require("./retirement-index-adapter");
const valuation = require("./valuation-model");

function numberOr(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getHoldingBuckets(holdings) {
  const totals = calc.getHoldingTotals(holdings);
  return {
    cash: totals.cash,
    investments: totals.investments,
    currentAssets: totals.total,
    todayPnl: totals.todayPnl,
  };
}

function buildCalculationValues(state) {
  const profile = state.userProfile || {};
  const buckets = getHoldingBuckets(state.holdings || []);
  return {
    ...profile,
    age: numberOr(profile.age, 28),
    target: numberOr(profile.target, 3000000),
    salary: numberOr(profile.salary, 0),
    sideIncome: numberOr(profile.sideIncome, 0),
    livingCost: numberOr(profile.livingCost, 0),
    mortgage: numberOr(profile.mortgage, 0),
    carLoan: numberOr(profile.carLoan, 0),
    otherDebt: numberOr(profile.otherDebt, 0),
    cash: buckets.cash,
    investments: buckets.investments,
    manualDragOutflow: calc.getManualDragTotal(state.manualDrags || []),
  };
}

function buildCanonicalRetirementInput(state, buckets, values) {
  const profile = state.userProfile || {};
  return {
    ...state,
    monthlyEssentialExpense:
      state.monthlyEssentialExpense !== undefined
        ? state.monthlyEssentialExpense
        : profile.targetMonthlyLivingCost !== undefined
          ? profile.targetMonthlyLivingCost
          : profile.livingCost,
    liquidCash: state.liquidCash !== undefined ? state.liquidCash : buckets.cash,
    investableAssets: state.investableAssets !== undefined
      ? state.investableAssets
      : {
        cash: buckets.cash,
        marketValue: buckets.investments,
        total: buckets.currentAssets,
      },
    targetRetirementAssets: state.targetRetirementAssets !== undefined
      ? state.targetRetirementAssets
      : values.target,
    protectionAccounts: Array.isArray(state.protectionAccounts)
      ? state.protectionAccounts
      : Array.isArray(state.securityAccounts)
        ? state.securityAccounts
        : [],
    dragItems: Array.isArray(state.dragItems)
      ? state.dragItems
      : Array.isArray(state.manualDrags)
        ? state.manualDrags
        : [],
  };
}

function getOverviewModel(state) {
  const values = buildCalculationValues(state);
  const result = calc.simulate(values);
  const buckets = getHoldingBuckets(state.holdings || []);
  const canonicalRetirement = retirementIndexAdapter.calculateCanonicalRetirement(
    buildCanonicalRetirementInput(state, buckets, values),
  );
  const progress = calc.progressFromAssets(result.currentAssets, values.target);
  const remaining = Math.max(0, values.target - result.currentAssets);
  const securitySupport = calc.getSecuritySupport(values, result, state.securityAccounts || {});
  const cashflowHealthy = result.monthlyInvestable > 0;
  const valuationSummary = valuation.getValuationSummary(state.valuationSnapshots || []);
  const manualDrags = state.manualDrags || [];
  const dragTotal = calc.getManualDragTotal(manualDrags);
  const monthlyIncome = values.salary + values.sideIncome;
  const baseExpense = values.livingCost + values.mortgage + values.carLoan + values.otherDebt;
  const requiredOutflow = baseExpense + dragTotal;
  const cashflow = passiveIncome.getRetirementStatus(
    {
      targetMonthlyLivingCost: numberOr(state.userProfile && state.userProfile.targetMonthlyLivingCost, 0),
      monthlyLivingCost: values.livingCost,
    },
    state.holdings || [],
    state.incomeStreams || [],
    {
      liquidAssets: buckets.cash,
      currentRequiredMonthlyOutflow: requiredOutflow,
      assetRetirementRate: progress / 100,
    },
  );
  const cashflowRateText = cashflow.ok
    ? format.percent(cashflow.metrics.cashflowRetirementRate * 100)
    : "暂不可计算";
  const laborDependenceRateText = cashflow.ok
    ? format.percent(cashflow.metrics.laborDependenceRate * 100)
    : "暂不可计算";
  const cashflowHeadlineText = cashflow.ok
    ? cashflow.metrics.monthlyPassiveIncome > 0
      ? `你的完全被动收入每月约能承担 ${cashflowRateText} 的目标生活成本。`
      : "当前尚未录入可计入的完全被动收入。"
    : "补充目标生活成本后即可计算现金流退休率。";
  const denominatorLabel = cashflow.denominator.source === "targetMonthlyLivingCost"
    ? "目标生活成本"
    : "当前生活成本";
  const retirementIndexAvailable = canonicalRetirement.completeness.status === "COMPLETE"
    && canonicalRetirement.retirementIndex !== null;
  const retirementIndexText = retirementIndexAvailable
    ? format.percent(canonicalRetirement.retirementIndex)
    : "暂不可计算";
  const passiveIncomeCoverageText = Number.isFinite(canonicalRetirement.passiveIncomeCoverageRate)
    ? format.percent(canonicalRetirement.passiveIncomeCoverageRate * 100)
    : "暂不可计算";
  const cashSafetyRunwayText = Number.isFinite(canonicalRetirement.cashSafetyRunwayMonths)
    ? `${canonicalRetirement.cashSafetyRunwayMonths.toFixed(1)} 月`
    : "暂不可计算";
  const totalAssetProgressText = Number.isFinite(canonicalRetirement.totalAssetProgress)
    ? format.percent(canonicalRetirement.totalAssetProgress * 100)
    : "暂不可计算";

  return {
    values,
    result,
    buckets,
    retirementIndex: canonicalRetirement.retirementIndex,
    retirementIndexText,
    retirementIndexCompleteness: canonicalRetirement.completeness.status,
    retirementIndexAvailable,
    monthlyStablePassiveIncome: canonicalRetirement.monthlyStablePassiveIncome,
    passiveIncomeCoverageRate: canonicalRetirement.passiveIncomeCoverageRate,
    passiveIncomeCoverageText,
    cashSafetyRunwayMonths: canonicalRetirement.cashSafetyRunwayMonths,
    cashSafetyRunwayText,
    totalAssetProgress: canonicalRetirement.totalAssetProgress,
    totalAssetProgressText,
    progress,
    progressWidth: `${Math.min(100, Math.max(0, progress)).toFixed(1)}%`,
    progressText: `${progress.toFixed(1)}%`,
    statusText: remaining > 0 ? `距离目标还差 ${format.yuan(remaining)}` : "当前可投资资产已达到目标",
    freedomDate: format.futureDate(result.months, result.reached),
    freedomAge: format.ageText(values.age, result.months, result.reached),
    currentAssetsText: format.yuan(result.currentAssets),
    monthlyInvestableText: format.yuan(result.monthlyInvestable),
    todayPnlText: `${buckets.todayPnl >= 0 ? "+" : ""}${format.yuan(buckets.todayPnl)}`,
    valuationChangeText: valuationSummary.changeText,
    valuationRateText: valuationSummary.rateText,
    valuationStatusText: valuationSummary.statusText,
    valuationTimeText: valuationSummary.timeText,
    valuationSourceText: valuationSummary.sourceText,
    annualReturnText: format.percent(result.annualReturn),
    salaryGrowthText: format.percent(result.salaryGrowth),
    dragTotalText: format.yuan(dragTotal),
    dragCountText: `${manualDrags.length} 项 · 已参与退休时间模拟`,
    securityTotalText: format.yuan(securitySupport.total),
    securitySupportText: `未来支持 ${(securitySupport.supportFactor * 100).toFixed(1)}%，不计入可投资资产`,
    cashflowTitle: cashflowHealthy ? "现金流可投入" : "现金流需复盘",
    cashflowText: cashflowHealthy
      ? `每月可投入 ${format.yuan(result.monthlyInvestable)}`
      : "当前每月可投入为负，先检查支出或目标输入",
    monthlyIncomeText: format.yuan(monthlyIncome),
    baseExpenseText: format.yuan(baseExpense),
    cashflowRetirementRateText: cashflowRateText,
    cashflowRetirementProgressWidth: cashflow.ok
      ? `${(cashflow.metrics.cashflowRetirementRateDisplay * 100).toFixed(1)}%`
      : "0.0%",
    assetRetirementRateText: `${progress.toFixed(1)}%`,
    runwayMonthsText: cashflow.metrics.runwayMonths === null
      ? "暂不可计算"
      : `${cashflow.metrics.runwayMonths.toFixed(1)} 月`,
    laborDependenceRateText,
    monthlyPassiveIncomeText: format.yuan(cashflow.metrics.monthlyPassiveIncome),
    monthlySemiPassiveIncomeText: format.yuan(cashflow.metrics.monthlySemiPassiveIncome),
    passiveIncomeGapText: cashflow.metrics.passiveIncomeGap === null
      ? "暂不可计算"
      : format.yuan(cashflow.metrics.passiveIncomeGap),
    passiveIncomeSurplusText: cashflow.metrics.passiveIncomeSurplus === null
      ? "0 元"
      : format.yuan(cashflow.metrics.passiveIncomeSurplus),
    combinedCoverageRateText: cashflow.metrics.combinedCoverageRate === null
      ? "暂不可计算"
      : format.percent(cashflow.metrics.combinedCoverageRate * 100),
    cashflowHeadlineText,
    cashflowDenominatorText: cashflow.denominator.amount
      ? `按${denominatorLabel} ${format.yuan(cashflow.denominator.amount)}/月计算`
      : "尚未设置有效生活成本",
    cashflowStatusLabel: cashflow.status.label,
    cashflowStatusCode: cashflow.status.code,
    cashflowDisclosureText: "仅基于当前已录入现金流，不代表辞职或退休建议。",
  };
}

module.exports = {
  buildCalculationValues,
  getOverviewModel,
};
