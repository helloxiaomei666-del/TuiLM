const { findQuote } = require("../mock-quotes");

function getQuote(request = {}, options = {}) {
  const result = findQuote(request.type, request.code, {
    priceTime: options.priceTime || options.now,
  });

  if (result.ok) return result.quote;

  return {
    code: String(request.code || ""),
    name: request.name || "",
    assetType: request.type || "",
    price: request.previousPrice || 0,
    priceTime: options.priceTime || options.now || new Date().toISOString(),
    source: "local mock quote-service",
    status: "error",
    message: result.message || "quote not available",
  };
}

module.exports = {
  name: "mockProvider",
  getQuote,
};
