const assert = require("node:assert/strict");
const test = require("node:test");

const storage = require("../wechat-miniapp/utils/storage.js");
const demoData = require("../wechat-miniapp/utils/demo-data.js");
const { getOverviewModel } = require("../wechat-miniapp/utils/overview-model.js");
const canonicalAdapter = require("../wechat-miniapp/utils/retirement-index-adapter.js");
const canonicalFixture = require("./fixtures/retirement-index-v1.fixture.js");
const phase1Fixture = require("./fixtures/input-loop-phase1.fixture.js");
const liabilityFixture = require("./fixtures/liability-facts-phase4a.fixture.js");
const { validateLiabilityFacts } = require("../wechat-miniapp/utils/liability-model.js");

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
    liabilities: false,
  };
}

function completeSections(overrides = {}) {
  return {
    profile: true,
    assets: true,
    incomeSources: true,
    protectionAccounts: true,
    dragItems: true,
    liabilities: false,
    ...overrides,
  };
}

const forbiddenDerivedFields = [
  "monthlyEssentialExpense",
  "liquidCash",
  "investableAssets",
  "targetRetirementAssets",
  "protectionAccounts",
  "dragItems",
  "totalLiabilities",
  "totalMonthlyPayment",
  "uncoveredMonthlyPayment",
  "effectiveEssentialExpense",
  "investableNetAssets",
];

function createWxStorage(seed = {}) {
  const records = new Map(
    Object.entries(seed).map(([key, value]) => [key, clone(value)]),
  );
  let writeCount = 0;
  let removeCount = 0;
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
        removeCount += 1;
        records.delete(key);
      },
    },
    read(key) {
      return records.has(key) ? clone(records.get(key)) : undefined;
    },
    get writeCount() {
      return writeCount;
    },
    get removeCount() {
      return removeCount;
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

function assertNoDerivedFields(state) {
  forbiddenDerivedFields.forEach((key) => {
    assert.equal(Object.prototype.hasOwnProperty.call(state, key), false, `${key} must not persist`);
  });
}

function validV3LiabilityState(overrides = {}) {
  return {
    schemaVersion: 3,
    mode: "user",
    inputCompletion: completeSections({ liabilities: true }),
    userProfile: {
      livingCost: 5000,
      targetMonthlyLivingCost: 6000,
      target: 2000000,
      mortgage: 3000,
      carLoan: 400,
      otherDebt: 200,
    },
    holdings: clone(phase1Fixture.legacyState.holdings),
    incomeStreams: [],
    manualDrags: clone(phase1Fixture.legacyState.manualDrags),
    securityAccounts: phase3SecurityAccounts(),
    liabilities: clone(liabilityFixture.validLiabilities),
    ...overrides,
  };
}

function phase3SecurityAccounts() {
  return {
    pension: {
      balance: 100000,
      yearsPaid: 12,
      personalMonthly: 800,
      employerMonthly: 1600,
      estimatedMonthlyBenefit: 3000,
    },
    housingFund: {
      balance: 50000,
      personalMonthly: 900,
      employerMonthly: 900,
      loanOffsetMonthly: 400,
    },
    supplementalHousingFund: {
      balance: 12000,
      personalMonthly: 200,
      employerMonthly: 200,
      loanOffsetMonthly: 100,
    },
    enterpriseAnnuity: {
      balance: 30000,
      personalMonthly: 300,
      employerMonthly: 300,
      estimatedMonthlyBenefit: 600,
    },
    occupationalAnnuity: {
      balance: 20000,
      personalMonthly: 250,
      employerMonthly: 250,
      estimatedMonthlyBenefit: 500,
    },
  };
}

function staleProtectionAccounts() {
  return [{
    id: "stale",
    type: "social_security",
    futureEstimatedMonthlyAmount: 99999,
    actualMonthlyReceived: 99999,
  }];
}

test("standard state declares schema version 3 with an empty unconfirmed liability section", () => {
  const state = demoData.getDefaultState();

  assert.equal(state.schemaVersion, 3);
  assert.deepEqual(state.liabilities, []);
  assert.equal(state.inputCompletion.liabilities, false);
});

test("v2 migration creates no liabilities while preserving legacy facts and completion", () => {
  const legacy = {
    ...clone(phase1Fixture.legacyState),
    schemaVersion: 2,
    mode: "user",
    userProfile: {
      ...phase1Fixture.legacyState.userProfile,
      mortgage: 3000,
      carLoan: 400,
      otherDebt: 200,
    },
    inputCompletion: completeSections({ liabilities: true }),
    liabilities: clone(liabilityFixture.validLiabilities),
  };
  const migrated = storage.migrateState(legacy);

  assert.equal(migrated.schemaVersion, 3);
  assert.deepEqual(migrated.liabilities, []);
  assert.equal(migrated.inputCompletion.liabilities, false);
  assert.deepEqual(migrated.inputCompletion, completeSections({ liabilities: false }));
  assert.equal(migrated.userProfile.mortgage, 3000);
  assert.equal(migrated.userProfile.carLoan, 400);
  assert.equal(migrated.userProfile.otherDebt, 200);
  assert.deepEqual(migrated.holdings, legacy.holdings);
  assert.deepEqual(migrated.securityAccounts.pension, legacy.securityAccounts.pension);
  assert.deepEqual(migrated.manualDrags, legacy.manualDrags);
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

    assert.equal(loaded.schemaVersion, 3);
    assert.equal(loaded.mode, "user");
    assert.deepEqual(loaded.inputCompletion, expectedUnconfirmedCompletion());
    assert.equal(persisted.schemaVersion, 3);
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
    assert.equal(second.schemaVersion, 3);
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
    dragItems: [{ type: "mortgage", score: 20 }],
    ...liabilityFixture.staleLiabilityDerivedFields,
  };
  withWxStorage({ [storage.storageKey]: legacy }, (wxStorage) => {
    const loaded = storage.loadState();

    assertNoDerivedFields(loaded);
    assertNoDerivedFields(wxStorage.read(storage.storageKey));
  });
});

test("saveState strips canonical derived fields before wx persistence", () => {
  const state = {
    ...storage.migrateState(clone(phase1Fixture.legacyState)),
    monthlyEssentialExpense: 999999,
    liquidCash: 999999,
    investableAssets: { total: 999999999 },
    targetRetirementAssets: 888888888,
    dragItems: [{ type: "mortgage", score: 20 }],
    ...liabilityFixture.staleLiabilityDerivedFields,
  };
  withWxStorage({}, (wxStorage) => {
    const saved = storage.saveState(state);

    assertNoDerivedFields(saved);
    assertNoDerivedFields(wxStorage.read(storage.storageKey));
  });
});

test("v3 liabilities round-trip as raw facts through wx storage while derived values are stripped", () => {
  const state = {
    ...validV3LiabilityState(),
    dragItems: [{ type: "mortgage", score: 20 }],
    protectionAccounts: staleProtectionAccounts(),
    ...liabilityFixture.staleLiabilityDerivedFields,
  };
  withWxStorage({}, (wxStorage) => {
    const saved = storage.saveState(state);
    const reloaded = reloadStorageModule().loadState();
    const persisted = wxStorage.read(storage.storageKey);

    assert.equal(saved.schemaVersion, 3);
    assert.deepEqual(saved.liabilities, liabilityFixture.validLiabilities);
    assert.equal(saved.inputCompletion.liabilities, true);
    assert.equal(saved.inputCompletion.profile, true);
    assertNoDerivedFields(saved);
    assert.deepEqual(reloaded.liabilities, liabilityFixture.validLiabilities);
    assert.equal(reloaded.inputCompletion.liabilities, true);
    assertNoDerivedFields(reloaded);
    assertNoDerivedFields(persisted);
  });
});

test("v3 liabilities round-trip as raw facts through the memory fallback", () => {
  storage.clearState();
  try {
    const saved = storage.saveState({
      ...validV3LiabilityState(),
      dragItems: [{ type: "mortgage", score: 20 }],
      ...liabilityFixture.staleLiabilityDerivedFields,
    });
    const reloaded = storage.loadState();

    assert.deepEqual(saved.liabilities, liabilityFixture.validLiabilities);
    assertNoDerivedFields(saved);
    assert.deepEqual(reloaded.liabilities, liabilityFixture.validLiabilities);
    assert.equal(reloaded.inputCompletion.liabilities, true);
    assertNoDerivedFields(reloaded);
  } finally {
    storage.clearState();
  }
});

test("v3 save rejects an invalid complete liability array without changing persisted facts", () => {
  const validState = validV3LiabilityState();
  const invalidState = validV3LiabilityState({
    liabilities: [{
      ...liabilityFixture.validLiabilities[0],
      outstandingBalance: 0,
    }],
  });
  withWxStorage({}, (wxStorage) => {
    storage.saveState(validState);
    const before = wxStorage.read(storage.storageKey);

    assert.throws(
      () => storage.saveState(invalidState),
      /负债/,
    );
    assert.deepEqual(wxStorage.read(storage.storageKey), before);
  });
});

test("v3 save rejects a non-array liability value without changing persisted facts", () => {
  const validState = validV3LiabilityState();
  const invalidState = validV3LiabilityState({ liabilities: {} });
  withWxStorage({}, (wxStorage) => {
    storage.saveState(validState);
    const before = wxStorage.read(storage.storageKey);

    assert.throws(
      () => storage.saveState(invalidState),
      /负债/,
    );
    assert.deepEqual(wxStorage.read(storage.storageKey), before);
  });
});

const malformedLiabilityCases = [
  ...[
    ["null", null],
    ["object", {}],
    ["string", "invalid"],
    ["number", 123],
    ["boolean", false],
    ["undefined", undefined],
    ["missing", undefined],
  ].map(([name, value]) => ({ name, value, message: "负债列表格式无效" })),
  {
    name: "invalid item after a valid fact",
    value: [
      liabilityFixture.validLiabilities[0],
      { ...liabilityFixture.validLiabilities[1], outstandingBalance: 0 },
    ],
    message: "请输入大于 0 的有效负债余额",
  },
  {
    name: "duplicate IDs",
    value: [liabilityFixture.validLiabilities[0], liabilityFixture.validLiabilities[0]],
    message: "负债编号重复",
  },
];

function malformedV3State(example, confirmed) {
  const state = validV3LiabilityState({
    liabilities: structuredClone(example.value),
    inputCompletion: completeSections({ liabilities: confirmed }),
    ...liabilityFixture.staleLiabilityDerivedFields,
    protectionAccounts: staleProtectionAccounts(),
    dragItems: [{ type: "mortgage", score: 20 }],
  });
  if (example.name === "missing") delete state.liabilities;
  return state;
}

for (const example of malformedLiabilityCases) {
  for (const confirmed of [true, false]) {
    test(`malformed v3 ${example.name} load rejects with completion=${confirmed} and zero writes`, () => {
      const invalid = malformedV3State(example, confirmed);
      const original = structuredClone(invalid);
      // The wx JSON clone omits explicit undefined; direct boundaries cover it below.
      withWxStorage({ [storage.storageKey]: invalid }, (wxStorage) => {
        const before = wxStorage.read(storage.storageKey);
        assert.equal(before.inputCompletion.liabilities, confirmed);
        assert.throws(() => storage.loadState(), { message: example.message });
        assert.throws(() => reloadStorageModule().loadState(), { message: example.message });
        assert.equal(wxStorage.writeCount, 0);
        assert.equal(wxStorage.removeCount, 0);
        assert.deepEqual(wxStorage.read(storage.storageKey), before);
        assert.deepEqual(invalid, original);
      });
    });
  }

  test(`malformed v3 ${example.name} save and migration share the real validator without mutation`, () => {
    for (const confirmed of [true, false]) {
      const invalid = malformedV3State(example, confirmed);
      const original = structuredClone(invalid);
      const validation = validateLiabilityFacts(invalid.liabilities);
      assert.equal(validation.ok, false);
      assert.equal(validation.message, example.message);
      withWxStorage({ [storage.storageKey]: validV3LiabilityState() }, (wxStorage) => {
        const before = wxStorage.read(storage.storageKey);
        assert.throws(() => storage.saveState(invalid), { message: example.message });
        assert.throws(() => storage.migrateState(invalid), { message: example.message });
        assert.equal(wxStorage.writeCount, 0);
        assert.equal(wxStorage.removeCount, 0);
        assert.deepEqual(wxStorage.read(storage.storageKey), before);
        assert.deepEqual(invalid, original);
      });
    }
  });
}

test("malformed v3 saves and migrations leave the valid memory state intact", () => {
  const memoryStorage = reloadStorageModule();
  const saved = memoryStorage.saveState(validV3LiabilityState());
  for (const example of malformedLiabilityCases) {
    for (const confirmed of [true, false]) {
      const invalid = malformedV3State(example, confirmed);
      const before = structuredClone(invalid);
      assert.throws(() => memoryStorage.saveState(invalid), { message: example.message });
      assert.throws(() => memoryStorage.migrateState(invalid), { message: example.message });
      assert.deepEqual(invalid, before);
      assert.deepEqual(memoryStorage.loadState(), saved);
    }
  }
});

test("v2 without liabilities initializes empty and unconfirmed on migration and wx load", () => {
  const legacy = {
    ...clone(phase1Fixture.legacyState),
    schemaVersion: 2,
    mode: "user",
    inputCompletion: completeSections({ liabilities: true }),
  };
  const before = clone(legacy);
  assert.equal(Object.hasOwn(legacy, "liabilities"), false);
  const migrated = storage.migrateState(legacy);
  assert.equal(migrated.schemaVersion, 3);
  assert.deepEqual(migrated.liabilities, []);
  assert.deepEqual(migrated.inputCompletion, completeSections({ liabilities: false }));
  assert.deepEqual(migrated.userProfile, legacy.userProfile);
  assert.deepEqual(migrated.manualDrags, legacy.manualDrags);
  assert.deepEqual(legacy, before);
  withWxStorage({ [storage.storageKey]: legacy }, (wxStorage) => {
    assert.deepEqual(storage.loadState(), migrated);
    assert.deepEqual(wxStorage.read(storage.storageKey), migrated);
    assert.deepEqual(reloadStorageModule().loadState(), migrated);
    assert.equal(wxStorage.writeCount, 1);
    assert.equal(wxStorage.removeCount, 0);
  });
});

for (const mode of ["user", "demo"]) {
  for (const confirmed of [true, false]) {
    for (const hasLiabilities of [true, false]) {
      test(`valid v3 remains stable: mode=${mode}, completion=${confirmed}, facts=${hasLiabilities}`, () => {
        const state = validV3LiabilityState({
          mode,
          liabilities: hasLiabilities ? clone(liabilityFixture.validLiabilities) : [],
          inputCompletion: completeSections({ assets: false, dragItems: false, liabilities: confirmed }),
        });
        const before = clone(state);
        const migrated = storage.migrateState(state);
        assert.equal(migrated.schemaVersion, 3);
        assert.deepEqual(migrated.liabilities, state.liabilities);
        assert.deepEqual(migrated.inputCompletion, mode === "user"
          ? state.inputCompletion : expectedUnconfirmedCompletion());
        assert.deepEqual(storage.migrateState(migrated), migrated);
        assert.deepEqual(state, before);
        withWxStorage({}, (wxStorage) => {
          assert.deepEqual(storage.saveState(state), migrated);
          assert.deepEqual(storage.loadState(), migrated);
          assert.deepEqual(reloadStorageModule().loadState(), migrated);
          assert.deepEqual(wxStorage.read(storage.storageKey), migrated);
          assert.equal(wxStorage.writeCount, 1);
          assert.equal(wxStorage.removeCount, 0);
        });
        const memoryStorage = reloadStorageModule();
        assert.deepEqual(memoryStorage.saveState(state), migrated);
        assert.deepEqual(memoryStorage.loadState(), migrated);
        assert.deepEqual(memoryStorage.loadState(), migrated);
      });
    }
  }
}

function cleanSnapshotHistory() {
  return [{
    id: "history-later",
    snapshotDate: "2026-08-22",
    totalValue: 100000,
    monthlyEssentialExpense: 5000,
    liquidCash: 18000,
    investableAssets: { total: 100000 },
    targetRetirementAssets: 2000000,
    inputCompletion: { profile: true, protectionAccounts: true, dragItems: false, liabilities: true },
    items: [{ holdingId: "cash", currentValue: 100000, source: "manual" }],
    details: {
      note: "保留历史，不按当前事实重算",
      history: [
        [{
          manualDrags: [{ type: "mortgage", monthlyAmount: 3000 }],
          securityAccounts: { pension: { balance: 12345 } },
          inputCompletion: { protectionAccounts: false, dragItems: true },
        }],
        { inputCompletion: { profile: false } },
        null, false, 0, "历史备注",
      ],
    },
  }, {
    id: "history-earlier",
    snapshotDate: "2026-08-20",
    totalValue: 99000,
    dailyChange: -1000,
    inputCompletion: { protectionAccounts: false, dragItems: true },
    items: [{ holdingId: "cash", currentValue: 99000, source: "manual" }],
  }];
}

function dirtySnapshotHistory() {
  const history = cleanSnapshotHistory();
  const derivedPayloads = {
    ...liabilityFixture.staleLiabilityDerivedFields,
    protectionAccounts: staleProtectionAccounts(),
    dragItems: [{ type: "mortgage", score: 20 }],
  };
  for (const record of history) {
    Object.assign(record, clone(derivedPayloads));
    Object.assign(record.items[0], clone(derivedPayloads));
    // Summary values are still prohibited inside a confirmation object.
    Object.assign(record.inputCompletion, liabilityFixture.staleLiabilityDerivedFields);
  }
  Object.assign(history[0].details, clone(derivedPayloads));
  Object.assign(history[0].details.history[0][0], clone(derivedPayloads));
  Object.assign(history[0].details.history[0][0].inputCompletion, liabilityFixture.staleLiabilityDerivedFields);
  // Only boolean confirmation facts get the same-name exception, not payloads.
  Object.assign(history[0].details.history[1].inputCompletion, clone(derivedPayloads));
  return history;
}

function assertSanitizedSnapshotState(actual, input, container) {
  assertNoDerivedFields(actual);
  assert.equal(actual.schemaVersion, 3);
  assert.deepEqual(actual[container], cleanSnapshotHistory());
  assert.deepEqual(actual.liabilities, input.schemaVersion === 3 ? input.liabilities : []);
  assert.deepEqual(actual.inputCompletion, {
    ...input.inputCompletion,
    liabilities: input.schemaVersion === 3,
  });
  assert.deepEqual(actual.userProfile, input.userProfile);
  assert.deepEqual(actual.holdings, input.holdings);
  assert.deepEqual(actual.incomeStreams, input.incomeStreams);
  assert.deepEqual(actual.manualDrags, input.manualDrags);
  assert.deepEqual(actual.securityAccounts, input.securityAccounts);
}

for (const container of ["calculationSnapshots", "valuationSnapshots"]) {
  for (const schemaVersion of [2, 3]) {
    function snapshotState() {
      return validV3LiabilityState({
        schemaVersion,
        [container]: dirtySnapshotHistory(),
        ...liabilityFixture.staleLiabilityDerivedFields,
        protectionAccounts: staleProtectionAccounts(),
        dragItems: [{ type: "mortgage", score: 20 }],
      });
    }

    test(`v${schemaVersion} ${container} migration strips nested payloads and preserves exact history`, () => {
      const input = snapshotState();
      const before = clone(input);
      const migrated = storage.migrateState(input);
      assertSanitizedSnapshotState(migrated, input, container);
      assert.deepEqual(storage.migrateState(migrated), migrated);
      assert.deepEqual(input, before);
    });

    test(`v${schemaVersion} ${container} wx save persists only clean history`, () => {
      const input = snapshotState();
      const before = clone(input);
      withWxStorage({}, (wxStorage) => {
        const saved = storage.saveState(input);
        assertSanitizedSnapshotState(saved, input, container);
        assert.deepEqual(wxStorage.read(storage.storageKey), saved);
        assert.deepEqual(reloadStorageModule().loadState(), saved);
        assert.equal(wxStorage.writeCount, 1);
        assert.equal(wxStorage.removeCount, 0);
      });
      assert.deepEqual(input, before);
    });

    test(`v${schemaVersion} ${container} dirty wx load sanitizes once without losing history`, () => {
      const input = snapshotState();
      const before = clone(input);
      withWxStorage({ [storage.storageKey]: input }, (wxStorage) => {
        const loaded = storage.loadState();
        assertSanitizedSnapshotState(loaded, input, container);
        assert.deepEqual(wxStorage.read(storage.storageKey), loaded);
        assert.deepEqual(reloadStorageModule().loadState(), loaded);
        assert.equal(wxStorage.writeCount, 1);
        assert.equal(wxStorage.removeCount, 0);
      });
      assert.deepEqual(input, before);
    });

    test(`v${schemaVersion} ${container} memory save and load preserve only clean history`, () => {
      const input = snapshotState();
      const before = clone(input);
      const memoryStorage = reloadStorageModule();
      const saved = memoryStorage.saveState(input);
      assertSanitizedSnapshotState(saved, input, container);
      assert.deepEqual(memoryStorage.loadState(), saved);
      assert.deepEqual(memoryStorage.loadState(), saved);
      assert.deepEqual(input, before);
    });
  }
}

test("migration strips stale protectionAccounts without losing raw Security facts", () => {
  const securityAccounts = phase3SecurityAccounts();
  const migrated = storage.migrateState({
    schemaVersion: 2,
    mode: "user",
    securityAccounts,
    protectionAccounts: staleProtectionAccounts(),
  });

  assert.equal(Object.prototype.hasOwnProperty.call(migrated, "protectionAccounts"), false);
  assert.deepEqual(migrated.securityAccounts, securityAccounts);
});

test("wx save and reload strip stale protectionAccounts while preserving raw Security facts", () => {
  const securityAccounts = phase3SecurityAccounts();
  const state = {
    schemaVersion: 2,
    mode: "user",
    securityAccounts,
    protectionAccounts: staleProtectionAccounts(),
  };

  withWxStorage({}, (wxStorage) => {
    const saved = storage.saveState(state);
    const reloaded = reloadStorageModule().loadState();

    assert.equal(Object.prototype.hasOwnProperty.call(saved, "protectionAccounts"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(reloaded, "protectionAccounts"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(wxStorage.read(storage.storageKey), "protectionAccounts"), false);
    assert.deepEqual(reloaded.securityAccounts, securityAccounts);
  });
});

test("memory save and reload strip stale protectionAccounts while preserving raw Security facts", () => {
  const securityAccounts = phase3SecurityAccounts();
  storage.clearState();
  try {
    const saved = storage.saveState({
      schemaVersion: 2,
      mode: "user",
      securityAccounts,
      protectionAccounts: staleProtectionAccounts(),
    });
    const reloaded = storage.loadState();

    assert.equal(Object.prototype.hasOwnProperty.call(saved, "protectionAccounts"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(reloaded, "protectionAccounts"), false);
    assert.deepEqual(reloaded.securityAccounts, securityAccounts);
  } finally {
    storage.clearState();
  }
});

test("stale protectionAccounts cannot survive reload or override fresh Security bridge data", () => {
  storage.clearState();
  try {
    storage.saveState({
      schemaVersion: 2,
      mode: "user",
      inputCompletion: completeSections(),
      userProfile: {
        targetMonthlyLivingCost: 6000,
        livingCost: 6000,
        target: 2000000,
      },
      holdings: [
        { id: "cash", type: "cash", currentValue: 18000 },
        { id: "fund", type: "stock", currentValue: 1000000 },
      ],
      incomeStreams: [],
      manualDrags: [],
      securityAccounts: phase3SecurityAccounts(),
      protectionAccounts: staleProtectionAccounts(),
    });
    const reloaded = storage.loadState();
    const overview = getOverviewModel(reloaded);

    assert.equal(Object.prototype.hasOwnProperty.call(reloaded, "protectionAccounts"), false);
    assert.equal(overview.retirementIndexCompleteness, "COMPLETE");
    assert.notEqual(overview.monthlyStablePassiveIncome, 99999);
  } finally {
    storage.clearState();
  }
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

    assertNoDerivedFields(reloaded);
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
    assert.equal(persisted.schemaVersion, 3);
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
