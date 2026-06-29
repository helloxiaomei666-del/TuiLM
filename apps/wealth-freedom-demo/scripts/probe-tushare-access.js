const http = require("node:http");
const https = require("node:https");
const { URL } = require("node:url");

const defaultBaseUrl = "https://api.tushare.pro";

const defaultProbeCases = [
  {
    id: "fund_nav",
    label: "Open-end fund NAV",
    apiName: "fund_nav",
    sample: "000001.OF",
    params: { ts_code: "000001.OF" },
    fields: "ts_code,end_date,unit_nav,accum_nav",
    valuationUse: "fund daily NAV valuation",
  },
  {
    id: "fund_daily",
    label: "ETF daily quote",
    apiName: "fund_daily",
    sample: "510300.SH",
    params: { ts_code: "510300.SH" },
    fields: "ts_code,trade_date,close",
    valuationUse: "ETF daily close valuation",
  },
];

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

function sanitizeMessage(message = "", token = "") {
  const raw = String(message || "");
  if (!token) return raw;
  return raw.split(token).join("[hidden-token]");
}

function classifyTushareResponse(response = {}) {
  const responseCode = Number(response.code);
  const rawMessage = String(response.msg || response.message || "");
  const lowerMessage = rawMessage.toLowerCase();

  if (responseCode === 0) {
    const items = response.data && Array.isArray(response.data.items) ? response.data.items : [];
    return {
      status: items.length ? "ok" : "accessible_empty_sample",
      errorCode: null,
      rowCount: items.length,
      message: items.length
        ? "Endpoint is accessible and returned data."
        : "Endpoint is accessible, but the sample returned no rows.",
    };
  }

  if (/没有接口|访问权限|无权限|权限不足|permission|not authorized|unauthorized|no access/i.test(rawMessage)) {
    return {
      status: "permission_denied",
      errorCode: "provider_permission_denied",
      rowCount: 0,
      message: "Endpoint is not enabled for this Tushare account.",
    };
  }

  if (/频次|次数|积分|额度|rate|limit|quota/i.test(rawMessage) || lowerMessage.includes("rate limit")) {
    return {
      status: "rate_limited",
      errorCode: "provider_rate_limited",
      rowCount: 0,
      message: "Endpoint is blocked by quota, points, or rate limit.",
    };
  }

  if (/token|认证|登录|auth/i.test(rawMessage) || lowerMessage.includes("token")) {
    return {
      status: "auth_error",
      errorCode: "provider_auth_error",
      rowCount: 0,
      message: "Token authentication failed.",
    };
  }

  return {
    status: "provider_error",
    errorCode: "provider_unavailable",
    rowCount: 0,
    message: rawMessage || "Tushare returned an unknown provider error.",
  };
}

async function probeCase(probe, options = {}) {
  const env = options.env || process.env;
  const transport = options.transport || postJson;
  const baseUrl = env.TUSHARE_BASE_URL || defaultBaseUrl;
  const token = env.TUSHARE_TOKEN || "";
  const payload = {
    api_name: probe.apiName,
    token,
    params: probe.params,
    fields: probe.fields,
  };

  try {
    const response = await transport(baseUrl, payload, {
      timeoutMs: Number(env.TUSHARE_TIMEOUT_MS || 8000),
    });
    const classification = classifyTushareResponse(response);
    return {
      id: probe.id,
      label: probe.label,
      apiName: probe.apiName,
      sample: probe.sample,
      valuationUse: probe.valuationUse,
      status: classification.status,
      errorCode: classification.errorCode,
      rowCount: classification.rowCount,
      message: classification.message,
      providerMessage: sanitizeMessage(response.msg || "", token),
    };
  } catch (error) {
    return {
      id: probe.id,
      label: probe.label,
      apiName: probe.apiName,
      sample: probe.sample,
      valuationUse: probe.valuationUse,
      status: "request_failed",
      errorCode: "provider_unavailable",
      rowCount: 0,
      message: error && error.message ? error.message : "Tushare request failed.",
      providerMessage: "",
    };
  }
}

function buildRecommendation(results = []) {
  const accessible = results.filter((result) => result.status === "ok" || result.status === "accessible_empty_sample");
  if (accessible.some((result) => result.id === "fund_nav")) {
    return "Use fund_nav as the first real provider path for fund NAV valuation.";
  }
  if (accessible.some((result) => result.id === "fund_daily")) {
    return "Use fund_daily first and treat ETF codes as the first real valuation path.";
  }
  return "No tested valuation endpoint is available yet. Keep mock/local fallback and request provider permission or choose another provider.";
}

async function runProbe(options = {}) {
  const env = options.env || process.env;
  const token = env.TUSHARE_TOKEN || "";
  if (!token) {
    return {
      ok: false,
      errorCode: "missing_token",
      message: "TUSHARE_TOKEN is not configured in this shell.",
      baseUrl: env.TUSHARE_BASE_URL || defaultBaseUrl,
      hasToken: false,
      results: [],
      recommendation: "Set TUSHARE_TOKEN in the current shell and run the probe again.",
    };
  }

  const probeCases = options.cases || defaultProbeCases;
  const results = [];
  for (const probe of probeCases) {
    results.push(await probeCase(probe, options));
  }

  return {
    ok: true,
    baseUrl: env.TUSHARE_BASE_URL || defaultBaseUrl,
    hasToken: true,
    results,
    usableCount: results.filter((result) => result.status === "ok" || result.status === "accessible_empty_sample").length,
    recommendation: buildRecommendation(results),
  };
}

function printReport(report) {
  console.log("Tushare access probe");
  console.log(`baseUrl: ${report.baseUrl}`);
  console.log(`token: ${report.hasToken ? "configured (hidden)" : "missing"}`);
  console.log("");

  if (!report.ok) {
    console.log(`[${report.errorCode}] ${report.message}`);
    console.log(report.recommendation);
    return;
  }

  for (const result of report.results) {
    console.log(`[${result.status}] ${result.apiName} (${result.label})`);
    console.log(`  sample: ${result.sample}`);
    console.log(`  use: ${result.valuationUse}`);
    console.log(`  rows: ${result.rowCount}`);
    console.log(`  message: ${result.message}`);
    if (result.providerMessage) {
      console.log(`  providerMessage: ${result.providerMessage}`);
    }
    console.log("");
  }

  console.log(`usableCount: ${report.usableCount}`);
  console.log(`next: ${report.recommendation}`);
}

if (require.main === module) {
  runProbe()
    .then((report) => {
      printReport(report);
      if (!report.ok) {
        process.exitCode = 1;
      }
    })
    .catch((error) => {
      console.error(error && error.message ? error.message : error);
      process.exitCode = 1;
    });
}

module.exports = {
  buildRecommendation,
  classifyTushareResponse,
  defaultProbeCases,
  probeCase,
  runProbe,
  sanitizeMessage,
};
