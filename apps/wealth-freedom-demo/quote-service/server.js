const http = require("node:http");
const { URL } = require("node:url");
const { findQuote } = require("./mock-quotes");
const { getProvider, normalizeMode } = require("./providers/provider-registry");
const { buildValuationPreview } = require("./valuation-engine");
const { createValuationStore } = require("./valuation-store");

const defaultPort = Number(process.env.QUOTE_SERVICE_PORT || 8010);

function writeJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(JSON.stringify(body));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });
    request.on("error", reject);
  });
}

function errorBody(result) {
  return {
    status: "error",
    error: {
      code: result.errorCode,
      message: result.message,
    },
  };
}

function shouldUseProvider(options = {}) {
  if (options.provider) return true;
  const env = options.env || process.env;
  const mode = normalizeMode(options.providerMode || env.QUOTE_PROVIDER_MODE);
  return mode !== "mock" && mode !== "local";
}

function getProviderOptions(options = {}) {
  return {
    env: options.env || process.env,
    now: options.now,
    transport: options.transport,
  };
}

function writeQuoteError(response, quote) {
  writeJson(response, 200, {
    status: "error",
    quote: quote || null,
    error: {
      code: (quote && quote.errorCode) || "quote_not_found",
      message: quote && quote.message ? quote.message : "quote not available",
    },
  });
}

async function handleSingleQuote(requestUrl, response, options = {}) {
  const type = requestUrl.searchParams.get("type");
  const code = requestUrl.searchParams.get("code");

  if (shouldUseProvider(options)) {
    if (!type) {
      writeJson(response, 400, {
        status: "error",
        error: {
          code: "missing_type",
          message: "type is required",
        },
      });
      return;
    }
    if (!code) {
      writeJson(response, 400, {
        status: "error",
        error: {
          code: "missing_code",
          message: "code is required",
        },
      });
      return;
    }

    const provider = getProvider(options);
    const quote = await provider.getQuote(
      {
        type,
        code,
        previousPrice: Number(requestUrl.searchParams.get("previousPrice") || 0),
      },
      getProviderOptions(options),
    );

    if (!quote || quote.status !== "ok") {
      writeQuoteError(response, quote);
      return;
    }

    writeJson(response, 200, {
      status: "ok",
      quote,
    });
    return;
  }

  const result = findQuote(type, code);

  if (!result.ok) {
    writeJson(response, result.httpStatus, errorBody(result));
    return;
  }

  writeJson(response, 200, {
    status: "ok",
    quote: result.quote,
  });
}

function parseBatchItems(requestUrl) {
  const rawItems = requestUrl.searchParams.get("items");
  if (rawItems) {
    return rawItems
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const parts = item.split(":");
        return { type: parts[0], code: parts.slice(1).join(":") };
      });
  }

  const type = requestUrl.searchParams.get("type");
  const codes = requestUrl.searchParams.getAll("code");
  return codes.map((code) => ({ type, code }));
}

async function handleBatchQuotes(requestUrl, response, options = {}) {
  const items = parseBatchItems(requestUrl);
  if (!items.length) {
    writeJson(response, 400, {
      status: "error",
      error: {
        code: "missing_items",
        message: "items or code is required",
      },
    });
    return;
  }

  if (shouldUseProvider(options)) {
    const provider = getProvider(options);
    const results = await Promise.all(
      items.map(async (item) => {
        const quote = await provider.getQuote(
          {
            type: item.type,
            code: item.code,
          },
          getProviderOptions(options),
        );
        return {
          item,
          quote,
        };
      }),
    );

    const quotes = results.filter((result) => result.quote && result.quote.status === "ok").map((result) => result.quote);
    const errors = results
      .filter((result) => !result.quote || result.quote.status !== "ok")
      .map((result) => ({
        type: result.item.type || "",
        code: result.item.code || "",
        status: "error",
        error: {
          code: (result.quote && result.quote.errorCode) || "quote_not_found",
          message: result.quote && result.quote.message ? result.quote.message : "quote not available",
        },
      }));

    writeJson(response, errors.length ? 207 : 200, {
      status: errors.length ? "partial" : "ok",
      quotes,
      errors,
    });
    return;
  }

  const quotes = [];
  const errors = [];
  items.forEach((item) => {
    const result = findQuote(item.type, item.code);
    if (result.ok) {
      quotes.push(result.quote);
    } else {
      errors.push({
        type: item.type || "",
        code: item.code || "",
        status: "error",
        error: {
          code: result.errorCode,
          message: result.message,
        },
      });
    }
  });

  writeJson(response, errors.length ? 207 : 200, {
    status: errors.length ? "partial" : "ok",
    quotes,
    errors,
  });
}

async function handleValuationPreview(request, response, options) {
  const body = await readJsonBody(request);
  if (!Array.isArray(body.holdings)) {
    writeJson(response, 400, {
      status: "error",
      error: {
        code: "missing_holdings",
        message: "holdings array is required",
      },
    });
    return;
  }

  const valuation = await buildValuationPreview(body, {
    ...options,
    provider: getProvider(options),
  });
  writeJson(response, 200, {
    status: "ok",
    valuation,
  });
}

async function handleValuationSnapshot(request, response, options) {
  const body = await readJsonBody(request);
  if (!Array.isArray(body.holdings)) {
    writeJson(response, 400, {
      status: "error",
      error: {
        code: "missing_holdings",
        message: "holdings array is required",
      },
    });
    return;
  }

  const userId = String(body.userId || "demo");
  const store = (options && options.store) || createValuationStore(options);
  const previousSnapshots = store.getSnapshots(userId);
  const provider = getProvider(options);
  const valuation = await buildValuationPreview(
    {
      ...body,
      snapshots: previousSnapshots,
    },
    {
      ...options,
      provider,
    },
  );
  const nextSnapshots = previousSnapshots.filter((snapshot) => snapshot.snapshotDate !== valuation.snapshot.snapshotDate);
  nextSnapshots.push(valuation.snapshot);
  nextSnapshots.sort((a, b) => String(a.snapshotDate || "").localeCompare(String(b.snapshotDate || "")));
  store.saveSnapshots(userId, nextSnapshots);

  writeJson(response, 200, {
    status: "ok",
    userId,
    valuation,
    snapshots: nextSnapshots,
  });
}

function handleValuationSnapshots(requestUrl, response, options) {
  const userId = String(requestUrl.searchParams.get("userId") || "demo");
  const store = (options && options.store) || createValuationStore(options);
  writeJson(response, 200, {
    status: "ok",
    userId,
    snapshots: store.getSnapshots(userId),
  });
}

async function handleRequest(request, response, options = {}) {
  const requestUrl = new URL(request.url, "http://127.0.0.1");

  if (request.method === "OPTIONS") {
    writeJson(response, 200, { status: "ok" });
    return;
  }

  if (requestUrl.pathname === "/api/valuations/preview" && request.method === "POST") {
    await handleValuationPreview(request, response, options);
    return;
  }

  if (requestUrl.pathname === "/api/valuations/snapshot" && request.method === "POST") {
    await handleValuationSnapshot(request, response, options);
    return;
  }

  if (requestUrl.pathname === "/api/valuations/snapshots" && request.method === "GET") {
    handleValuationSnapshots(requestUrl, response, options);
    return;
  }

  if (request.method !== "GET") {
    writeJson(response, 405, {
      status: "error",
      error: {
        code: "method_not_allowed",
        message: "method is not supported for this endpoint",
      },
    });
    return;
  }

  if (requestUrl.pathname === "/api/quotes") {
    await handleSingleQuote(requestUrl, response, options);
    return;
  }

  if (requestUrl.pathname === "/api/quotes/batch") {
    await handleBatchQuotes(requestUrl, response, options);
    return;
  }

  writeJson(response, 404, {
    status: "error",
    error: {
      code: "not_found",
      message: "endpoint not found",
    },
  });
}

function createServer(options = {}) {
  return http.createServer((request, response) => {
    handleRequest(request, response, options).catch((error) => {
      writeJson(response, 400, {
        status: "error",
        error: {
          code: "bad_request",
          message: error && error.message ? error.message : "request failed",
        },
      });
    });
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(defaultPort, "127.0.0.1", () => {
    console.log(`quote-service listening on http://127.0.0.1:${defaultPort}`);
  });
}

module.exports = {
  createServer,
  handleRequest,
};
