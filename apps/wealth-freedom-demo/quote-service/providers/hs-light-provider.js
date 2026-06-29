const http = require("node:http");
const https = require("node:https");
const { URL } = require("node:url");

const defaultBaseUrl = "https://sandbox.hscloud.cn";
const netValuePath = "/gildatafund/v1/performance/net_value";

function getConfig(env = process.env) {
  return {
    baseUrl: env.HS_LIGHT_BASE_URL || defaultBaseUrl,
    hasAuthorization: Boolean(env.HS_LIGHT_AUTHORIZATION),
    authorization: env.HS_LIGHT_AUTHORIZATION || "",
    providerName: env.HS_LIGHT_PROVIDER_NAME || "恒生 LIGHT 云",
    timeoutMs: Number(env.HS_LIGHT_TIMEOUT_MS || 8000),
    tradingDate: env.HS_LIGHT_TRADING_DATE || "",
  };
}

function normalizeProviderError(message = "") {
  const rawMessage = String(message || "");
  const lower = rawMessage.toLowerCase();

  if (/未开通|未订购|无权限|权限不足|访问权限|permission|not authorized|unauthorized/.test(rawMessage) || lower.includes("permission")) {
    return {
      errorCode: "provider_permission_denied",
      message: "数据源权限不足，已保留上次估值",
    };
  }

  if (/频率|频次|次数|额度|rate|limit|quota/.test(rawMessage) || lower.includes("rate limit")) {
    return {
      errorCode: "provider_rate_limited",
      message: "数据源调用额度不足，已保留上次估值",
    };
  }

  if (/authorization|认证|登录|签名|auth/.test(rawMessage) || lower.includes("authorization")) {
    return {
      errorCode: "provider_auth_error",
      message: "数据源认证失败，已保留上次估值",
    };
  }

  return {
    errorCode: "provider_unavailable",
    message: rawMessage || "数据源暂不可用，已保留上次估值",
  };
}

function errorQuote(request = {}, message, options = {}) {
  const normalizedError = normalizeProviderError(message);
  return {
    code: String(request.code || ""),
    name: request.name || "",
    assetType: request.type || "fund",
    price: Number.isFinite(Number(request.previousPrice)) ? Number(request.previousPrice) : 0,
    priceTime: options.now || new Date().toISOString(),
    source: "恒生 LIGHT 云",
    status: "error",
    errorCode: options.errorCode || normalizedError.errorCode,
    message: options.message || normalizedError.message,
  };
}

function normalizeCode(code = "") {
  return String(code).trim().toUpperCase();
}

function normalizeHsCode(request = {}) {
  const code = normalizeCode(request.code);
  if (!code) return "";
  if (code.includes(".")) return code;
  return `${code}.OF`;
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function previousBusinessDate(now = new Date()) {
  const date = new Date(now);
  if (Number.isNaN(date.getTime())) return "";
  date.setHours(0, 0, 0, 0);
  do {
    date.setDate(date.getDate() - 1);
  } while (date.getDay() === 0 || date.getDay() === 6);
  return formatLocalDate(date);
}

function getTradingDate(request = {}, options = {}, env = process.env) {
  return request.tradingDate || request.tradeDate || options.tradingDate || env.HS_LIGHT_TRADING_DATE || previousBusinessDate(options.now || new Date());
}

function toHsLightPayload(request = {}, options = {}, env = process.env) {
  return {
    en_prod_code: normalizeHsCode(request),
    trading_date: getTradingDate(request, options, env),
    fields: "prod_code,en_prod_code,trading_date,unit_nv,nv_daily_growth_rate",
  };
}

function formEncode(payload = {}) {
  return Object.entries(payload)
    .filter(([, value]) => value !== undefined && value !== null && String(value) !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
}

function endpointUrl(baseUrl) {
  return new URL(netValuePath, baseUrl).toString();
}

function postForm(urlString, payload, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const body = formEncode(payload);
    const transport = url.protocol === "http:" ? http : https;
    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(body),
    };
    if (options.authorization) {
      headers.Authorization = options.authorization;
    }

    const request = transport.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "http:" ? 80 : 443),
        path: `${url.pathname}${url.search}`,
        method: "POST",
        headers,
        timeout: options.timeoutMs || 8000,
      },
      (response) => {
        let responseBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          responseBody += chunk;
        });
        response.on("end", () => {
          try {
            resolve(JSON.parse(responseBody));
          } catch {
            reject(new Error("invalid HS LIGHT JSON response"));
          }
        });
      },
    );
    request.on("timeout", () => {
      request.destroy(new Error("HS LIGHT request timeout"));
    });
    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

function normalizeHsLightResponse(response = {}) {
  return Array.isArray(response.data) ? response.data : [];
}

function hsDateToIso(value, fallback) {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return `${raw}T15:00:00+08:00`;
  }
  return fallback || new Date().toISOString();
}

async function getQuote(request = {}, options = {}) {
  const env = options.env || process.env;
  const config = getConfig(env);
  const now = options.now || new Date().toISOString();

  if (request.type && !["fund", "etf"].includes(String(request.type).toLowerCase())) {
    return errorQuote(request, "HS LIGHT provider only supports fund or ETF valuation", { now });
  }

  if (!normalizeCode(request.code)) {
    return errorQuote(request, "missing fund code; keep previous valuation", { now });
  }

  if (!config.hasAuthorization) {
    return errorQuote(request, "HS_LIGHT_AUTHORIZATION is not configured on backend; keep previous valuation", { now });
  }

  const payload = toHsLightPayload(request, options, env);
  const transport = options.transport || postForm;

  try {
    const response = await transport(endpointUrl(config.baseUrl), payload, {
      authorization: config.authorization,
      timeoutMs: config.timeoutMs,
    });

    if (String(response.error_no || "0") !== "0") {
      return errorQuote(request, response.error_info || "HS LIGHT provider returned an error", { now });
    }

    const rows = normalizeHsLightResponse(response);
    if (!rows.length) {
      return errorQuote(request, "HS LIGHT returned no valuation rows; keep previous valuation", { now });
    }

    const row = rows[0];
    const price = Number(row.unit_nv);
    if (!Number.isFinite(price) || price <= 0) {
      return errorQuote(request, "HS LIGHT response is missing a usable unit_nv", { now });
    }

    return {
      code: normalizeCode(request.code),
      name: request.name || "",
      assetType: request.type || "fund",
      price,
      priceTime: hsDateToIso(row.trading_date, now),
      source: "恒生 LIGHT 云 performance/net_value",
      status: "ok",
      message: "恒生 LIGHT 云基金净值指标",
    };
  } catch (error) {
    return errorQuote(request, error && error.message ? error.message : "HS LIGHT provider request failed", { now });
  }
}

module.exports = {
  name: "hsLightProvider",
  endpointUrl,
  formEncode,
  getConfig,
  getQuote,
  getTradingDate,
  formatLocalDate,
  normalizeHsCode,
  normalizeHsLightResponse,
  normalizeProviderError,
  previousBusinessDate,
  toHsLightPayload,
};
