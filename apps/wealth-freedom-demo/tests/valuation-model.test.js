const assert = require("node:assert/strict");
const test = require("node:test");

const { getDefaultState } = require("../wechat-miniapp/utils/demo-data.js");
const valuation = require("../wechat-miniapp/utils/valuation-model.js");

test("builds a daily valuation snapshot with traceable holding items", () => {
  const state = getDefaultState();
  const snapshot = valuation.buildValuationSnapshot(state.holdings, [], {
    now: "2026-06-13T10:00:00.000Z",
  });

  assert.equal(snapshot.snapshotDate, "2026-06-13");
  assert.equal(snapshot.itemCount, state.holdings.length);
  assert.equal(snapshot.totalValue, 332002);
  assert.equal(snapshot.cashValue, 120000);
  assert.equal(snapshot.investmentValue, 212002);
  assert.equal(snapshot.hasPrevious, false);
  assert.equal(snapshot.dailyChange, 0);
  assert.equal(snapshot.items.find((item) => item.assetType === "cash").quoteStatus, "skipped");
});

test("upserts same-day valuation snapshots instead of duplicating them", () => {
  const state = getDefaultState();
  const first = valuation.buildValuationSnapshot(state.holdings, [], {
    now: "2026-06-13T10:00:00.000Z",
  });
  const changedHoldings = state.holdings.map((holding) =>
    holding.id === "stock-fund-sample"
      ? { ...holding, currentPrice: 1.3, currentValue: 91000, quoteStatus: "ok", source: "test quote" }
      : holding,
  );
  const second = valuation.buildValuationSnapshot(changedHoldings, [first], {
    now: "2026-06-13T15:00:00.000Z",
  });
  const snapshots = valuation.upsertTodaySnapshot([first], second);

  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].totalValue, second.totalValue);
  assert.equal(snapshots[0].generatedAt, "2026-06-13T15:00:00.000Z");
});

test("compares with the previous daily snapshot when dates differ", () => {
  const state = getDefaultState();
  const first = valuation.buildValuationSnapshot(state.holdings, [], {
    now: "2026-06-12T10:00:00.000Z",
  });
  const nextHoldings = state.holdings.map((holding) =>
    holding.id === "commodity-gold-sample"
      ? { ...holding, currentPrice: 670, currentValue: 67000, quoteStatus: "ok", source: "test quote" }
      : holding,
  );
  const second = valuation.buildValuationSnapshot(nextHoldings, [first], {
    now: "2026-06-13T10:00:00.000Z",
  });
  const summary = valuation.getValuationSummary([first, second]);

  assert.equal(second.hasPrevious, true);
  assert.equal(second.previousSnapshotDate, "2026-06-12");
  assert.equal(second.dailyChange, 1000);
  assert.equal(summary.changeText, "+1,000 元");
  assert.match(summary.rateText, /%$/);
});

test("marks failed quotes without dropping existing valuation", () => {
  const state = getDefaultState();
  const failedHoldings = state.holdings.map((holding) =>
    holding.id === "stock-fund-sample"
      ? { ...holding, quoteStatus: "error", quoteMessage: "行情失败，保留原价格" }
      : holding,
  );
  const snapshot = valuation.buildValuationSnapshot(failedHoldings, [], {
    now: "2026-06-13T10:00:00.000Z",
  });

  assert.equal(snapshot.quoteStatus, "partial_error");
  assert.equal(snapshot.totalValue, 332002);
  assert.match(snapshot.quoteMessage, /保留/);
});
