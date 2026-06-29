const assert = require("node:assert/strict");
const test = require("node:test");

const quoteClient = require("../wechat-miniapp/utils/quote-client");

const baseHoldings = [
  {
    id: "cash-1",
    type: "cash",
    name: "现金账户",
    quantity: 1,
    currentPrice: 1000,
    currentValue: 1000,
    costPrice: 1000,
    costAmount: 1000,
    updatedAt: "手动录入",
    source: "manual",
  },
  {
    id: "fund-1",
    type: "stock",
    instrument: "fund",
    name: "测试基金",
    code: "000300",
    quantity: 100,
    currentPrice: 10,
    currentValue: 1000,
    costPrice: 9,
    costAmount: 900,
    updatedAt: "手动录入",
    source: "manual",
  },
];

test("quote client refreshes valuation fields and bypasses cash", () => {
  const result = quoteClient.refreshHoldingsWithQuotes(baseHoldings, {
    adapter: "local",
    seed: 3,
    now: "2026-06-12T12:00:00.000Z",
  });

  const cash = result.holdings[0];
  const fund = result.holdings[1];

  assert.equal(cash.currentPrice, 1000);
  assert.equal(cash.currentValue, 1000);
  assert.equal(cash.quoteStatus, "skipped");
  assert.equal(fund.quoteStatus, "ok");
  assert.notEqual(fund.currentPrice, 10);
  assert.equal(fund.currentValue, fund.quantity * fund.currentPrice);
  assert.equal(fund.todayPnl, fund.currentValue - 1000);
  assert.equal(fund.updatedAt, "2026-06-12T12:00:00.000Z");
  assert.equal(fund.source, "local mock quote adapter");
  assert.equal(result.refreshStatus.okCount, 1);
  assert.equal(result.refreshStatus.skippedCount, 1);
});

test("quote client preserves previous price when quote fails", () => {
  const result = quoteClient.refreshHoldingsWithQuotes([baseHoldings[1]], {
    adapter() {
      return {
        code: "000300",
        assetType: "fund",
        price: 0,
        priceTime: "2026-06-12T12:00:00.000Z",
        source: "test adapter",
        status: "error",
        message: "provider unavailable",
      };
    },
  });
  const [fund] = result.holdings;

  assert.equal(fund.currentPrice, 10);
  assert.equal(fund.currentValue, 1000);
  assert.equal(fund.todayPnl, 0);
  assert.equal(fund.source, "manual");
  assert.equal(fund.updatedAt, "手动录入");
  assert.equal(fund.quoteStatus, "error");
  assert.equal(fund.quoteMessage, "provider unavailable");
});

test("quote client exposes backend adapter without embedding provider secrets", async () => {
  global.wx = {
    request(options) {
      assert.match(options.url, /\/api\/quotes\?type=fund&code=000300$/);
      assert.doesNotMatch(options.url, /key=|token=|secret=/i);
      options.success({
        data: {
          status: "ok",
          quote: {
            code: "000300",
            name: "测试基金",
            assetType: "fund",
            price: 11,
            priceTime: "2026-06-12T12:00:00.000Z",
            source: "quote-service",
            status: "ok",
            message: "service quote",
          },
        },
      });
    },
  };

  try {
    const result = await quoteClient.refreshHoldingsWithQuotes([baseHoldings[1]], {
      adapter: "backend",
      baseUrl: "https://quotes.example.com",
    });

    assert.equal(result.holdings[0].currentPrice, 11);
    assert.equal(result.holdings[0].source, "quote-service");
  } finally {
    delete global.wx;
  }
});

test("quote client backend adapter keeps previous price when request fails", async () => {
  global.wx = {
    request(options) {
      assert.match(options.url, /\/api\/quotes\?type=fund&code=000300$/);
      options.fail();
    },
  };

  try {
    const result = await quoteClient.refreshHoldingsWithQuotes([baseHoldings[1]], {
      adapter: "backend",
      baseUrl: "https://quotes.example.com",
    });
    const [fund] = result.holdings;

    assert.equal(fund.currentPrice, 10);
    assert.equal(fund.currentValue, 1000);
    assert.equal(fund.quoteStatus, "error");
  } finally {
    delete global.wx;
  }
});

test("quote client backend adapter keeps previous price on provider permission errors", async () => {
  global.wx = {
    request(options) {
      assert.match(options.url, /\/api\/quotes\?type=fund&code=000300$/);
      options.success({
        data: {
          status: "error",
          quote: {
            code: "000300",
            name: "测试基金",
            assetType: "fund",
            price: 10,
            priceTime: "2026-06-13T10:00:00.000Z",
            source: "Tushare Pro fund_nav",
            status: "error",
            errorCode: "provider_permission_denied",
            message: "数据源权限不足，已保留上次估值",
          },
          error: {
            code: "provider_permission_denied",
            message: "数据源权限不足，已保留上次估值",
          },
        },
      });
    },
  };

  try {
    const result = await quoteClient.refreshHoldingsWithQuotes([baseHoldings[1]], {
      adapter: "backend",
      baseUrl: "https://quotes.example.com",
    });
    const [fund] = result.holdings;

    assert.equal(fund.currentPrice, 10);
    assert.equal(fund.currentValue, 1000);
    assert.equal(fund.quoteStatus, "error");
    assert.equal(fund.quoteMessage, "数据源权限不足，已保留上次估值");
  } finally {
    delete global.wx;
  }
});
