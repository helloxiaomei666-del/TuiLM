const LIABILITY_TYPES = [
  { value: "mortgage", label: "房贷" },
  { value: "car_loan", label: "车贷" },
  { value: "consumer_loan", label: "消费贷" },
  { value: "credit_card_debt", label: "信用卡债务" },
  { value: "other", label: "其他负债" },
];

const liabilityTypeValues = new Set(LIABILITY_TYPES.map((item) => item.value));

function invalid(message) {
  return { ok: false, message };
}

function isPositiveFinite(value) {
  return Number.isFinite(value) && value > 0;
}

function isNonNegativeFinite(value) {
  return Number.isFinite(value) && value >= 0;
}

function validateLiabilityFact(fact, existingIds = []) {
  if (!fact || typeof fact !== "object" || Array.isArray(fact)) {
    return invalid("负债信息格式无效");
  }
  if (typeof fact.id !== "string" || fact.id.trim().length === 0) {
    return invalid("负债编号不能为空");
  }
  if (existingIds.includes(fact.id)) {
    return invalid("负债编号重复");
  }
  if (!liabilityTypeValues.has(fact.type)) {
    return invalid("请选择有效的负债类型");
  }
  if (!isPositiveFinite(fact.outstandingBalance)) {
    return invalid("请输入大于 0 的有效负债余额");
  }
  if (!isNonNegativeFinite(fact.monthlyPayment)) {
    return invalid("请输入有效的每月还款金额");
  }
  if (typeof fact.includedInEssentialExpense !== "boolean") {
    return invalid("请选择这笔月供是否已包含在每月必要支出中");
  }
  if (fact.source !== "manual") {
    return invalid("负债来源无效");
  }
  if (typeof fact.note !== "string") {
    return invalid("负债备注格式无效");
  }

  return {
    ok: true,
    value: {
      id: fact.id,
      type: fact.type,
      outstandingBalance: fact.outstandingBalance,
      monthlyPayment: fact.monthlyPayment,
      includedInEssentialExpense: fact.includedInEssentialExpense,
      source: fact.source,
      note: fact.note,
    },
  };
}

function validateLiabilityFacts(liabilities) {
  if (!Array.isArray(liabilities)) {
    return invalid("负债列表格式无效");
  }

  const ids = [];
  const facts = [];
  for (const liability of liabilities) {
    const result = validateLiabilityFact(liability, ids);
    if (!result.ok) return result;
    ids.push(result.value.id);
    facts.push(result.value);
  }

  return { ok: true, value: facts };
}

function calculateLiabilitySummary(liabilities, context = {}) {
  const source = Array.isArray(liabilities) ? liabilities : [];
  const totals = source.reduce((summary, item) => {
    summary.totalLiabilities += item.outstandingBalance;
    summary.totalMonthlyPayment += item.monthlyPayment;
    if (item.includedInEssentialExpense === false) {
      summary.uncoveredMonthlyPayment += item.monthlyPayment;
    }
    return summary;
  }, {
    totalLiabilities: 0,
    totalMonthlyPayment: 0,
    uncoveredMonthlyPayment: 0,
  });

  const monthlyEssentialExpense = context && context.monthlyEssentialExpense;
  const investableAssetsTotal = context && context.investableAssetsTotal;
  return {
    ...totals,
    effectiveEssentialExpense: Number.isFinite(monthlyEssentialExpense) && monthlyEssentialExpense > 0
      ? monthlyEssentialExpense + totals.uncoveredMonthlyPayment
      : null,
    investableNetAssets: Number.isFinite(investableAssetsTotal)
      ? investableAssetsTotal - totals.totalLiabilities
      : null,
  };
}

module.exports = {
  LIABILITY_TYPES,
  validateLiabilityFact,
  validateLiabilityFacts,
  calculateLiabilitySummary,
};
