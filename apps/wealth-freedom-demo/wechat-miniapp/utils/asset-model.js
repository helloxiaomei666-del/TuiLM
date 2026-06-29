const calc = require("./calculation-core");
const { yuan } = require("./format");
const valuation = require("./valuation-model");
let quoteClient = null;

try {
  quoteClient = require("./quote-client");
} catch (error) {
  quoteClient = null;
}

const assetTypeOptions = [
  { value: "cash", label: "现金" },
  { value: "stock", label: "基金" },
  { value: "bond", label: "债券" },
  { value: "commodity", label: "商品" },
];

const defaultInstrumentByType = {
  cash: "cash",
  stock: "fund",
  bond: "bondFund",
  commodity: "gold",
};

function getTypeLabel(type) {
  const option = assetTypeOptions.find((item) => item.value === type);
  return option ? option.label : "资产";
}

function numberOr(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeAssetForm(form, options = {}) {
  const type = form.type || "stock";
  const id = options.id || form.id || `holding-${Date.now()}`;
  if (type === "cash") {
    const amount = Math.max(0, numberOr(form.amount, 0));
    return {
      id,
      type,
      instrument: "cash",
      name: form.name || "现金账户",
      code: "",
      quantity: 1,
      costPrice: amount,
      currentPrice: amount,
      currentValue: amount,
      costAmount: amount,
      todayPnl: 0,
      updatedAt: "手动录入",
      source: "manual",
      quoteStatus: "skipped",
      quoteMessage: "现金资产保持手动金额，不请求行情",
    };
  }

  const quantity = Math.max(0, numberOr(form.quantity, 0));
  const costPrice = Math.max(0, numberOr(form.costPrice, 0));
  const currentPrice = Math.max(0, numberOr(form.currentPrice, 0));
  const amount = Math.max(0, numberOr(form.amount, 0));
  const resolvedQuantity = quantity || (amount && currentPrice ? amount / currentPrice : 1);
  const resolvedCurrentPrice = amount ? amount / Math.max(resolvedQuantity, 1) : currentPrice;
  const currentValue = amount || resolvedQuantity * resolvedCurrentPrice;
  const resolvedCostPrice = costPrice || (currentValue / Math.max(resolvedQuantity, 1));
  return {
    id,
    type,
    instrument: defaultInstrumentByType[type] || "fund",
    name: form.name || `${getTypeLabel(type)}资产`,
    code: form.code || "",
    quantity: resolvedQuantity,
    costPrice: resolvedCostPrice,
    currentPrice: resolvedCurrentPrice,
    currentValue,
    costAmount: resolvedQuantity * resolvedCostPrice,
    todayPnl: 0,
    updatedAt: "手动录入",
    source: "manual",
    quoteStatus: "manual",
    quoteMessage: "等待估值刷新",
  };
}

function getAssetFormFromHolding(holding) {
  const normalized = calc.normalizeHolding(holding);
  const type = calc.getHoldingCategory(normalized);
  const amount = calc.getHoldingValue(normalized);
  if (type === "cash") {
    return {
      type,
      name: normalized.name,
      amount: String(amount || ""),
    };
  }

  return {
    type,
    name: normalized.name,
    code: normalized.code || "",
    amount: String(amount || ""),
    quantity: String(normalized.quantity || ""),
    costPrice: String(normalized.costPrice || ""),
    currentPrice: String(normalized.currentPrice || ""),
  };
}

function upsertAssetHolding(holdings = [], form, editingId) {
  const nextHolding = normalizeAssetForm(form, { id: editingId });
  if (!editingId) return [nextHolding, ...holdings];

  let found = false;
  const nextHoldings = holdings.map((holding) => {
    if (holding.id !== editingId) return holding;
    found = true;
    return {
      ...holding,
      ...nextHolding,
      id: editingId,
    };
  });

  return found ? nextHoldings : [nextHolding, ...holdings];
}

function getQuoteStatus(normalized) {
  return normalized.quoteStatus || (calc.getHoldingCategory(normalized) === "cash" ? "skipped" : "manual");
}

function getQuoteMessage(normalized, quoteStatus) {
  if (normalized.quoteMessage) return normalized.quoteMessage;
  if (quoteStatus === "skipped") return "现金资产保持手动金额";
  if (quoteStatus === "manual_fallback") return "保留手动价格";
  if (quoteStatus === "error") return "估值刷新失败，保留上次价格";
  if (quoteStatus === "ok") return "估值已刷新";
  return "等待估值刷新";
}

function decorateHoldings(holdings = []) {
  return holdings.map((holding) => {
    const normalized = calc.normalizeHolding(holding);
    const category = calc.getHoldingCategory(normalized);
    const quoteStatus = getQuoteStatus(normalized);
    const quoteMessage = getQuoteMessage(normalized, quoteStatus);
    const source = normalized.source || "manual";
    const updatedAt = normalized.updatedAt || "手动录入";
    return {
      ...normalized,
      quoteStatus,
      quoteMessage,
      typeLabel: getTypeLabel(category),
      valueText: yuan(calc.getHoldingValue(normalized)),
      metaText:
        category === "cash"
          ? "现金账户"
          : `${normalized.code || "未填代码"} · ${Number(normalized.quantity || 0).toLocaleString("zh-CN")} 份`,
      todayText: `${(Number(normalized.todayPnl) || 0) >= 0 ? "+" : ""}${yuan(normalized.todayPnl || 0)}`,
      quoteText: `来源 ${source} · ${updatedAt}`,
      quoteMessageText: quoteMessage,
    };
  });
}

function getAssetSummary(holdings = [], valuationSnapshots = []) {
  const totals = calc.getHoldingTotals(holdings);
  const valuationSummary = valuation.getValuationSummary(valuationSnapshots);
  const bucketTotals = assetTypeOptions.map((option) => {
    const total = holdings.reduce((sum, holding) => {
      const normalized = calc.normalizeHolding(holding);
      if (calc.getHoldingCategory(normalized) !== option.value) return sum;
      return sum + calc.getHoldingValue(normalized);
    }, 0);
    const count = holdings.filter((holding) => calc.getHoldingCategory(calc.normalizeHolding(holding)) === option.value).length;
    const share = totals.total > 0 ? (total / totals.total) * 100 : 0;
    return {
      type: option.value,
      label: option.label,
      valueText: yuan(total),
      countText: `${count} 笔`,
      shareText: `${share.toFixed(1)}%`,
      barWidth: `${Math.max(share, total > 0 ? 4 : 0).toFixed(1)}%`,
      className: `allocation-${option.value}`,
    };
  });
  const quoteCounts = holdings.reduce(
    (counts, holding) => {
      const normalized = calc.normalizeHolding(holding);
      const status = getQuoteStatus(normalized);
      if (status === "ok") counts.ok += 1;
      else if (status === "skipped") counts.skipped += 1;
      else if (status === "error") counts.error += 1;
      else counts.manual += 1;
      if (normalized.updatedAt && normalized.updatedAt !== "手动录入" && normalized.updatedAt !== "旧数据迁移") {
        counts.latest = normalized.updatedAt;
      }
      return counts;
    },
    { ok: 0, error: 0, skipped: 0, manual: 0, latest: "" },
  );
  return {
    totalText: yuan(totals.total),
    cashText: yuan(totals.cash),
    investmentsText: yuan(totals.investments),
    todayText: `${totals.todayPnl >= 0 ? "+" : ""}${yuan(totals.todayPnl)}`,
    quoteStatusText: `估值 ${quoteCounts.ok} 成功 / ${quoteCounts.error} 失败 / ${quoteCounts.skipped} 现金`,
    quoteTimeText: quoteCounts.latest ? `最近更新 ${quoteCounts.latest}` : "尚未刷新估值",
    allocationRows: bucketTotals,
    valuationTotalText: valuationSummary.totalText,
    valuationChangeText: valuationSummary.changeText,
    valuationRateText: valuationSummary.rateText,
    valuationStatusText: valuationSummary.statusText,
    valuationTimeText: valuationSummary.timeText,
    valuationSourceText: valuationSummary.sourceText,
  };
}

function refreshHoldings(holdings = [], options = {}) {
  if (!quoteClient || !quoteClient.refreshHoldingsWithQuotes) {
    const fallback = calc.refreshMockHoldings(holdings, {
      seed: options.seed || Date.now(),
      refreshedAt: options.now || new Date().toISOString(),
    });
    return fallback.holdings.map((holding) => ({
      ...holding,
      quoteStatus: calc.getHoldingCategory(holding) === "cash" ? "skipped" : "ok",
      quoteMessage: calc.getHoldingCategory(holding) === "cash" ? "现金资产保持手动金额，不请求行情" : "本地估值刷新",
      source: calc.getHoldingCategory(holding) === "cash" ? holding.source : "local mock quote fallback",
    }));
  }

  const refreshed = quoteClient.refreshHoldingsWithQuotes(holdings, {
    adapter: options.adapter || "local",
    baseUrl: options.baseUrl,
    seed: options.seed || Date.now(),
    now: options.now || new Date().toISOString(),
  });
  if (refreshed && typeof refreshed.then === "function") {
    return refreshed.then((result) => result.holdings);
  }
  return refreshed.holdings;
}

function getMockOcrResult(type = "stock") {
  const byType = {
    stock: {
      type: "stock",
      name: "截图识别基金持仓",
      code: "000300",
      quantity: "1000",
      costPrice: "1.20",
      currentPrice: "1.25",
    },
    bond: {
      type: "bond",
      name: "截图识别债券基金",
      code: "110007",
      quantity: "2000",
      costPrice: "1.08",
      currentPrice: "1.10",
    },
    commodity: {
      type: "commodity",
      name: "截图识别黄金持仓",
      code: "gold-demo",
      quantity: "25",
      costPrice: "636",
      currentPrice: "672",
    },
  };
  return byType[type] || byType.stock;
}

module.exports = {
  assetTypeOptions,
  getTypeLabel,
  normalizeAssetForm,
  getAssetFormFromHolding,
  upsertAssetHolding,
  decorateHoldings,
  getAssetSummary,
  refreshHoldings,
  getMockOcrResult,
};
