const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const storage = require("../wechat-miniapp/utils/storage.js");
const { getDefaultState } = require("../wechat-miniapp/utils/demo-data.js");

const securityController = path.join(
  __dirname,
  "..",
  "wechat-miniapp",
  "pages/security/security.js",
);
const securityWxml = path.join(
  __dirname,
  "..",
  "wechat-miniapp",
  "pages/security/security.wxml",
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadSecurityPage() {
  assert.ok(existsSync(securityController), "Security page controller must exist");
  let definition = null;
  const previousPage = global.Page;
  global.Page = (config) => {
    definition = config;
  };
  try {
    delete require.cache[require.resolve(securityController)];
    require(securityController);
  } finally {
    if (previousPage === undefined) delete global.Page;
    else global.Page = previousPage;
  }
  assert.ok(definition, "Security page controller must register with Page()");
  return {
    ...definition,
    data: clone(definition.data || {}),
    setData(patch) {
      this.data = { ...this.data, ...patch };
    },
  };
}

test.beforeEach(() => {
  storage.clearState();
});

test("keeps empty Security facts pending until explicit confirmation", () => {
  const page = loadSecurityPage();
  page.onShow();

  assert.equal(storage.loadState().mode, "user");
  assert.equal(storage.loadState().inputCompletion.protectionAccounts, false);
  assert.match(page.data.securityCompletionText, /待确认/);
});

test("does not auto-confirm a non-empty Security object", () => {
  storage.saveState({
    ...storage.loadState(),
    securityAccounts: { pension: { balance: 120000 } },
  });
  const page = loadSecurityPage();
  page.onShow();

  assert.equal(storage.loadState().inputCompletion.protectionAccounts, false);
  assert.match(page.data.securityCompletionText, /待确认/);
});

test("exposes the explicit full-confirmation action", () => {
  const page = loadSecurityPage();

  assert.equal(typeof page.confirmProtectionAccounts, "function");
});

test("confirms non-empty Security facts only after the explicit full-confirmation action", () => {
  storage.saveState({
    ...storage.loadState(),
    securityAccounts: { pension: { balance: 120000 } },
  });
  const page = loadSecurityPage();
  page.onShow();
  assert.equal(typeof page.confirmProtectionAccounts, "function");

  page.confirmProtectionAccounts();

  assert.equal(storage.loadState().inputCompletion.protectionAccounts, true);
  assert.match(page.data.securityCompletionText, /保障情况已确认/);
});

test("exposes the explicit confirmed-none action", () => {
  const page = loadSecurityPage();

  assert.equal(typeof page.confirmNoProtectionAccounts, "function");
});

test("confirms an explicit no-account answer only when the bridge is empty", () => {
  const page = loadSecurityPage();
  page.onShow();
  assert.equal(typeof page.confirmNoProtectionAccounts, "function");

  page.confirmNoProtectionAccounts();

  assert.equal(storage.loadState().inputCompletion.protectionAccounts, true);
  assert.deepEqual(storage.loadState().securityAccounts, {});
  assert.match(page.data.securityCompletionText, /我目前没有这些保障账户/);
});

test("rejects confirmed-none while valid Security records still exist", () => {
  storage.saveState({
    ...storage.loadState(),
    securityAccounts: { pension: { balance: 120000 } },
  });
  const page = loadSecurityPage();
  page.onShow();
  assert.equal(typeof page.confirmNoProtectionAccounts, "function");

  page.confirmNoProtectionAccounts();

  assert.equal(storage.loadState().inputCompletion.protectionAccounts, false);
  assert.deepEqual(storage.loadState().securityAccounts.pension, { balance: 120000 });
});

test("invalidates a confirmed Security section after a managed fact changes", () => {
  storage.saveState({
    ...storage.loadState(),
    securityAccounts: { pension: { balance: 120000 } },
    inputCompletion: {
      ...storage.loadState().inputCompletion,
      protectionAccounts: true,
    },
  });
  const page = loadSecurityPage();
  page.onShow();
  page.onSecurityInput({
    currentTarget: { dataset: { key: "pension.balance" } },
    detail: { value: "130000" },
  });

  assert.equal(storage.loadState().inputCompletion.protectionAccounts, false);
  assert.match(page.data.securityCompletionText, /待确认/);
});

test("adds only Chinese confirmation copy to the Security page", () => {
  const visibleSources = [
    readFileSync(securityController, "utf8"),
    readFileSync(securityWxml, "utf8"),
  ].join("\n");
  const requiredCopy = [
    "保障情况待确认",
    "保障情况已确认",
    "确认以上是我当前完整的保障情况",
    "我目前没有这些保障账户",
    "确认表示你已检查当前页面内容；不会把预计月领计入当前被动收入。",
    "请先清空或核对保障账户信息",
  ];
  const missingCopy = requiredCopy.filter((text) => !visibleSources.includes(text));
  assert.deepEqual(missingCopy, []);

  const forbiddenVisibleStates = [
    "CONFIRMED_NONE",
    "NOT_PROVIDED",
    "COMPLETE",
    "PARTIAL",
    "INSUFFICIENT",
    "social_security",
    "welfare_asset",
  ].filter((text) => visibleSources.includes(text));
  assert.deepEqual(forbiddenVisibleStates, []);

  const visibleTemplateText = readFileSync(securityWxml, "utf8")
    .replace(/<[^>]*>/g, " ")
    .replace(/\{\{[^}]*\}\}/g, " ");
  const forbiddenTemplateStates = [
    "protectionAccounts",
    "social_security",
    "welfare_asset",
    "CONFIRMED_NONE",
    "NOT_PROVIDED",
    "COMPLETE",
    "PARTIAL",
    "INSUFFICIENT",
    "true",
    "false",
  ].filter((text) => visibleTemplateText.includes(text));
  assert.deepEqual(forbiddenTemplateStates, []);
});

test("keeps protectionAccounts derived instead of persisted in the raw state", () => {
  const stateBeforeSave = {
    ...storage.loadState(),
    securityAccounts: { pension: { balance: 120000 } },
  };
  storage.saveState(stateBeforeSave);
  const state = storage.loadState();

  assert.equal(Object.prototype.hasOwnProperty.call(state, "protectionAccounts"), false);
  assert.deepEqual(state.securityAccounts, stateBeforeSave.securityAccounts);
});

test("preserves existing demo raw facts without treating them as user confirmation", () => {
  const demo = getDefaultState();
  storage.saveState(demo);
  const page = loadSecurityPage();
  page.onShow();

  assert.equal(storage.loadState().mode, "demo");
  assert.equal(storage.loadState().inputCompletion.protectionAccounts, false);
  assert.ok(Object.keys(storage.loadState().securityAccounts).length > 0);
  assert.match(page.data.securityCompletionText, /待确认/);
});
