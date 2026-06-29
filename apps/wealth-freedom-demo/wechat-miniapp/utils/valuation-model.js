const calc = require("./calculation-core");
const format = require("./format");

function numberOr(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getSnapshotDate(options = {}) {
  const source = options.snapshotDate || options.now || new Date().toISOString();
  return String(source).slice(0, 10);
}

function getGeneratedAt(options = {}) {
  return options.now || new Date().toISOString();
}

function sortSnapshots(snapshots = []) {
  return [...snapshots].sort((a, b) => String(a.snapshotDate || "").localeCompare(String(b.snapshotDate || "")));
}

function getLatestSnapshot(snapshots = []) {
  const sorted = sortSnapshots(snapshots);
  return sorted.length ? sorted[sorted.length - 1] : null;
}

function getPreviousSnapshot(snapshots = [], snapshotDate) {
  const date = String(snapshotDate || "");
  const sorted = sortSnapshots(snapshots).filter((snapshot) => String(snapshot.snapshotDate || "") < date);
  return sorted.length ? sorted[sorted.length - 1] : null;
}

function getPreviousItem(previousSnapshot, holding) {
  if (!previousSnapshot || !Array.isArray(previousSnapshot.items)) return null;
  return previousSnapshot.items.find((item) => {
    if (item.holdingId && holding.id && item.holdingId === holding.id) return true;
    return item.code && holding.code && item.code === holding.code && item.assetType === holding.type;
  });
}

function getQuoteCounts(items) {
  return items.reduce(
    (counts, item) => {
      if (item.quoteStatus === "ok") counts.ok += 1;
      else if (item.quoteStatus === "skipped") counts.skipped += 1;
      else if (item.quoteStatus === "manual_fallback" || item.quoteStatus === "manual") counts.manual += 1;
      else counts.error += 1;
      return counts;
    },
    { ok: 0, error: 0, skipped: 0, manual: 0 },
  );
}

function getSnapshotStatus(items) {
  const counts = getQuoteCounts(items);
  if (counts.error > 0 && counts.ok + counts.manual + counts.skipped > 0) return "partial_error";
  if (counts.error > 0) return "error";
  if (counts.ok > 0) return "ok";
  if (counts.manual > 0) return "manual_fallback";
  return "skipped";
}

function getSnapshotMessage(status) {
  if (status === "ok") return "估值已更新";
  if (status === "partial_error") return "部分行情失败，已保留上次估值";
  if (status === "error") return "行情失败，已保留上次估值";
  if (status === "manual_fallback") return "部分资产沿用手动价格";
  return "现金资产无需行情刷新";
}

function buildSnapshotItems(holdings = [], previousSnapshot) {
  return holdings.map((holding) => {
    const normalized = calc.normalizeHolding(holding);
    const previous = getPreviousItem(previousSnapshot, normalized);
    const currentValue = calc.getHoldingValue(normalized);
    const currentPrice = numberOr(normalized.currentPrice, 0);
    return {
      holdingId: normalized.id || "",
      code: normalized.code || "",
      name: normalized.name || "",
      assetType: normalized.type || "cash",
      quantity: numberOr(normalized.quantity, 0),
      price: currentPrice,
      currentValue,
      costAmount: calc.getHoldingCost(normalized),
      todayPnl: numberOr(normalized.todayPnl, 0),
      dailyChange: previous ? currentValue - numberOr(previous.currentValue, 0) : 0,
      priceTime: normalized.updatedAt || "",
      source: normalized.source || "manual",
      quoteStatus: normalized.quoteStatus || (calc.getHoldingCategory(normalized) === "cash" ? "skipped" : "manual"),
      quoteMessage: normalized.quoteMessage || "",
    };
  });
}

function buildValuationSnapshot(holdings = [], snapshots = [], options = {}) {
  const snapshotDate = getSnapshotDate(options);
  const previousSnapshot = options.previousSnapshot || getPreviousSnapshot(snapshots, snapshotDate);
  const totals = calc.getHoldingTotals(holdings);
  const items = buildSnapshotItems(holdings, previousSnapshot);
  const status = getSnapshotStatus(items);
  const previousTotalValue = previousSnapshot ? numberOr(previousSnapshot.totalValue, 0) : null;
  const dailyChange = previousSnapshot ? totals.total - previousTotalValue : 0;
  const dailyChangeRate = previousSnapshot && previousTotalValue ? (dailyChange / previousTotalValue) * 100 : 0;
  const sources = Array.from(new Set(items.map((item) => item.source).filter(Boolean)));
  const priceTimes = items.map((item) => item.priceTime).filter(Boolean);

  return {
    id: `valuation-${snapshotDate}`,
    snapshotDate,
    generatedAt: getGeneratedAt(options),
    totalValue: totals.total,
    cashValue: totals.cash,
    investmentValue: totals.investments,
    dailyChange,
    dailyChangeRate,
    hasPrevious: Boolean(previousSnapshot),
    previousSnapshotDate: previousSnapshot ? previousSnapshot.snapshotDate : "",
    previousTotalValue,
    todayPnl: totals.todayPnl,
    quoteStatus: status,
    quoteMessage: getSnapshotMessage(status),
    source: sources.length ? sources.join(" / ") : "manual",
    priceTime: priceTimes.length ? priceTimes[priceTimes.length - 1] : "",
    itemCount: items.length,
    quoteCounts: getQuoteCounts(items),
    items,
  };
}

function upsertTodaySnapshot(snapshots = [], snapshot) {
  if (!snapshot || !snapshot.snapshotDate) return sortSnapshots(snapshots);
  const next = snapshots.filter((item) => item.snapshotDate !== snapshot.snapshotDate);
  next.push(snapshot);
  return sortSnapshots(next);
}

function signedYuan(value) {
  const amount = numberOr(value, 0);
  return `${amount >= 0 ? "+" : ""}${format.yuan(amount)}`;
}

function getValuationSummary(snapshots = []) {
  const latest = getLatestSnapshot(snapshots);
  if (!latest) {
    return {
      hasSnapshot: false,
      totalText: "-",
      changeText: "暂无估值快照",
      rateText: "-",
      statusText: "刷新估值后生成每日快照",
      timeText: "尚未记录",
      sourceText: "",
    };
  }

  return {
    hasSnapshot: true,
    totalText: format.yuan(latest.totalValue),
    changeText: latest.hasPrevious ? signedYuan(latest.dailyChange) : "暂无昨日对比",
    rateText: latest.hasPrevious ? format.percent(latest.dailyChangeRate) : "-",
    statusText: latest.quoteMessage || "估值已记录",
    timeText: `${latest.snapshotDate} ${latest.generatedAt ? String(latest.generatedAt).slice(11, 16) : ""}`.trim(),
    sourceText: latest.source ? `来源 ${latest.source}` : "",
    quoteStatus: latest.quoteStatus,
  };
}

module.exports = {
  buildValuationSnapshot,
  getLatestSnapshot,
  getPreviousSnapshot,
  getSnapshotDate,
  getValuationSummary,
  upsertTodaySnapshot,
};
