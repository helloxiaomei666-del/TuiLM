const calc = require("./calculation-core");

const defaultQuoteServiceBaseUrl = "http://127.0.0.1:8010";

function nowText(options) {
  return options && options.now ? options.now : new Date().toISOString();
}

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

function buildSkippedQuote(holding, options) {
  const normalized = calc.normalizeHolding(holding);
  return {
    code: normalized.code || "",
    name: normalized.name || "",
    assetType: "cash",
    price: normalized.currentPrice,
    priceTime: normalized.updatedAt || nowText(options),
    source: normalized.source || "manual",
    status: "skipped",
    message: "现金资产保持手动金额，不请求行情",
  };
}

function buildManualFallbackQuote(holding, options) {
  const normalized = calc.normalizeHolding(holding);
  return {
    code: normalized.code || "",
    name: normalized.name || "",
    assetType: getQuoteAssetType(normalized),
    price: normalized.currentPrice,
    priceTime: normalized.updatedAt || nowText(options),
    source: normalized.source || "manual fallback",
    status: "manual_fallback",
    message: "暂未接入该资产类型行情，保留手动价格",
  };
}

function mockRate(holding, seed) {
  const category = calc.getHoldingCategory(holding);
  const ranges = { stock: 0.014, bond: 0.002, commodity: 0.01 };
  const range = ranges[category] || 0;
  const hash = calc.stableHash(`${holding.id || ""}:${holding.code || ""}:${seed || 1}`);
  return ((hash / 1000003) * 2 - 1) * range;
}

function buildLocalMockQuote(holding, options) {
  const normalized = calc.normalizeHolding(holding);
  const assetType = getQuoteAssetType(normalized);
  const category = calc.getHoldingCategory(normalized);

  if (category === "cash") return buildSkippedQuote(normalized, options);
  if (category === "bond") return buildManualFallbackQuote(normalized, options);
  if (!normalizeCode(normalized)) {
    return {
      code: "",
      name: normalized.name || "",
      assetType,
      price: normalized.currentPrice,
      priceTime: nowText(options),
      source: "local mock quote adapter",
      status: "error",
      message: "缺少资产代码，保留原估值",
    };
  }

  const price = calc.roundedPrice(Math.max(0.0001, normalized.currentPrice * (1 + mockRate(normalized, options && options.seed))));
  return {
    code: normalized.code,
    name: normalized.name,
    assetType,
    price,
    priceTime: nowText(options),
    source: "local mock quote adapter",
    status: "ok",
    message: "本地估值刷新",
  };
}

function buildServiceUrl(holding, options) {
  const baseUrl = (options && options.baseUrl) || defaultQuoteServiceBaseUrl;
  const normalized = calc.normalizeHolding(holding);
  const type = encodeURIComponent(getQuoteAssetType(normalized));
  const code = encodeURIComponent(normalizeCode(normalized));
  return `${baseUrl}/api/quotes?type=${type}&code=${code}`;
}

function fetchQuoteWithWxRequest(holding, options) {
  if (typeof wx === "undefined" || !wx.request) {
    return Promise.resolve({
      code: normalizeCode(holding),
      name: holding.name || "",
      assetType: getQuoteAssetType(holding),
      price: holding.currentPrice,
      priceTime: nowText(options),
      source: "wx.request",
      status: "error",
      message: "当前环境不可用 wx.request，保留原估值",
    });
  }

  return new Promise((resolve) => {
    wx.request({
      url: buildServiceUrl(holding, options),
      method: "GET",
      success(result) {
        const data = result && result.data ? result.data : {};
        if (data.status === "ok" && data.quote) {
          resolve(data.quote);
          return;
        }
        resolve({
          code: normalizeCode(holding),
          name: holding.name || "",
          assetType: getQuoteAssetType(holding),
          price: holding.currentPrice,
          priceTime: nowText(options),
          source: "quote-service",
          status: "error",
          message: data.error && data.error.message ? data.error.message : "行情服务返回失败，保留原估值",
        });
      },
      fail() {
        resolve({
          code: normalizeCode(holding),
          name: holding.name || "",
          assetType: getQuoteAssetType(holding),
          price: holding.currentPrice,
          priceTime: nowText(options),
          source: "quote-service",
          status: "error",
          message: "行情服务暂不可用，保留原估值",
        });
      },
    });
  });
}

function fetchQuoteForHolding(holding, options) {
  const normalized = calc.normalizeHolding(holding);
  const adapter = (options && options.adapter) || "local";
  const category = calc.getHoldingCategory(normalized);

  if (category === "cash") return buildSkippedQuote(normalized, options);
  if (adapter === "wx-request" || adapter === "backend") return fetchQuoteWithWxRequest(normalized, options);
  if (typeof adapter === "function") return adapter(normalized, options);
  return buildLocalMockQuote(normalized, options);
}

function applyQuoteToHolding(holding, quote) {
  const normalized = calc.normalizeHolding(holding);
  const category = calc.getHoldingCategory(normalized);

  if (category === "cash") {
    return {
      ...normalized,
      quoteStatus: "skipped",
      quoteMessage: quote && quote.message ? quote.message : "现金资产保持手动金额，不请求行情",
    };
  }

  if (!quote || quote.status === "error" || !Number.isFinite(Number(quote.price))) {
    return {
      ...normalized,
      quoteStatus: quote && quote.status ? quote.status : "error",
      quoteMessage: quote && quote.message ? quote.message : "估值刷新失败，已保留上次价格",
    };
  }

  if (quote.status === "manual_fallback") {
    return {
      ...normalized,
      quoteStatus: "manual_fallback",
      quoteMessage: quote.message || "保留手动价格",
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
    quoteMessage: quote.message || "估值已刷新",
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

function refreshHoldingsWithQuotes(holdings, options) {
  const rows = holdings || [];
  const quotes = rows.map((holding) => fetchQuoteForHolding(holding, options));
  const hasAsync = quotes.some((quote) => quote && typeof quote.then === "function");

  if (hasAsync) {
    return Promise.all(quotes).then((resolvedQuotes) => {
      const nextHoldings = rows.map((holding, index) => applyQuoteToHolding(holding, resolvedQuotes[index]));
      return {
        holdings: nextHoldings,
        totals: calc.getHoldingTotals(nextHoldings),
        refreshStatus: buildRefreshStatus(nextHoldings),
      };
    });
  }

  const nextHoldings = rows.map((holding, index) => applyQuoteToHolding(holding, quotes[index]));
  return {
    holdings: nextHoldings,
    totals: calc.getHoldingTotals(nextHoldings),
    refreshStatus: buildRefreshStatus(nextHoldings),
  };
}

module.exports = {
  defaultQuoteServiceBaseUrl,
  getQuoteAssetType,
  fetchQuoteForHolding,
  refreshHoldingsWithQuotes,
  applyQuoteToHolding,
};
