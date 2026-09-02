const assert = require("node:assert/strict");
const { existsSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const storage = require("../wechat-miniapp/utils/storage.js");
const { getEmptyState } = require("../wechat-miniapp/utils/demo-data.js");
const fixture = require("./fixtures/liability-facts-phase4a.fixture.js");

const controllerPath = path.join(
  __dirname,
  "..",
  "wechat-miniapp",
  "pages",
  "liabilities",
  "liabilities.js",
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createWxMock() {
  const store = new Map();
  const toasts = [];
  const modals = [];
  let writeCount = 0;
  return {
    toasts,
    modals,
    get writeCount() {
      return writeCount;
    },
    resetWriteCount() {
      writeCount = 0;
    },
    getStorageSync(key) {
      return store.has(key) ? clone(store.get(key)) : undefined;
    },
    setStorageSync(key, value) {
      writeCount += 1;
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
  if (field !== undefined) dataset.field = field;
  if (id !== undefined) dataset.id = id;
  return { currentTarget: { dataset }, detail: { value } };
}

function userState(liabilities = [], liabilitiesCompleted = false) {
  const state = getEmptyState();
  return {
    ...state,
    mode: "user",
    liabilities: clone(liabilities),
    inputCompletion: {
      profile: true,
      assets: true,
      incomeSources: true,
      protectionAccounts: true,
      dragItems: true,
      liabilities: liabilitiesCompleted,
    },
  };
}

function loadLiabilityPage() {
  assert.ok(existsSync(controllerPath), "Liabilities page controller must exist before controller behavior can run");
  let definition = null;
  const previousPage = global.Page;
  global.Page = (config) => {
    definition = config;
  };
  try {
    delete require.cache[require.resolve(controllerPath)];
    require(controllerPath);
  } finally {
    if (previousPage === undefined) delete global.Page;
    else global.Page = previousPage;
  }
  assert.ok(definition, "Liabilities page controller must register with Page()");
  return {
    ...definition,
    data: clone(definition.data || {}),
    setData(patch) {
      this.data = { ...this.data, ...patch };
    },
  };
}

function setForm(page, form) {
  Object.entries(form).forEach(([field, value]) => {
    page.onFormInput(event({ field, value }));
  });
}

function selectIncluded(page, value) {
  page.onIncludedInEssentialExpenseChange(event({ value }));
}

function saveValidLiability(page, overrides = {}) {
  setForm(page, {
    type: "mortgage",
    outstandingBalance: "120000",
    monthlyPayment: "0",
    note: "自住房贷款",
    ...overrides,
  });
  selectIncluded(page, false);
  page.saveLiability();
}

function otherCompletions(state) {
  const { liabilities, ...rest } = state.inputCompletion;
  return rest;
}

test.beforeEach(() => {
  global.wx = createWxMock();
  storage.clearState();
  storage.saveState(userState());
  global.wx.resetWriteCount();
});

test.afterEach(() => {
  storage.clearState();
  delete global.wx;
});

test("loads raw liabilities and only the three allowed display summaries", () => {
  storage.saveState(userState(fixture.validLiabilities));
  const page = loadLiabilityPage();
  page.onShow();

  assert.deepEqual(page.data.liabilities, fixture.validLiabilities);
  assert.deepEqual(
    Object.keys(page.data.summary).sort(),
    ["totalLiabilitiesText", "totalMonthlyPaymentText", "uncoveredMonthlyPaymentText"],
  );
  assert.equal(Object.prototype.hasOwnProperty.call(page.data, "effectiveEssentialExpense"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(page.data, "investableNetAssets"), false);
});

test("keeps a new liability inclusion choice unresolved and performs zero writes until it is explicit", () => {
  const page = loadLiabilityPage();
  page.onShow();
  const before = storage.loadState();

  assert.equal(page.data.form.includedInEssentialExpense, null);
  setForm(page, { outstandingBalance: "120000", monthlyPayment: "0" });
  page.saveLiability();

  assert.equal(global.wx.writeCount, 0);
  assert.deepEqual(storage.loadState(), before);
  assert.equal(global.wx.toasts.at(-1).title, "请选择这笔月供是否已包含在每月必要支出中");
});

test("creates a raw manual liability only after an explicit false inclusion selection", () => {
  const page = loadLiabilityPage();
  page.onShow();
  saveValidLiability(page);

  const saved = storage.loadState();
  assert.equal(global.wx.writeCount, 1);
  assert.equal(saved.liabilities.length, 1);
  assert.equal(saved.liabilities[0].outstandingBalance, 120000);
  assert.equal(saved.liabilities[0].monthlyPayment, 0);
  assert.equal(saved.liabilities[0].includedInEssentialExpense, false);
  assert.equal(saved.liabilities[0].source, "manual");
  assert.equal(saved.inputCompletion.liabilities, false);
  assert.deepEqual(otherCompletions(saved), otherCompletions(userState()));
});

test("persists an explicit true inclusion selection without persisting null", () => {
  const page = loadLiabilityPage();
  page.onShow();
  setForm(page, { outstandingBalance: "30000", monthlyPayment: "900" });
  selectIncluded(page, true);
  page.saveLiability();

  const [saved] = storage.loadState().liabilities;
  assert.equal(saved.includedInEssentialExpense, true);
  assert.equal(Object.values(saved).includes(null), false);
});

test("rejects zero, negative, and non-finite balances without changing storage", () => {
  const page = loadLiabilityPage();
  page.onShow();
  const before = storage.loadState();

  ["0", "-1", "Infinity"].forEach((outstandingBalance) => {
    setForm(page, { outstandingBalance, monthlyPayment: "0" });
    selectIncluded(page, false);
    page.saveLiability();
  });

  assert.equal(global.wx.writeCount, 0);
  assert.deepEqual(storage.loadState(), before);
  assert.equal(global.wx.toasts.length, 3);
  global.wx.toasts.forEach((toast) => {
    assert.equal(toast.title, "请输入大于 0 的有效负债余额");
  });
});

test("allows a zero monthly payment but rejects negative and non-finite monthly payments", () => {
  const page = loadLiabilityPage();
  page.onShow();
  saveValidLiability(page);
  const afterZero = storage.loadState();
  global.wx.resetWriteCount();

  page.editLiability(event({ id: afterZero.liabilities[0].id }));
  setForm(page, { monthlyPayment: "-1" });
  page.saveLiability();
  setForm(page, { monthlyPayment: "Infinity" });
  page.saveLiability();

  assert.equal(global.wx.writeCount, 0);
  assert.deepEqual(storage.loadState(), afterZero);
  assert.equal(global.wx.toasts.at(-1).title, "请输入有效的每月还款金额");
});

test("rejects blank, whitespace, null, and missing monthly payments on create without writes", () => {
  const cases = [
    ["blank", ""],
    ["whitespace", "   "],
    ["null", null],
    ["missing", undefined],
  ];

  cases.forEach(([label, monthlyPayment]) => {
    storage.saveState(userState());
    const page = loadLiabilityPage();
    page.onShow();
    const before = storage.loadState();
    global.wx.resetWriteCount();

    setForm(page, { outstandingBalance: "120000", monthlyPayment });
    selectIncluded(page, false);
    page.saveLiability();

    assert.equal(global.wx.writeCount, 0, `${label} create must not write`);
    assert.deepEqual(storage.loadState(), before, `${label} create must preserve storage`);
    assert.equal(global.wx.toasts.at(-1).title, "请输入有效的每月还款金额");
  });
});

test("rejects blank, whitespace, null, and missing monthly payments on edit without writes", () => {
  const cases = [
    ["blank", ""],
    ["whitespace", "   "],
    ["null", null],
    ["missing", undefined],
  ];

  cases.forEach(([label, monthlyPayment]) => {
    storage.saveState(userState([fixture.validLiabilities[0]], true));
    const page = loadLiabilityPage();
    page.onShow();
    const before = storage.loadState();
    global.wx.resetWriteCount();

    page.editLiability(event({ id: fixture.validLiabilities[0].id }));
    page.onFormInput(event({ field: "monthlyPayment", value: monthlyPayment }));
    page.saveLiability();

    assert.equal(global.wx.writeCount, 0, `${label} edit must not write`);
    assert.deepEqual(storage.loadState(), before, `${label} edit must preserve storage`);
    assert.equal(global.wx.toasts.at(-1).title, "请输入有效的每月还款金额");
  });
});

test("accepts explicit string and numeric zero monthly payments", () => {
  const page = loadLiabilityPage();
  page.onShow();
  saveValidLiability(page);
  const first = storage.loadState().liabilities[0];

  page.editLiability(event({ id: first.id }));
  page.onFormInput(event({ field: "monthlyPayment", value: 0 }));
  page.saveLiability();

  assert.equal(storage.loadState().liabilities[0].monthlyPayment, 0);
});

test("generates a new id and ignores user supplied id and source inputs", () => {
  const page = loadLiabilityPage();
  page.onShow();
  setForm(page, {
    id: "user-controlled-id",
    source: "imported",
    outstandingBalance: "120000",
    monthlyPayment: "0",
  });
  selectIncluded(page, false);
  page.saveLiability();

  const [saved] = storage.loadState().liabilities;
  assert.notEqual(saved.id, "user-controlled-id");
  assert.match(saved.id, /^liability-\d+-\d+$/);
  assert.equal(saved.source, "manual");
  assert.deepEqual(Object.keys(saved).sort(), [
    "id",
    "includedInEssentialExpense",
    "monthlyPayment",
    "note",
    "outstandingBalance",
    "source",
    "type",
  ]);
});

test("regenerates a duplicate timestamp candidate instead of overwriting the existing liability", () => {
  const originalNow = Date.now;
  Date.now = () => 34567;
  try {
    const existing = { ...fixture.validLiabilities[0], id: "liability-34567-1" };
    storage.saveState(userState([existing]));
    const page = loadLiabilityPage();
    page.onShow();
    saveValidLiability(page, { outstandingBalance: "30000" });

    const saved = storage.loadState().liabilities;
    assert.deepEqual(saved.map((item) => item.id), ["liability-34567-1", "liability-34567-2"]);
    assert.equal(saved[0].outstandingBalance, 120000);
    assert.equal(saved[1].outstandingBalance, 30000);
  } finally {
    Date.now = originalNow;
  }
});

test("edits by stable id with one atomic save and revokes only liability completion", () => {
  storage.saveState(userState([fixture.validLiabilities[0]], true));
  const page = loadLiabilityPage();
  page.onShow();
  global.wx.resetWriteCount();

  page.editLiability(event({ id: fixture.validLiabilities[0].id }));
  setForm(page, { outstandingBalance: "130000", source: "imported" });
  page.saveLiability();

  const saved = storage.loadState();
  assert.equal(global.wx.writeCount, 1);
  assert.equal(saved.liabilities.length, 1);
  assert.equal(saved.liabilities[0].id, fixture.validLiabilities[0].id);
  assert.equal(saved.liabilities[0].source, "manual");
  assert.equal(saved.liabilities[0].outstandingBalance, 130000);
  assert.equal(saved.inputCompletion.liabilities, false);
  assert.deepEqual(otherCompletions(saved), otherCompletions(userState()));
});

test("deletes only the selected liability with one atomic save and revokes completion", () => {
  storage.saveState(userState(fixture.validLiabilities, true));
  const page = loadLiabilityPage();
  page.onShow();
  global.wx.resetWriteCount();

  page.deleteLiability(event({ id: fixture.validLiabilities[0].id }));
  assert.equal(global.wx.modals.length, 1);
  global.wx.modals[0].success({ confirm: true, cancel: false });

  const saved = storage.loadState();
  assert.equal(global.wx.writeCount, 1);
  assert.deepEqual(saved.liabilities.map((item) => item.id), [fixture.validLiabilities[1].id]);
  assert.equal(saved.inputCompletion.liabilities, false);
  assert.deepEqual(otherCompletions(saved), otherCompletions(userState()));
});

test("confirms a non-empty valid liability list without changing its facts", () => {
  storage.saveState(userState(fixture.validLiabilities, false));
  const page = loadLiabilityPage();
  page.onShow();
  const beforeFacts = storage.loadState().liabilities;
  global.wx.resetWriteCount();

  page.confirmLiabilities();

  const saved = storage.loadState();
  assert.equal(global.wx.writeCount, 1);
  assert.deepEqual(saved.liabilities, beforeFacts);
  assert.equal(saved.inputCompletion.liabilities, true);
  assert.deepEqual(otherCompletions(saved), otherCompletions(userState()));
});

test("confirms no liabilities only for an empty list", () => {
  const page = loadLiabilityPage();
  page.onShow();
  global.wx.resetWriteCount();

  page.confirmNoLiabilities();

  const saved = storage.loadState();
  assert.equal(global.wx.writeCount, 1);
  assert.deepEqual(saved.liabilities, []);
  assert.equal(saved.inputCompletion.liabilities, true);
});

test("rejects no-liabilities confirmation for a non-empty list without writes", () => {
  storage.saveState(userState(fixture.validLiabilities, false));
  const page = loadLiabilityPage();
  page.onShow();
  const before = storage.loadState();
  global.wx.resetWriteCount();

  page.confirmNoLiabilities();

  assert.equal(global.wx.writeCount, 0);
  assert.deepEqual(storage.loadState(), before);
  assert.equal(global.wx.toasts.at(-1).title, "请先清空或核对负债信息");
});
