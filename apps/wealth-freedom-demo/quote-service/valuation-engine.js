const calc = require("../wechat-miniapp/utils/calculation-core");
const valuation = require("../wechat-miniapp/utils/valuation-model");
const mockProvider = require("./providers/mock-provider");

function normalizeCode(holding) {
  return String((holding && holding.code) || "").trim();
}

function getQuoteAssetType(holding) {
  const normalized = calc.normalizeHolding(holding);
  const category = calc.getHoldingCategory(normalized);
  if (category === "cash") return "cash";
  if (category === "bond") return "bond";
  if (category === "commodity") {
    return normalized.instrument === "gold" || normalized.type === "gold" ? "gold" : "commodity";
  }
  if (normalized.instrument === "stock") return "stock";
  return "fund";
}

function skippedQuote(holding, now) {
  const normalized = calc.normalizeHolding(holding);
  return {
    code: normalized.code || "",
    name: normalized.name || "",
    assetType: "cash",
    price: normalized.currentPrice,
    priceTime: normalized.updatedAt || now,
    source: normalized.source || "manual",
    status: "skipped",
    message: "cash asset keeps manual value and does not request quote",
  };
}

function errorQuote(holding, message, now) {
  const normalized = calc.normalizeHolding(holding);
  return {
    code: normalized.code || "",
    name: normalized.name || "",
    assetType: getQuoteAssetType(normalized),
    price: normalized.currentPrice,
    priceTime: now,
    source: "quote-service",
    status: "error",
    message,
  };
}

async function fetchQuote(provider, holding, now, options = {}) {
  const normalized = calc.normalizeHolding(holding);
  const category = calc.getHoldingCategory(normalized);
  if (category === "cash") return skippedQuote(normalized, now);
  if (!normalizeCode(normalized)) return errorQuote(normalized, "missing asset code; keep previous valuation", now);

  try {
    return await provider.getQuote(
      {
        type: getQuoteAssetType(normalized),
        code: normalizeCode(normalized),
        name: normalized.name || "",
        previousPrice: normalized.currentPrice,
        holding: normalized,
      },
      {
        env: options.env || process.env,
        now,
        priceTime: now,
        transport: options.transport,
      },
    );
  } catch (error) {
    return errorQuote(normalized, error && error.message ? error.message : "provider unavailable", now);
  }
}

function applyQuoteToHolding(holding, quote) {
  const normalized = calc.normalizeHolding(holding);
  const category = calc.getHoldingCategory(normalized);

  if (category === "cash") {
    return {
      ...normalized,
      quoteStatus: "skipped",
      quoteMessage: quote && quote.message ? quote.message : "cash asset keeps manual value",
    };
  }

  if (!quote || quote.status !== "ok" || !Number.isFinite(Number(quote.price))) {
    return {
      ...normalized,
      quoteStatus: quote && quote.status ? quote.status : "error",
      quoteMessage: quote && quote.message ? quote.message : "quote failed; keep previous valuation",
    };
  }

  const previousValue = calc.getHoldingValue(normalized);
  const currentPrice = calc.roundedPrice(Number(quote.price));
  const currentValue = normalized.quantity * currentPrice;
  return {
    ...normalized,
    currentPrice,
    currentValue,
    costAmount: normalized.quantity * normalized.costPrice,
    todayPnl: currentValue - previousValue,
    updatedAt: quote.priceTime || normalized.updatedAt,
    source: quote.source || normalized.source || "quote-service",
    quoteStatus: quote.status || "ok",
    quoteMessage: quote.message || "valuation refreshed",
  };
}

function buildRefreshStatus(holdings) {
  return holdings.reduce(
    (status, holding) => {
      if (holding.quoteStatus === "ok") status.okCount += 1;
      else if (holding.quoteStatus === "skipped") status.skippedCount += 1;
      else if (holding.quoteStatus === "manual_fallback") status.manualFallbackCount += 1;
      else status.errorCount += 1;
      return status;
    },
    { okCount: 0, errorCount: 0, skippedCount: 0, manualFallbackCount: 0 },
  );
}

async function refreshHoldingsWithProvider(holdings = [], options = {}) {
  const now = options.now || new Date().toISOString();
  const provider = options.provider || mockProvider;
  const quotes = await Promise.all(holdings.map((holding) => fetchQuote(provider, holding, now, options)));
  const nextHoldings = holdings.map((holding, index) => applyQuoteToHolding(holding, quotes[index]));
  return {
    holdings: nextHoldings,
    quotes,
    refreshStatus: buildRefreshStatus(nextHoldings),
  };
}

async function buildValuationPreview(body = {}, options = {}) {
  const now = body.now || options.now || new Date().toISOString();
  const holdings = Array.isArray(body.holdings) ? body.holdings : [];
  const previousSnapshots = Array.isArray(body.snapshots) ? body.snapshots : [];
  const refreshed = await refreshHoldingsWithProvider(holdings, {
    now,
    provider: options.provider || mockProvider,
  });
  const snapshot = valuation.buildValuationSnapshot(refreshed.holdings, previousSnapshots, { now });
  return {
    holdings: refreshed.holdings,
    quotes: refreshed.quotes,
    snapshot,
    refreshStatus: refreshed.refreshStatus,
  };
}

module.exports = {
  applyQuoteToHolding,
  buildValuationPreview,
  getQuoteAssetType,
  refreshHoldingsWithProvider,
};
