const assert = require("node:assert/strict");
const test = require("node:test");

const {
  classifyTushareResponse,
  runProbe,
  sanitizeMessage,
} = require("../scripts/probe-tushare-access");

test("Tushare access probe classifies permission errors", () => {
  const result = classifyTushareResponse({
    code: -2001,
    msg: "抱歉，您没有接口(fund_nav)访问权限。",
  });

  assert.equal(result.status, "permission_denied");
  assert.equal(result.errorCode, "provider_permission_denied");
});

test("Tushare access probe marks code zero as accessible without requiring rows", () => {
  const result = classifyTushareResponse({
    code: 0,
    msg: "",
    data: {
      fields: ["ts_code"],
      items: [],
    },
  });

  assert.equal(result.status, "accessible_empty_sample");
  assert.equal(result.errorCode, null);
});

test("Tushare access probe does not expose token in report", async () => {
  const tokenFixture = "token-fixture-value";
  const report = await runProbe({
    env: { TUSHARE_TOKEN: tokenFixture },
    cases: [
      {
        id: "fund_nav",
        label: "Open-end fund NAV",
        apiName: "fund_nav",
        sample: "000001.OF",
        params: { ts_code: "000001.OF" },
        fields: "ts_code,end_date,unit_nav",
        valuationUse: "fund daily NAV valuation",
      },
    ],
    transport: async (url, payload) => {
      assert.equal(payload.token, tokenFixture);
      return {
        code: -2001,
        msg: `no access for ${tokenFixture}`,
      };
    },
  });

  assert.equal(report.ok, true);
  assert.equal(report.results[0].status, "permission_denied");
  assert.equal(JSON.stringify(report).includes(tokenFixture), false);
});

test("Tushare access probe reports missing token without running network transport", async () => {
  let called = false;
  const report = await runProbe({
    env: {},
    transport: async () => {
      called = true;
      return { code: 0, data: { items: [] } };
    },
  });

  assert.equal(report.ok, false);
  assert.equal(report.errorCode, "missing_token");
  assert.equal(called, false);
});

test("sanitizeMessage masks token fragments exactly", () => {
  assert.equal(sanitizeMessage("token abc failed", "abc"), "token [hidden-token] failed");
});
