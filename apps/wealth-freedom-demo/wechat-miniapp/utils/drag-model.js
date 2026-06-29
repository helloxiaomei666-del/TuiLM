const calc = require("./calculation-core");
const { yuan } = require("./format");

const dragCategoryOptions = [
  { value: "medical", label: "医疗" },
  { value: "mortgage", label: "房贷" },
  { value: "car", label: "车贷" },
  { value: "other", label: "其他" },
];

function getCategoryLabel(category) {
  const option = dragCategoryOptions.find((item) => item.value === category);
  return option ? option.label : "其他";
}

function numberOr(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeDragForm(form, options = {}) {
  const category = form.category || "medical";
  const amount = Math.max(0, numberOr(form.amount, 0));
  const customTitle = String(form.title || "").trim();
  return {
    id: options.id || form.id || `manual-drag-${Date.now()}`,
    category,
    title: category === "other" && customTitle ? customTitle : getCategoryLabel(category),
    amount,
    detail: String(form.detail || "").trim() || "用户手动录入",
    createdAt: new Date().toISOString(),
  };
}

function formatSavedMonths(months) {
  const rounded = Math.max(0, Math.round(Number(months) || 0));
  if (rounded <= 0) return "0 个月";
  if (rounded < 12) return `${rounded} 个月`;
  const years = Math.floor(rounded / 12);
  const remainMonths = rounded % 12;
  return remainMonths ? `${years} 年 ${remainMonths} 个月` : `${years} 年`;
}

function getImpactClass(savedMonths) {
  const months = Math.max(0, Number(savedMonths) || 0);
  if (months >= 12) return "impact-high";
  if (months > 0) return "impact-medium";
  return "impact-low";
}

function decorateDrags(manualDrags = [], values, baseResult) {
  return calc.getManualDragInsights(manualDrags, values, baseResult).map((item) => {
    const source = manualDrags.find((drag) => drag.id === item.id);
    const savedMonths = Math.max(0, Number(item.savedMonths) || 0);
    return {
      ...item,
      category: source ? source.category : "other",
      categoryLabel: source ? getCategoryLabel(source.category) : "其他",
      amount: source ? Number(source.amount) || 0 : 0,
      amountText: yuan(source ? source.amount : 0),
      impactText: calc.formatDragImpactText(item),
      savedMonths,
      savedMonthsText: formatSavedMonths(savedMonths),
      impactClass: getImpactClass(savedMonths),
    };
  });
}

function getCategoryRows(manualDrags = []) {
  const total = calc.getManualDragTotal(manualDrags);
  return dragCategoryOptions
    .map((category) => {
      const categoryDrags = manualDrags.filter((item) => item.category === category.value);
      const amount = categoryDrags.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const share = total > 0 ? (amount / total) * 100 : 0;
      return {
        type: category.value,
        label: category.label,
        amount,
        amountText: yuan(amount),
        countText: `${categoryDrags.length} 项`,
        shareText: `${share.toFixed(0)}%`,
        barWidth: `${Math.max(4, Math.min(100, share)).toFixed(0)}%`,
        className: `category-${category.value}`,
      };
    })
    .filter((item) => item.amount > 0);
}

function getTotalSavedMonths(values, baseResult) {
  if (!values || !baseResult) return 0;
  const optimizedResult = calc.simulate({
    ...values,
    manualDragOutflow: 0,
  });
  return Math.max(0, calc.delayCompared(baseResult, optimizedResult));
}

function getDragSummary(manualDrags = [], values, baseResult) {
  const total = calc.getManualDragTotal(manualDrags);
  const decorated = values && baseResult ? decorateDrags(manualDrags, values, baseResult) : [];
  const priorityDrag = [...decorated].sort((a, b) => b.savedMonths - a.savedMonths || b.amount - a.amount)[0];
  const savedMonths = getTotalSavedMonths(values, baseResult);
  const hasDrags = manualDrags.length > 0;
  return {
    total,
    totalText: yuan(total),
    countText: `${manualDrags.length} 项`,
    savedMonths,
    savedMonthsText: formatSavedMonths(savedMonths),
    headlineText: hasDrags ? `全部优化后，退休时间可能提前约 ${formatSavedMonths(savedMonths)}` : "还没有拖累项",
    actionText: hasDrags ? "先处理金额高、可提前时间长的项目。" : "添加医疗、房贷、车贷或其他长期支出，查看它们对退休时间的影响。",
    topDragTitle: priorityDrag ? priorityDrag.title : "等待添加拖累项",
    topDragAmountText: priorityDrag ? priorityDrag.amountText : "-",
    topDragImpactText: priorityDrag ? priorityDrag.impactText : "添加拖累项后显示优先处理建议",
    topDragClass: priorityDrag ? priorityDrag.impactClass : "impact-low",
    categoryRows: getCategoryRows(manualDrags),
  };
}

module.exports = {
  dragCategoryOptions,
  getCategoryLabel,
  normalizeDragForm,
  decorateDrags,
  formatSavedMonths,
  getDragSummary,
};
