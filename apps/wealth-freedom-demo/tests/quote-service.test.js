const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createServer } = require("../quote-service/server");
const { getDefaultState } = require("../wechat-miniapp/utils/demo-data");

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve(server.address().port);
    });
  });
}

function requestJson(port, requestPath, options = {}) {
  return new Promise((resolve, reject) => {
    const body = options.body ? JSON.stringify(options.body) : "";
    const request = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: requestPath,
        method: options.method || "GET",
        headers: body
          ? {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(body),
            }
          : undefined,
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode,
            body: JSON.parse(body),
          });
        });
      },
    );
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

test("quote-service returns a standard single quote", async () => {
  const server = createServer();
  const port = await listen(server);
  try {
    const response = await requestJson(port, "/api/quotes?type=fund&code=000300");

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.status, "ok");
    assert.equal(response.body.quote.code, "000300");
    assert.equal(response.body.quote.assetType, "fund");
    assert.equal(typeof response.body.quote.price, "number");
    assert.equal(response.body.quote.status, "ok");
    assert.ok(response.body.quote.source);
    assert.ok(response.body.quote.priceTime);
  } finally {
    server.close();
  }
});

test("quote-service returns useful errors for invalid requests", async () => {
  const server = createServer();
  const port = await listen(server);
  try {
    const missingCode = await requestJson(port, "/api/quotes?type=fund");
    const unknownCode = await requestJson(port, "/api/quotes?type=fund&code=NOPE");

    assert.equal(missingCode.statusCode, 400);
    assert.equal(missingCode.body.error.code, "missing_code");
    assert.equal(unknownCode.statusCode, 404);
    assert.equal(unknownCode.body.error.code, "quote_not_found");
  } finally {
    server.close();
  }
});

test("quote-service supports batch quotes without real network dependencies", async () => {
  const server = createServer();
  const port = await listen(server);
  try {
    const response = await requestJson(port, "/api/quotes/batch?items=fund:000300,commodity:gold-demo");

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.status, "ok");
    assert.equal(response.body.quotes.length, 2);
    assert.equal(response.body.errors.length, 0);
  } finally {
    server.close();
  }
});

test("quote-service can serve quotes through an injected backend provider", async () => {
  const provider = {
    async getQuote(request) {
      return {
        code: request.code,
        name: "provider fund",
        assetType: request.type,
        price: 1.4567,
        priceTime: "2026-06-12T15:00:00+08:00",
        source: "fixture provider",
        status: "ok",
        message: "fixture quote",
      };
    },
  };
  const server = createServer({ provider });
  const port = await listen(server);
  try {
    const response = await requestJson(port, "/api/quotes?type=fund&code=000300");

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.status, "ok");
    assert.equal(response.body.quote.price, 1.4567);
    assert.equal(response.body.quote.source, "fixture provider");
  } finally {
    server.close();
  }
});

test("quote-service returns provider permission errors as business errors", async () => {
  const provider = {
    async getQuote(request) {
      return {
        code: request.code,
        name: "provider fund",
        assetType: request.type,
        price: 1.2,
        priceTime: "2026-06-13T10:00:00.000Z",
        source: "fixture provider",
        status: "error",
        errorCode: "provider_permission_denied",
        message: "数据源权限不足，已保留上次估值",
      };
    },
  };
  const server = createServer({ provider });
  const port = await listen(server);
  try {
    const response = await requestJson(port, "/api/quotes?type=fund&code=000300");

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.status, "error");
    assert.equal(response.body.error.code, "provider_permission_denied");
    assert.equal(response.body.error.message, "数据源权限不足，已保留上次估值");
    assert.equal(response.body.quote.price, 1.2);
  } finally {
    server.close();
  }
});

test("quote-service can serve HS LIGHT provider quotes through provider mode", async () => {
  const server = createServer({
    env: {
      QUOTE_PROVIDER_MODE: "hs-light",
      HS_LIGHT_AUTHORIZATION: "redacted-hs-light-authorization",
      HS_LIGHT_TRADING_DATE: "2015-12-31",
    },
    transport: async (url, payload, options) => {
      assert.equal(url, "https://sandbox.hscloud.cn/gildatafund/v1/performance/net_value");
      assert.equal(payload.en_prod_code, "112002.OF");
      assert.equal(payload.trading_date, "2015-12-31");
      assert.equal(options.authorization, "redacted-hs-light-authorization");
      return {
        data: [
          {
            en_prod_code: "112002.OF",
            unit_nv: "2.0720",
            nv_daily_growth_rate: "-1.7544",
            trading_date: "2015-12-31",
            prod_code: "112002.OF",
          },
        ],
        error_no: "0",
        error_info: "",
      };
    },
  });
  const port = await listen(server);
  try {
    const response = await requestJson(port, "/api/quotes?type=fund&code=112002");

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.status, "ok");
    assert.equal(response.body.quote.price, 2.072);
    assert.equal(response.body.quote.priceTime, "2015-12-31T15:00:00+08:00");
    assert.equal(response.body.quote.source, "恒生 LIGHT 云 performance/net_value");
    assert.equal(JSON.stringify(response.body).includes("redacted-hs-light-authorization"), false);
  } finally {
    server.close();
  }
});

test("quote-service previews valuation without persisting snapshots", async () => {
  const runtimeDir = fs.mkdtempSync(path.join(os.tmpdir(), "quote-service-preview-"));
  const server = createServer({ runtimeDir });
  const port = await listen(server);
  try {
    const response = await requestJson(port, "/api/valuations/preview", {
      method: "POST",
      body: {
        holdings: getDefaultState().holdings,
        now: "2026-06-13T10:00:00.000Z",
      },
    });
    const persisted = await requestJson(port, "/api/valuations/snapshots?userId=demo");

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.status, "ok");
    assert.equal(response.body.valuation.snapshot.snapshotDate, "2026-06-13");
    assert.equal(response.body.valuation.holdings.length, getDefaultState().holdings.length);
    assert.equal(persisted.body.snapshots.length, 0);
  } finally {
    server.close();
    fs.rmSync(runtimeDir, { recursive: true, force: true });
  }
});

test("quote-service valuation preview uses injected provider without persisting snapshots", async () => {
  const runtimeDir = fs.mkdtempSync(path.join(os.tmpdir(), "quote-service-provider-preview-"));
  const provider = {
    async getQuote(request) {
      if (request.type === "cash") {
        return {
          code: request.code || "",
          name: request.name || "",
          assetType: "cash",
          price: request.previousPrice,
          priceTime: "2026-06-13T10:00:00.000Z",
          source: "manual",
          status: "skipped",
          message: "cash skipped",
        };
      }
      return {
        code: request.code,
        name: request.name || "",
        assetType: request.type,
        price: 1.5,
        priceTime: "2026-06-12T15:00:00+08:00",
        source: "fixture provider",
        status: "ok",
        message: "fixture valuation",
      };
    },
  };
  const server = createServer({ runtimeDir, provider });
  const port = await listen(server);
  try {
    const state = getDefaultState();
    const response = await requestJson(port, "/api/valuations/preview", {
      method: "POST",
      body: {
        holdings: state.holdings,
        now: "2026-06-13T10:00:00.000Z",
      },
    });
    const persisted = await requestJson(port, "/api/valuations/snapshots?userId=demo");
    const refreshedFund = response.body.valuation.holdings.find((holding) => holding.id === "stock-fund-sample");

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.status, "ok");
    assert.equal(refreshedFund.currentPrice, 1.5);
    assert.equal(refreshedFund.source, "fixture provider");
    assert.equal(persisted.body.snapshots.length, 0);
  } finally {
    server.close();
    fs.rmSync(runtimeDir, { recursive: true, force: true });
  }
});

test("quote-service valuation preview preserves old prices on provider permission errors", async () => {
  const runtimeDir = fs.mkdtempSync(path.join(os.tmpdir(), "quote-service-provider-denied-"));
  const provider = {
    async getQuote(request) {
      return {
        code: request.code,
        name: request.name || "",
        assetType: request.type,
        price: request.previousPrice,
        priceTime: "2026-06-13T10:00:00.000Z",
        source: "fixture provider",
        status: "error",
        errorCode: "provider_permission_denied",
        message: "数据源权限不足，已保留上次估值",
      };
    },
  };
  const server = createServer({ runtimeDir, provider });
  const port = await listen(server);
  try {
    const state = getDefaultState();
    const previousFund = state.holdings.find((holding) => holding.id === "stock-fund-sample");
    const response = await requestJson(port, "/api/valuations/preview", {
      method: "POST",
      body: {
        holdings: state.holdings,
        now: "2026-06-13T10:00:00.000Z",
      },
    });
    const refreshedFund = response.body.valuation.holdings.find((holding) => holding.id === "stock-fund-sample");

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.status, "ok");
    assert.equal(refreshedFund.currentPrice, previousFund.currentPrice);
    assert.equal(refreshedFund.currentValue, previousFund.currentValue);
    assert.equal(refreshedFund.quoteStatus, "error");
    assert.equal(refreshedFund.quoteMessage, "数据源权限不足，已保留上次估值");
  } finally {
    server.close();
    fs.rmSync(runtimeDir, { recursive: true, force: true });
  }
});

test("quote-service stores and returns user valuation snapshots", async () => {
  const runtimeDir = fs.mkdtempSync(path.join(os.tmpdir(), "quote-service-snapshot-"));
  const server = createServer({ runtimeDir });
  const port = await listen(server);
  try {
    const response = await requestJson(port, "/api/valuations/snapshot", {
      method: "POST",
      body: {
        userId: "demo-user",
        holdings: getDefaultState().holdings,
        now: "2026-06-13T10:00:00.000Z",
      },
    });
    const snapshots = await requestJson(port, "/api/valuations/snapshots?userId=demo-user");

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.status, "ok");
    assert.equal(response.body.userId, "demo-user");
    assert.equal(response.body.snapshots.length, 1);
    assert.equal(snapshots.statusCode, 200);
    assert.equal(snapshots.body.snapshots.length, 1);
    assert.equal(snapshots.body.snapshots[0].snapshotDate, "2026-06-13");
  } finally {
    server.close();
    fs.rmSync(runtimeDir, { recursive: true, force: true });
  }
});
