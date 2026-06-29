const assert = require("node:assert/strict");
const test = require("node:test");

const mockProvider = require("../quote-service/providers/mock-provider");
const { getProvider } = require("../quote-service/providers/provider-registry");
const hsLightProvider = require("../quote-service/providers/hs-light-provider");
const realProvider = require("../quote-service/providers/real-provider-placeholder");
const tushareProvider = require("../quote-service/providers/tushare-provider");

test("mock provider returns the standard quote shape", async () => {
  const quote = await mockProvider.getQuote(
    {
      type: "fund",
      code: "000300",
      name: "test fund",
      previousPrice: 1,
    },
    { now: "2026-06-13T10:00:00.000Z" },
  );

  assert.equal(quote.code, "000300");
  assert.equal(quote.assetType, "fund");
  assert.equal(quote.status, "ok");
  assert.equal(typeof quote.price, "number");
  assert.ok(quote.source);
  assert.ok(quote.priceTime);
});

test("real provider placeholder reports configuration without exposing secrets", async () => {
  const env = {
    QUOTE_API_BASE_URL: "https://provider.example.com",
    QUOTE_API_KEY: "redacted-provider-value",
    QUOTE_API_PROVIDER: "example-provider",
  };
  const config = realProvider.getConfig(env);
  const quote = await realProvider.getQuote(
    {
      type: "fund",
      code: "000300",
      previousPrice: 1.2,
    },
    {
      env,
      now: "2026-06-13T10:00:00.000Z",
    },
  );

  assert.equal(config.baseUrl, "https://provider.example.com");
  assert.equal(config.hasApiKey, true);
  assert.equal(JSON.stringify(config).includes("redacted-provider-value"), false);
  assert.equal(JSON.stringify(quote).includes("redacted-provider-value"), false);
  assert.equal(quote.status, "error");
  assert.equal(quote.price, 1.2);
});

test("provider registry keeps mock default and selects Tushare explicitly", () => {
  assert.equal(getProvider({ env: {} }).name, "mockProvider");
  assert.equal(getProvider({ env: { QUOTE_PROVIDER_MODE: "local" } }).name, "mockProvider");
  assert.equal(getProvider({ env: { QUOTE_PROVIDER_MODE: "tushare" } }).name, "tushareProvider");
  assert.equal(getProvider({ env: { QUOTE_PROVIDER_MODE: "hs-light" } }).name, "hsLightProvider");
});

test("HS LIGHT provider requires backend authorization without exposing secrets", async () => {
  const quote = await hsLightProvider.getQuote(
    {
      type: "fund",
      code: "112002",
      name: "test fund",
      previousPrice: 2.01,
    },
    {
      env: {},
      now: "2026-06-14T10:00:00.000Z",
    },
  );

  assert.equal(quote.status, "error");
  assert.equal(quote.price, 2.01);
  assert.equal(quote.errorCode, "provider_auth_error");
  assert.equal(quote.message, "数据源认证失败，已保留上次估值");
});

test("HS LIGHT provider maps net_value fixture into a standard quote", async () => {
  let capturedPayload = null;
  const quote = await hsLightProvider.getQuote(
    {
      type: "fund",
      code: "112002",
      name: "sample fund",
      previousPrice: 2.01,
    },
    {
      env: {
        HS_LIGHT_AUTHORIZATION: "redacted-hs-light-authorization",
        HS_LIGHT_TRADING_DATE: "2015-12-31",
      },
      now: "2026-06-14T10:00:00.000Z",
      transport: async (url, payload, options) => {
        capturedPayload = { url, payload, options };
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
    },
  );

  assert.equal(capturedPayload.url, "https://sandbox.hscloud.cn/gildatafund/v1/performance/net_value");
  assert.equal(capturedPayload.payload.en_prod_code, "112002.OF");
  assert.equal(capturedPayload.payload.trading_date, "2015-12-31");
  assert.equal(capturedPayload.options.authorization, "redacted-hs-light-authorization");
  assert.equal(quote.status, "ok");
  assert.equal(quote.code, "112002");
  assert.equal(quote.assetType, "fund");
  assert.equal(quote.price, 2.072);
  assert.equal(quote.priceTime, "2015-12-31T15:00:00+08:00");
  assert.equal(quote.source, "恒生 LIGHT 云 performance/net_value");
  assert.equal(JSON.stringify(quote).includes("redacted-hs-light-authorization"), false);
});

test("HS LIGHT provider normalizes permission errors into a user-safe quote", async () => {
  const quote = await hsLightProvider.getQuote(
    {
      type: "fund",
      code: "112002.OF",
      previousPrice: 2.01,
    },
    {
      env: {
        HS_LIGHT_AUTHORIZATION: "redacted-hs-light-authorization",
      },
      now: "2026-06-14T10:00:00.000Z",
      transport: async () => ({
        error_no: "403",
        error_info: "服务未开通或无权限",
      }),
    },
  );

  assert.equal(quote.status, "error");
  assert.equal(quote.errorCode, "provider_permission_denied");
  assert.equal(quote.message, "数据源权限不足，已保留上次估值");
  assert.equal(quote.price, 2.01);
});

test("HS LIGHT provider keeps previous price when fixture has no rows", async () => {
  const quote = await hsLightProvider.getQuote(
    {
      type: "fund",
      code: "112002.OF",
      previousPrice: 2.01,
    },
    {
      env: {
        HS_LIGHT_AUTHORIZATION: "redacted-hs-light-authorization",
      },
      now: "2026-06-14T10:00:00.000Z",
      transport: async () => ({
        error_no: "0",
        error_info: "",
        data: [],
      }),
    },
  );

  assert.equal(quote.status, "error");
  assert.equal(quote.price, 2.01);
});

test("HS LIGHT provider derives previous business day for required trading date", () => {
  assert.equal(hsLightProvider.previousBusinessDate(new Date("2026-06-14T10:00:00+08:00")), "2026-06-12");
  assert.equal(hsLightProvider.normalizeHsCode({ code: "112002" }), "112002.OF");
  assert.equal(hsLightProvider.normalizeHsCode({ code: "510300.SH" }), "510300.SH");
});

test("Tushare provider requires backend token without exposing secrets", async () => {
  const quote = await tushareProvider.getQuote(
    {
      type: "fund",
      code: "000300",
      name: "test fund",
      previousPrice: 1.2,
    },
    {
      env: {},
      now: "2026-06-13T10:00:00.000Z",
    },
  );

  assert.equal(quote.status, "error");
  assert.equal(quote.price, 1.2);
  assert.equal(quote.errorCode, "provider_auth_error");
  assert.equal(quote.message, "数据源认证失败，已保留上次估值");
  assert.equal(JSON.stringify(quote).includes("redacted-tushare-token"), false);
});

test("Tushare provider normalizes permission errors into a user-safe quote", async () => {
  const quote = await tushareProvider.getQuote(
    {
      type: "fund",
      code: "000300",
      name: "沪深300指数基金",
      previousPrice: 1.2,
    },
    {
      env: {
        TUSHARE_TOKEN: "redacted-tushare-token",
      },
      now: "2026-06-13T10:00:00.000Z",
      transport: async () => ({
        code: -2001,
        msg: "抱歉，您没有接口(fund_nav)访问权限，权限的具体详情访问：https://tushare.pro/document/1?doc_id=108。",
      }),
    },
  );

  assert.equal(quote.status, "error");
  assert.equal(quote.errorCode, "provider_permission_denied");
  assert.equal(quote.message, "数据源权限不足，已保留上次估值");
  assert.equal(quote.price, 1.2);
  assert.equal(JSON.stringify(quote).includes("redacted-tushare-token"), false);
  assert.doesNotMatch(quote.message, /tushare\.pro/);
});

test("Tushare provider maps fund_nav fixture into a standard quote", async () => {
  let capturedPayload = null;
  const quote = await tushareProvider.getQuote(
    {
      type: "fund",
      code: "000300",
      name: "沪深300指数基金",
      previousPrice: 1.2,
    },
    {
      env: {
        TUSHARE_TOKEN: "redacted-tushare-token",
      },
      now: "2026-06-13T10:00:00.000Z",
      transport: async (url, payload) => {
        capturedPayload = { url, payload };
        return {
          code: 0,
          msg: "",
          data: {
            fields: ["ts_code", "end_date", "unit_nav", "accum_nav"],
            items: [["000300.OF", "20260612", "1.2368", "1.5000"]],
          },
        };
      },
    },
  );

  assert.equal(capturedPayload.payload.api_name, "fund_nav");
  assert.equal(capturedPayload.payload.params.ts_code, "000300.OF");
  assert.equal(capturedPayload.payload.token, "redacted-tushare-token");
  assert.equal(quote.status, "ok");
  assert.equal(quote.assetType, "fund");
  assert.equal(quote.price, 1.2368);
  assert.equal(quote.priceTime, "2026-06-12T15:00:00+08:00");
  assert.equal(quote.source, "Tushare Pro fund_nav");
  assert.equal(JSON.stringify(quote).includes("redacted-tushare-token"), false);
});

test("Tushare provider maps ETF fund_daily fixture into a standard quote", async () => {
  const quote = await tushareProvider.getQuote(
    {
      type: "etf",
      code: "510300.SH",
      name: "沪深300ETF",
      previousPrice: 4.1,
    },
    {
      env: {
        TUSHARE_TOKEN: "redacted-tushare-token",
      },
      now: "2026-06-13T10:00:00.000Z",
      transport: async (url, payload) => {
        assert.equal(payload.api_name, "fund_daily");
        assert.equal(payload.params.ts_code, "510300.SH");
        return {
          code: 0,
          msg: "",
          data: {
            fields: ["ts_code", "trade_date", "close"],
            items: [["510300.SH", "20260612", "4.268"]],
          },
        };
      },
    },
  );

  assert.equal(quote.status, "ok");
  assert.equal(quote.assetType, "etf");
  assert.equal(quote.price, 4.268);
  assert.equal(quote.source, "Tushare Pro fund_daily");
});

test("Tushare provider keeps previous price when fixture has no rows", async () => {
  const quote = await tushareProvider.getQuote(
    {
      type: "fund",
      code: "000300",
      previousPrice: 1.2,
    },
    {
      env: {
        TUSHARE_TOKEN: "redacted-tushare-token",
      },
      now: "2026-06-13T10:00:00.000Z",
      transport: async () => ({
        code: 0,
        msg: "",
        data: {
          fields: ["ts_code", "end_date", "unit_nav"],
          items: [],
        },
      }),
    },
  );

  assert.equal(quote.status, "error");
  assert.equal(quote.price, 1.2);
});
