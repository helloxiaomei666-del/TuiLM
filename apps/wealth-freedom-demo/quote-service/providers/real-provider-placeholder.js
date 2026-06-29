function getConfig(env = process.env) {
  return {
    baseUrl: env.QUOTE_API_BASE_URL || "",
    hasApiKey: Boolean(env.QUOTE_API_KEY),
    providerName: env.QUOTE_API_PROVIDER || "real-provider-placeholder",
  };
}

function getQuote(request = {}, options = {}) {
  const config = getConfig(options.env || process.env);
  return {
    code: String(request.code || ""),
    name: request.name || "",
    assetType: request.type || "",
    price: request.previousPrice || 0,
    priceTime: options.now || new Date().toISOString(),
    source: config.providerName,
    status: "error",
    message: "real provider is not configured; keep previous valuation",
  };
}

module.exports = {
  name: "realProviderPlaceholder",
  getConfig,
  getQuote,
};
