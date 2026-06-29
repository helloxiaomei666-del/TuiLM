const http = require("node:http");
const https = require("node:https");
const { URL } = require("node:url");

const defaultBaseUrl = "https://api.tushare.pro";

function getConfig(env = process.env) {
  return {
    baseUrl: env.TUSHARE_BASE_URL || defaultBaseUrl,
    hasToken: Boolean(env.TUSHARE_TOKEN),
    providerName: env.TUSHARE_PROVIDER_NAME || "Tushare Pro",
    timeoutMs: Number(env.TUSHARE_TIMEOUT_MS || 8000),
  };
}

function normalizeProviderError(message = "") {
  const rawMessage = String(message || "");
  const lower = rawMessage.toLowerCase();

  if (/没有接口|访问权限|无权限|权限不足|permission|not authorized|unauthorized/.test(rawMessage) || lower.includes("permission")) {
    return {
      errorCode: "provider_permission_denied",
      message: "数据源权限不足，已保留上次估值",
    };
  }

  if (/频次|次数|积分|额度|rate|limit|quota/.test(rawMessage) || lower.includes("rate limit")) {
    return {
      errorCode: "provider_rate_limited",
      message: "数据源调用额度不足，已保留上次估值",
    };
  }

  if (/token|认证|登录|auth/.test(rawMessage) || lower.includes("token")) {
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
    source: "Tushare Pro",
    status: "error",
    errorCode: options.errorCode || normalizedError.errorCode,
    message: options.message || normalizedError.message,
  };
}

function normalizeCode(code = "") {
  return String(code).trim().toUpperCase();
}

function normalizeTsCode(request = {}) {
  const code = normalizeCode(request.code);
  if (!code) return "";
  if (code.includes(".")) return code;
  return `${code}.OF`;
}

function shouldUseFundDaily(request = {}) {
  const code = normalizeCode(request.code);
  const type = String(request.type || "").toLowerCase();
  if (type === "etf") return true;
  return /\.(SH|SZ)$/.test(code);
}

function getApiPlan(request = {}) {
  if (shouldUseFundDaily(request)) {
    return {
      apiName: "fund_daily",
      fields: "ts_code,trade_date,close",
      dateField: "trade_date",
      priceFields: ["close"],
      source: "Tushare Pro fund_daily",
      message: "Tushare Pro 场内基金日线估值",
    };
  }

  return {
    apiName: "fund_nav",
    fields: "ts_code,end_date,unit_nav,accum_nav",
    dateField: "end_date",
    priceFields: ["unit_nav", "nav", "adj_nav", "close"],
    source: "Tushare Pro fund_nav",
    message: "Tushare Pro 公募基金净值",
  };
}

function toTusharePayload(request = {}, env = process.env) {
  const plan = getApiPlan(request);
  return {
    api_name: plan.apiName,
    token: env.TUSHARE_TOKEN,
    params: {
      ts_code: normalizeTsCode(request),
    },
    fields: plan.fields,
  };
}

function postJson(urlString, payload, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const body = JSON.stringify(payload);
    const transport = url.protocol === "http:" ? http : https;
    const request = transport.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "http:" ? 80 : 443),
        path: `${url.pathname}${url.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
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
            reject(new Error("invalid Tushare JSON response"));
          }
        });
      },
    );
    request.on("timeout", () => {
      request.destroy(new Error("Tushare request timeout"));
    });
    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

function rowToObject(fields = [], row = []) {
  return fields.reduce((result, field, index) => {
    result[field] = row[index];
    return result;
  }, {});
}

function normalizeTushareResponse(response = {}) {
  const data = response.data || {};
  const fields = Array.isArray(data.fields) ? data.fields : [];
  const items = Array.isArray(data.items) ? data.items : [];
  return items.map((item) => rowToObject(fields, item));
}

function getFirstPrice(row = {}, priceFields = []) {
  for (const field of priceFields) {
    const price = Number(row[field]);
    if (Number.isFinite(price) && price > 0) return price;
  }
  return null;
}

function tushareDateToIso(value, fallback) {
  const raw = String(value || "").trim();
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T15:00:00+08:00`;
  }
  return fallback || new Date().toISOString();
}

async function getQuote(request = {}, options = {}) {
  const env = options.env || process.env;
  const config = getConfig(env);
  const now = options.now || new Date().toISOString();

  if (request.type && !["fund", "etf"].includes(String(request.type).toLowerCase())) {
    return errorQuote(request, "Tushare fund provider only supports fund or ETF valuation", { now });
  }

  if (!normalizeCode(request.code)) {
    return errorQuote(request, "missing fund code; keep previous valuation", { now });
  }

  if (!config.hasToken) {
    return errorQuote(request, "TUSHARE_TOKEN is not configured on backend; keep previous valuation", { now });
  }

  const plan = getApiPlan(request);
  const payload = toTusharePayload(request, env);
  const transport = options.transport || postJson;

  try {
    const response = await transport(config.baseUrl, payload, {
      timeoutMs: config.timeoutMs,
    });

    if (Number(response.code || 0) !== 0) {
      return errorQuote(request, response.msg || "Tushare provider returned an error", { now });
    }

    const rows = normalizeTushareResponse(response);
    if (!rows.length) {
      return errorQuote(request, "Tushare returned no fund valuation rows; keep previous valuation", { now });
    }

    const row = rows[0];
    const price = getFirstPrice(row, plan.priceFields);
    if (!Number.isFinite(price)) {
      return errorQuote(request, "Tushare response is missing a usable valuation price", { now });
    }

    return {
      code: normalizeCode(request.code),
      name: request.name || row.name || "",
      assetType: shouldUseFundDaily(request) ? "etf" : "fund",
      price,
      priceTime: tushareDateToIso(row[plan.dateField], now),
      source: plan.source,
      status: "ok",
      message: plan.message,
    };
  } catch (error) {
    return errorQuote(request, error && error.message ? error.message : "Tushare provider request failed", { now });
  }
}

module.exports = {
  name: "tushareProvider",
  getApiPlan,
  getConfig,
  getQuote,
  normalizeTsCode,
  normalizeProviderError,
  normalizeTushareResponse,
  toTusharePayload,
};
