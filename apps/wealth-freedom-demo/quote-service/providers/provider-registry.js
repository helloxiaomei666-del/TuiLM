const mockProvider = require("./mock-provider");
const realProviderPlaceholder = require("./real-provider-placeholder");
const hsLightProvider = require("./hs-light-provider");
const tushareProvider = require("./tushare-provider");

function normalizeMode(value) {
  return String(value || "mock").trim().toLowerCase();
}

function getProvider(options = {}) {
  if (options.provider) return options.provider;

  const env = options.env || process.env;
  const mode = normalizeMode(options.providerMode || env.QUOTE_PROVIDER_MODE);

  if (mode === "mock" || mode === "local") return mockProvider;
  if (mode === "hs-light" || mode === "hslight" || mode === "hundsun") return hsLightProvider;
  if (mode === "tushare" || mode === "tushare-pro") return tushareProvider;
  if (mode === "placeholder" || mode === "real-provider-placeholder") return realProviderPlaceholder;

  return realProviderPlaceholder;
}

module.exports = {
  getProvider,
  normalizeMode,
};
