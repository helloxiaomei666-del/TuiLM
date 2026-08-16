const assert = require("node:assert/strict");
const test = require("node:test");

const storage = require("../wechat-miniapp/utils/storage.js");
const demoData = require("../wechat-miniapp/utils/demo-data.js");
const { getOverviewModel } = require("../wechat-miniapp/utils/overview-model.js");
const canonicalAdapter = require("../wechat-miniapp/utils/retirement-index-adapter.js");
const canonicalFixture = require("./fixtures/retirement-index-v1.fixture.js");
const phase1Fixture = require("./fixtures/input-loop-phase1.fixture.js");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectedUnconfirmedCompletion() {
  return {
    profile: false,
    assets: false,
    incomeSources: false,
    protectionAccounts: false,
    dragItems: false,
  };
}

function completeSections(overrides = {}) {
  return {
    profile: true,
    assets: true,
    incomeSources: true,
    protectionAccounts: true,
    dragItems: true,
    ...overrides,
  };
}

const forbiddenCanonicalFields = [
  "monthlyEssentialExpense",
  "liquidCash",
  "investableAssets",
  "targetRetirementAssets",
];

function createWxStorage(seed = {}) {
  const records = new Map(
    Object.entries(seed).map(([key, value]) => [key, clone(value)]),
  );
  let writeCount = 0;
  return {
    wx: {
      getStorageSync(key) {
        return records.has(key) ? clone(records.get(key)) : undefined;
      },
      setStorageSync(key, value) {
        writeCount += 1;
        records.set(key, clone(value));
      },
      removeStorageSync(key) {
        records.delete(key);
      },
    },
    read(key) {
      return records.has(key) ? clone(records.get(key)) : undefined;
    },
    get writeCount() {
      return writeCount;
    },
  };
}

function withWxStorage(seed, run) {
  const previousWx = global.wx;
  const mock = createWxStorage(seed);
  global.wx = mock.wx;
  try {
    return run(mock);
  } finally {
    if (previousWx === undefined) delete global.wx;
    else global.wx = previousWx;
  }
}

function reloadStorageModule() {
  const modulePath = require.resolve("../wechat-miniapp/utils/storage.js");
  delete require.cache[modulePath];
  return require("../wechat-miniapp/utils/storage.js");
}

function assertNoCanonicalFields(state) {
  forbiddenCanonicalFields.forEach((key) => {
    assert.equal(Object.prototype.hasOwnProperty.call(state, key), false, `${key} must not persist`);
  });
}

test("standard state declares schema version 2", () => {
  const state = demoData.getDefaultState();

  assert.equal(state.schemaVersion, 2);
});

test("legacy state migration upgrades the schema without dropping valid data", () => {
  const migrated = storage.migrateState(clone(phase1Fixture.legacyState));

  assert.equal(migrated.schemaVersion, 2);
  assert.deepEqual(migrated.holdings, phase1Fixture.legacyState.holdings);
  assert.deepEqual(migrated.securityAccounts.pension, phase1Fixture.legacyState.securityAccounts.pension);
  assert.deepEqual(migrated.manualDrags, phase1Fixture.legacyState.manualDrags);
  assert.deepEqual(migrated.incomeStreams, []);
});

test("legacy migration defaults every input section to not provided", () => {
  const migrated = storage.migrateState(clone(phase1Fixture.legacyState));

  assert.deepEqual(migrated.inputCompletion, expectedUnconfirmedCompletion());
});

test("confirmed empty income sources are a complete answer rather than missing data", () => {
  const result = canonicalAdapter.getCompletenessStatus({
    ...clone(canonicalFixture.canonicalV1Input),
    incomeSources: [],
    inputCompletion: completeSections(),
  });

  assert.equal(result.status, "COMPLETE");
});

test("confirmed empty income sources differ from an unconfirmed income section", () => {
  const confirmedNone = canonicalAdapter.getCompletenessStatus({
    ...clone(canonicalFixture.canonicalV1Input),
    incomeSources: [],
    inputCompletion: completeSections(),
  });
  const notProvided = canonicalAdapter.getCompletenessStatus({
    ...clone(canonicalFixture.canonicalV1Input),
    incomeSources: [],
    inputCompletion: completeSections({ incomeSources: false }),
  });

  assert.notEqual(confirmedNone.status, notProvided.status);
});

test("confirmed empty protection accounts are a complete answer", () => {
  const result = canonicalAdapter.getCompletenessStatus({
    ...clone(canonicalFixture.canonicalV1Input),
    protectionAccounts: [],
    inputCompletion: completeSections(),
  });

  assert.equal(result.status, "COMPLETE");
});

test("confirmed empty drag items are a complete answer with zero future penalty", () => {
  const result = canonicalAdapter.getCompletenessStatus({
    ...clone(canonicalFixture.canonicalV1Input),
    dragItems: [],
    inputCompletion: completeSections(),
  });

  assert.equal(result.status, "COMPLETE");
});

test("demo state is explicit and does not confirm user input sections", () => {
  const state = demoData.getDefaultState();

  assert.equal(state.mode, "demo");
  assert.deepEqual(state.inputCompletion, expectedUnconfirmedCompletion());
});

test("clearing local data produces an empty user state", () => {
  storage.resetState();
  storage.clearState();
  const state = storage.loadState();

  assert.equal(state.mode, "user");
  assert.deepEqual(state.holdings, []);
  assert.deepEqual(state.securityAccounts, {});
  assert.deepEqual(state.incomeStreams, []);
  assert.deepEqual(state.manualDrags, []);
});

test("reset example is separate from clear and restores demo state", () => {
  storage.clearState();
  const state = storage.resetState();

  assert.equal(state.mode, "demo");
  assert.ok(state.holdings.length > 0);
  assert.ok(Object.keys(state.securityAccounts).length > 0);
  assert.deepEqual(state.inputCompletion, expectedUnconfirmedCompletion());
});

test("target monthly living cost maps to monthly essential expense before living cost", () => {
  const migrated = storage.migrateState(clone(phase1Fixture.legacyState));
  const overview = getOverviewModel(migrated);

  assert.equal(overview.cashSafetyRunwayMonths, 18000 / 6000);
});

test("living cost is the fallback when target monthly living cost is absent", () => {
  const legacy = clone(phase1Fixture.legacyState);
  legacy.userProfile.targetMonthlyLivingCost = null;
  const migrated = storage.migrateState(legacy);
  const overview = getOverviewModel(migrated);

  assert.equal(overview.cashSafetyRunwayMonths, 18000 / 5000);
});

test("cash holdings map to liquid cash without including investments", () => {
  const migrated = storage.migrateState(clone(phase1Fixture.legacyState));
  const overview = getOverviewModel(migrated);

  assert.equal(overview.cashSafetyRunwayMonths, 18000 / 6000);
  assert.equal(overview.totalAssetProgress, 1218000 / 2000000);
  assert.notEqual(overview.cashSafetyRunwayMonths, overview.totalAssetProgress);
});

test("cash and investment holdings map to investable assets rather than net assets", () => {
  const migrated = storage.migrateState(clone(phase1Fixture.legacyState));
  const overview = getOverviewModel(migrated);

  assert.deepEqual(overview.buckets, {
    cash: 18000,
    investments: 1200000,
    currentAssets: 1218000,
    todayPnl: 0,
  });
  assert.equal(overview.totalAssetProgress, 1218000 / 2000000);
});

test("legacy target maps to target retirement assets", () => {
  const migrated = storage.migrateState(clone(phase1Fixture.legacyState));
  const overview = getOverviewModel(migrated);

  assert.equal(overview.totalAssetProgress, 1218000 / 2000000);
});

test("holdings cannot confirm the income section", () => {
  const input = {
    ...clone(canonicalFixture.canonicalV1Input),
    incomeSources: undefined,
    holdings: [{ id: "fund-only", type: "stock", currentValue: 1000000 }],
    incomeStreams: [],
    inputCompletion: completeSections({ incomeSources: false }),
  };
  const result = canonicalAdapter.getCompletenessStatus(input);

  assert.notEqual(result.status, "COMPLETE");
});

test("legacy migration cannot silently improve retirement readiness", () => {
  const migrated = storage.migrateState(clone(phase1Fixture.legacyState));

  assert.equal(migrated.mode, "user");
  assert.deepEqual(migrated.inputCompletion, expectedUnconfirmedCompletion());
});

test("legacy wx load persists migrated V2 state and preserves facts", () => {
  const legacy = clone(phase1Fixture.legacyState);
  withWxStorage({ [storage.storageKey]: legacy }, (wxStorage) => {
    const loaded = storage.loadState();
    const persisted = wxStorage.read(storage.storageKey);

    assert.equal(loaded.schemaVersion, 2);
    assert.equal(loaded.mode, "user");
    assert.deepEqual(loaded.inputCompletion, expectedUnconfirmedCompletion());
    assert.equal(persisted.schemaVersion, 2);
    assert.equal(persisted.mode, "user");
    assert.deepEqual(persisted.inputCompletion, expectedUnconfirmedCompletion());
    assert.deepEqual(persisted.userProfile, legacy.userProfile);
    assert.deepEqual(persisted.holdings, legacy.holdings);
    assert.deepEqual(persisted.incomeStreams, legacy.incomeStreams);
    assert.deepEqual(persisted.securityAccounts.pension, legacy.securityAccounts.pension);
    assert.deepEqual(persisted.manualDrags, legacy.manualDrags);
  });
});

test("migrated wx state remains stable on a second load without another write", () => {
  withWxStorage({ [storage.storageKey]: clone(phase1Fixture.legacyState) }, (wxStorage) => {
    const first = storage.loadState();
    const writesAfterMigration = wxStorage.writeCount;
    const second = storage.loadState();

    assert.equal(writesAfterMigration, 1);
    assert.equal(wxStorage.writeCount, writesAfterMigration);
    assert.deepEqual(second, first);
    assert.equal(second.schemaVersion, 2);
    assert.equal(second.mode, "user");
  });
});

test("migration strips stale canonical derived fields from wx storage", () => {
  const legacy = {
    ...clone(phase1Fixture.legacyState),
    monthlyEssentialExpense: 999999,
    liquidCash: 999999,
    investableAssets: { total: 999999999 },
    targetRetirementAssets: 888888888,
  };
  withWxStorage({ [storage.storageKey]: legacy }, (wxStorage) => {
    const loaded = storage.loadState();

    assertNoCanonicalFields(loaded);
    assertNoCanonicalFields(wxStorage.read(storage.storageKey));
  });
});

test("saveState strips canonical derived fields before wx persistence", () => {
  const state = {
    ...storage.migrateState(clone(phase1Fixture.legacyState)),
    monthlyEssentialExpense: 999999,
    liquidCash: 999999,
    investableAssets: { total: 999999999 },
    targetRetirementAssets: 888888888,
  };
  withWxStorage({}, (wxStorage) => {
    const saved = storage.saveState(state);

    assertNoCanonicalFields(saved);
    assertNoCanonicalFields(wxStorage.read(storage.storageKey));
  });
});

test("saved raw facts drive overview canonical values after stale fields are stripped", () => {
  const state = {
    mode: "user",
    inputCompletion: expectedUnconfirmedCompletion(),
    userProfile: {
      targetMonthlyLivingCost: 6000,
      livingCost: 5000,
      target: 2000000,
    },
    holdings: [
      { id: "cash", type: "cash", currentValue: 18000 },
      { id: "investment", type: "stock", currentValue: 1000000 },
    ],
    incomeStreams: [],
    securityAccounts: {},
    manualDrags: [],
    monthlyEssentialExpense: 999999,
    liquidCash: 999999,
    investableAssets: { total: 999999999 },
    targetRetirementAssets: 888888888,
  };
  withWxStorage({}, () => {
    storage.saveState(state);
    const reloaded = reloadStorageModule().loadState();
    const overview = getOverviewModel(reloaded);

    assertNoCanonicalFields(reloaded);
    assert.equal(overview.cashSafetyRunwayMonths, 3);
    assert.equal(overview.totalAssetProgress, 1018000 / 2000000);
  });
});

test("first launch persists demo state through wx storage", () => {
  withWxStorage({}, (wxStorage) => {
    const state = storage.loadState();
    const persisted = wxStorage.read(storage.storageKey);

    assert.equal(state.mode, "demo");
    assert.equal(persisted.mode, "demo");
    assert.equal(persisted.schemaVersion, 2);
  });
});

test("clear and reset survive wx-backed module reloads", () => {
  withWxStorage({}, (wxStorage) => {
    storage.resetState();
    storage.clearState();
    const afterClear = reloadStorageModule().loadState();

    assert.equal(wxStorage.read(storage.storageKey).mode, "user");
    assert.equal(afterClear.mode, "user");
    assert.deepEqual(afterClear.holdings, []);

    const reset = reloadStorageModule().resetState();
    const afterReset = reloadStorageModule().loadState();

    assert.equal(reset.mode, "demo");
    assert.equal(wxStorage.read(storage.storageKey).mode, "demo");
    assert.equal(afterReset.mode, "demo");
    assert.ok(afterReset.holdings.length > 0);
  });
});
