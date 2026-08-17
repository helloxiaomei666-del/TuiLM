const assert = require("node:assert/strict");
const { existsSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const storage = require("../wechat-miniapp/utils/storage.js");
const { getDefaultState } = require("../wechat-miniapp/utils/demo-data.js");
const { getOverviewModel } = require("../wechat-miniapp/utils/overview-model.js");
const fixture = require("./fixtures/income-input-phase2.fixture.js");

const miniRoot = path.join(__dirname, "..", "wechat-miniapp");
const incomeController = path.join(miniRoot, "pages/income/income.js");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createWxMock() {
  const store = new Map();
  const toasts = [];
  const modals = [];
  return {
    toasts,
    modals,
    getStorageSync(key) {
      return store.has(key) ? clone(store.get(key)) : undefined;
    },
    setStorageSync(key, value) {
      store.set(key, clone(value));
    },
    removeStorageSync(key) {
      store.delete(key);
    },
    showToast(options) {
      toasts.push(options);
    },
    showModal(options) {
      modals.push(options);
    },
  };
}

function event({ field, id, value }) {
  const dataset = {};
  if (field) dataset.field = field;
  if (id) dataset.id = id;
  return {
    currentTarget: { dataset },
    detail: { value },
  };
}

function userState(incomeSources = false) {
  const state = getDefaultState();
  return {
    ...state,
    mode: "user",
    incomeStreams: [],
    inputCompletion: {
      profile: true,
      assets: true,
      incomeSources,
      protectionAccounts: true,
      dragItems: true,
    },
  };
}

function loadIncomePage() {
  assert.ok(existsSync(incomeController), "Phase 2 income page controller must exist before CRUD behavior can run");
  let definition = null;
  const previousPage = global.Page;
  global.Page = (config) => {
    definition = config;
  };
  try {
    delete require.cache[require.resolve(incomeController)];
    require(incomeController);
  } finally {
    if (previousPage === undefined) delete global.Page;
    else global.Page = previousPage;
  }
  assert.ok(definition, "income page controller must register with Page()");
  return {
    ...definition,
    data: clone(definition.data || {}),
    setData(patch) {
      this.data = {
        ...this.data,
        ...patch,
      };
    },
  };
}

function setIncomeForm(page, form) {
  page.setData({
    form: {
      ...page.data.form,
      ...clone(form),
    },
  });
}

function confirmRecords(page) {
  page.confirmIncomeSources();
  assert.equal(storage.loadState().inputCompletion.incomeSources, true);
}

const derivedIncomeFields = [
  "monthlyAmount",
  "netMonthlyCashflow",
  "eligibleMonthlyPassiveIncome",
  "includedInCoreRate",
  "exclusionReason",
  "originKey",
  "duplicateOfOriginKey",
];

function assertIncomeContainsFactsOnly(income) {
  derivedIncomeFields.forEach((field) => {
    assert.equal(
      Object.prototype.hasOwnProperty.call(income, field),
      false,
      `${field} must be derived from persisted income facts, not stored with them`,
    );
  });
}

test.beforeEach(() => {
  global.wx = createWxMock();
  storage.clearState();
  storage.saveState(userState(false));
});

test.afterEach(() => {
  storage.clearState();
  delete global.wx;
});

test("keeps an empty income list unconfirmed until the user explicitly answers", () => {
  const page = loadIncomePage();
  page.onShow();

  assert.deepEqual(storage.loadState().incomeStreams, []);
  assert.equal(storage.loadState().inputCompletion.incomeSources, false);
  assert.match(page.data.incomeCompletionText, /待确认/);
});

test("confirms the explicit no-passive-income answer without creating an income record", () => {
  const page = loadIncomePage();
  page.onShow();
  page.confirmNoIncome();

  const reloaded = storage.loadState();
  assert.deepEqual(reloaded.incomeStreams, []);
  assert.equal(reloaded.inputCompletion.incomeSources, true);
  assert.match(page.data.incomeCompletionText, /已确认.*没有被动收入/);
  assert.doesNotMatch(page.data.incomeCompletionText, /CONFIRMED_NONE/);
});

test("adds a raw income fact with a generated stable id and persists it through reload", () => {
  const page = loadIncomePage();
  page.onShow();
  setIncomeForm(page, fixture.receivedDividendForm);
  page.saveIncome();

  const saved = storage.loadState().incomeStreams;
  assert.equal(saved.length, 1);
  assert.equal(typeof saved[0].id, "string");
  assert.notEqual(saved[0].id, "");
  assert.deepEqual(
    {
      sourceType: saved[0].sourceType,
      rawAmount: saved[0].rawAmount,
      frequency: saved[0].frequency,
      actualReceived: saved[0].actualReceived,
      requiresLabor: saved[0].requiresLabor,
    },
    fixture.receivedDividendForm,
  );
  assert.equal(storage.loadState().inputCompletion.incomeSources, false);
});

test("does not auto-confirm a non-empty income list", () => {
  const page = loadIncomePage();
  page.onShow();
  setIncomeForm(page, fixture.receivedDividendForm);
  page.saveIncome();

  assert.equal(storage.loadState().incomeStreams.length, 1);
  assert.equal(storage.loadState().inputCompletion.incomeSources, false);
  assert.match(page.data.incomeCompletionText, /待确认/);
});

test("confirms a non-empty income list only after the explicit confirmation action", () => {
  const page = loadIncomePage();
  page.onShow();
  setIncomeForm(page, fixture.receivedDividendForm);
  page.saveIncome();
  confirmRecords(page);

  assert.match(page.data.incomeCompletionText, /已确认/);
  assert.doesNotMatch(page.data.incomeCompletionText, /PROVIDED|COMPLETE/);
});

test("creating an income after confirmation invalidates income confirmation", () => {
  const page = loadIncomePage();
  page.onShow();
  page.confirmNoIncome();
  setIncomeForm(page, fixture.receivedDividendForm);
  page.saveIncome();

  assert.equal(storage.loadState().inputCompletion.incomeSources, false);
  assert.match(page.data.incomeCompletionText, /待确认/);
});

test("edits an income by id without appending a duplicate and invalidates confirmation", () => {
  const page = loadIncomePage();
  page.onShow();
  setIncomeForm(page, fixture.receivedDividendForm);
  page.saveIncome();
  const original = storage.loadState().incomeStreams[0];
  confirmRecords(page);

  page.editIncome(event({ id: original.id }));
  page.onFormInput(event({ field: "rawAmount", value: "2400" }));
  page.saveIncome();

  const saved = storage.loadState();
  assert.equal(saved.incomeStreams.length, 1);
  assert.equal(saved.incomeStreams[0].id, original.id);
  assert.equal(saved.incomeStreams[0].rawAmount, 2400);
  assert.equal(saved.inputCompletion.incomeSources, false);
});

test("deletes only the confirmed target income by id after a Chinese confirmation prompt", () => {
  const page = loadIncomePage();
  page.onShow();
  setIncomeForm(page, fixture.receivedDividendForm);
  page.saveIncome();
  setIncomeForm(page, { ...fixture.rentalForm, rawAmount: 7000 });
  page.saveIncome();
  const [first, second] = storage.loadState().incomeStreams;
  confirmRecords(page);

  page.deleteIncome(event({ id: first.id }));
  assert.equal(global.wx.modals.length, 1);
  assert.match(global.wx.modals[0].content, /删除.*收入|收入.*删除/);
  assert.match(global.wx.modals[0].confirmText, /删除/);
  assert.match(global.wx.modals[0].cancelText, /取消/);
  global.wx.modals[0].success({ confirm: true, cancel: false });

  const saved = storage.loadState();
  assert.deepEqual(saved.incomeStreams.map((item) => item.id), [second.id]);
  assert.equal(saved.inputCompletion.incomeSources, false);
});

test("deleting the currently edited income exits edit mode and resets the form", () => {
  const page = loadIncomePage();
  page.onShow();
  setIncomeForm(page, fixture.receivedDividendForm);
  page.saveIncome();
  setIncomeForm(page, { ...fixture.rentalForm, rawAmount: 7000 });
  page.saveIncome();
  const [first, second] = storage.loadState().incomeStreams;

  page.editIncome(event({ id: first.id }));
  page.deleteIncome(event({ id: first.id }));
  global.wx.modals[0].success({ confirm: true, cancel: false });

  const saved = storage.loadState();
  assert.deepEqual(saved.incomeStreams.map((item) => item.id), [second.id]);
  assert.equal(page.data.editingIncomeId, "");
  assert.equal(page.data.isEditing, false);
  assert.equal(page.data.form.id, undefined);
  assert.equal(page.data.form.rawAmount, "");
  assert.equal(page.data.form.actualReceived, null);
  assert.equal(page.data.form.requiresLabor, null);
});

test("deleting another income preserves the current edit state", () => {
  const page = loadIncomePage();
  page.onShow();
  setIncomeForm(page, fixture.receivedDividendForm);
  page.saveIncome();
  setIncomeForm(page, { ...fixture.rentalForm, rawAmount: 7000 });
  page.saveIncome();
  const [first, second] = storage.loadState().incomeStreams;

  page.editIncome(event({ id: first.id }));
  page.onFormInput(event({ field: "rawAmount", value: "2400" }));
  page.deleteIncome(event({ id: second.id }));
  global.wx.modals[0].success({ confirm: true, cancel: false });

  const saved = storage.loadState();
  assert.deepEqual(saved.incomeStreams.map((item) => item.id), [first.id]);
  assert.equal(page.data.editingIncomeId, first.id);
  assert.equal(page.data.isEditing, true);
  assert.equal(page.data.form.id, first.id);
  assert.equal(page.data.form.rawAmount, "2400");
});

test("saving after deleting the currently edited income creates a new record", () => {
  const page = loadIncomePage();
  page.onShow();
  setIncomeForm(page, fixture.receivedDividendForm);
  page.saveIncome();
  setIncomeForm(page, { ...fixture.rentalForm, rawAmount: 7000 });
  page.saveIncome();
  const [first, second] = storage.loadState().incomeStreams;
  confirmRecords(page);

  page.editIncome(event({ id: first.id }));
  page.deleteIncome(event({ id: first.id }));
  global.wx.modals[0].success({ confirm: true, cancel: false });
  setIncomeForm(page, { ...fixture.unreceivedDividendForm, rawAmount: 3600 });
  page.saveIncome();

  const saved = storage.loadState();
  assert.equal(saved.incomeStreams.length, 2);
  assert.equal(saved.incomeStreams.some((item) => item.id === first.id), false);
  assert.equal(saved.incomeStreams.some((item) => item.id === second.id), true);
  const created = saved.incomeStreams.find((item) => item.id !== second.id);
  assert.notEqual(created.id, first.id);
  assert.equal(created.rawAmount, 3600);
  assert.equal(created.actualReceived, false);
  assert.equal(saved.inputCompletion.incomeSources, false);
});

test("rejects an empty or negative amount with a Chinese validation message", () => {
  const page = loadIncomePage();
  page.onShow();
  setIncomeForm(page, { ...fixture.receivedDividendForm, rawAmount: "" });
  page.saveIncome();
  setIncomeForm(page, { ...fixture.receivedDividendForm, rawAmount: -1 });
  page.saveIncome();

  assert.equal(storage.loadState().incomeStreams.length, 0);
  assert.ok(global.wx.toasts.length >= 1);
  global.wx.toasts.forEach((toast) => {
    assert.match(toast.title, /金额|收入/);
    assert.doesNotMatch(toast.title, /invalid amount|sourceType required|actualReceived required/);
  });
});

test("stores income facts only in incomeStreams without canonical calculated fields", () => {
  const page = loadIncomePage();
  page.onShow();
  setIncomeForm(page, fixture.receivedDividendForm);
  page.saveIncome();

  const [saved] = storage.loadState().incomeStreams;
  [
    "monthlyAmount",
    "netMonthlyCashflow",
    "eligibleMonthlyPassiveIncome",
    "includedInCoreRate",
    "exclusionReason",
    "originKey",
    "duplicateOfOriginKey",
  ].forEach((field) => {
    assert.equal(Object.prototype.hasOwnProperty.call(saved, field), false, `${field} must remain canonical-derived`);
  });
  const state = storage.loadState();
  assert.equal(Object.prototype.hasOwnProperty.call(state, "canonicalIncomeSources"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(state, "passiveIncomeSourcesV2"), false);
});

test("passes a received annual dividend from storage through overview into canonical passive income", () => {
  const page = loadIncomePage();
  page.onShow();
  setIncomeForm(page, fixture.receivedDividendForm);
  page.saveIncome();
  confirmRecords(page);

  const overview = getOverviewModel(storage.loadState());
  assert.equal(overview.monthlyStablePassiveIncome, 100);
  assert.equal(overview.passiveIncomeCoverageRate, 100 / 8500);
});

test("preserves an unreceived dividend fact while keeping it out of current canonical passive income", () => {
  const page = loadIncomePage();
  page.onShow();
  setIncomeForm(page, fixture.unreceivedDividendForm);
  page.saveIncome();
  confirmRecords(page);

  const state = storage.loadState();
  const overview = getOverviewModel(state);
  assert.equal(state.incomeStreams[0].actualReceived, false);
  assert.equal(overview.monthlyStablePassiveIncome, 0);
  assert.equal(overview.passiveIncomeCoverageRate, 0);
});

test("passes rental costs as facts so the canonical adapter derives 5000 yuan net monthly cashflow", () => {
  const page = loadIncomePage();
  page.onShow();
  setIncomeForm(page, fixture.rentalForm);
  page.saveIncome();
  confirmRecords(page);

  const overview = getOverviewModel(storage.loadState());
  assert.equal(overview.monthlyStablePassiveIncome, 5000);
  assert.equal(overview.passiveIncomeCoverageRate, 5000 / 8500);
});

test("keeps the income page controller out of monthly-amount eligibility and retirement-index calculations", () => {
  assert.ok(existsSync(incomeController), "Phase 2 income page controller must exist before calculation-boundary checks can run");
  const source = require("node:fs").readFileSync(incomeController, "utf8");

  assert.doesNotMatch(source, /calculateCanonicalRetirement|calculateStablePassiveIncome|computePassiveIncomeCoverage|composeRetirementIndex/);
  assert.doesNotMatch(source, /rawAmount\s*\/\s*(?:12|3)|grossRent\s*-/);
});

test("strips stale derived fields from an income fact persisted through wx storage", () => {
  const source = {
    id: "income-1",
    sourceType: "stock_dividend",
    rawAmount: 1200,
    frequency: "yearly",
    actualReceived: true,
    requiresLabor: false,
    monthlyAmount: 99999,
    netMonthlyCashflow: 99999,
    eligibleMonthlyPassiveIncome: 99999,
    includedInCoreRate: true,
    exclusionReason: "stale",
    originKey: "stale-origin",
    duplicateOfOriginKey: "duplicate-origin",
  };
  storage.saveState({
    ...userState(true),
    incomeStreams: [source],
  });

  const [reloaded] = storage.loadState().incomeStreams;
  assert.deepEqual(
    {
      id: reloaded.id,
      sourceType: reloaded.sourceType,
      rawAmount: reloaded.rawAmount,
      frequency: reloaded.frequency,
      actualReceived: reloaded.actualReceived,
      requiresLabor: reloaded.requiresLabor,
    },
    {
      id: "income-1",
      sourceType: "stock_dividend",
      rawAmount: 1200,
      frequency: "yearly",
      actualReceived: true,
      requiresLabor: false,
    },
  );
  assertIncomeContainsFactsOnly(reloaded);
});

test("preserves every rental income fact through save and reload", () => {
  const rental = {
    id: "rental-1",
    ...fixture.rentalForm,
  };
  storage.saveState({
    ...userState(false),
    incomeStreams: [rental],
  });

  const [reloaded] = storage.loadState().incomeStreams;
  assert.deepEqual(
    {
      id: reloaded.id,
      sourceType: reloaded.sourceType,
      rawAmount: reloaded.rawAmount,
      frequency: reloaded.frequency,
      actualReceived: reloaded.actualReceived,
      requiresLabor: reloaded.requiresLabor,
      taxOrFee: reloaded.taxOrFee,
      maintenanceCost: reloaded.maintenanceCost,
      otherNecessaryCost: reloaded.otherNecessaryCost,
    },
    rental,
  );
});

test("cannot let stale persisted income derivatives override the canonical dividend result", () => {
  storage.saveState({
    ...userState(true),
    incomeStreams: [
      {
        id: "income-1",
        sourceType: "stock_dividend",
        rawAmount: 1200,
        frequency: "yearly",
        actualReceived: true,
        requiresLabor: false,
        monthlyAmount: 99999,
        eligibleMonthlyPassiveIncome: 99999,
      },
    ],
  });

  const overview = getOverviewModel(storage.loadState());
  assert.equal(overview.monthlyStablePassiveIncome, 100);
  assert.equal(overview.passiveIncomeCoverageRate, 100 / 8500);
});

test("applies the same income fact stripping contract in the Node memory fallback", () => {
  const wxStorage = global.wx;
  delete global.wx;
  try {
    storage.clearState();
    storage.saveState({
      ...userState(true),
      incomeStreams: [
        {
          id: "income-memory-1",
          ...fixture.receivedDividendForm,
          monthlyAmount: 99999,
          netMonthlyCashflow: 99999,
          eligibleMonthlyPassiveIncome: 99999,
          includedInCoreRate: true,
          exclusionReason: "stale",
        },
      ],
    });

    const [reloaded] = storage.loadState().incomeStreams;
    assert.equal(reloaded.id, "income-memory-1");
    assert.equal(reloaded.rawAmount, 1200);
    assertIncomeContainsFactsOnly(reloaded);
  } finally {
    global.wx = wxStorage;
  }
});
