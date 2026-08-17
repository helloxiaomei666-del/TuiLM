const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const fixture = require("./fixtures/income-input-phase2.fixture.js");

const miniRoot = path.join(__dirname, "..", "wechat-miniapp");
const incomePage = "pages/income/income";

function readIncomeArtifact(extension) {
  const file = path.join(miniRoot, `${incomePage}.${extension}`);
  assert.ok(existsSync(file), `Phase 2 income page must provide ${incomePage}.${extension}`);
  return readFileSync(file, "utf8");
}

function loadIncomePageDefinition() {
  const controller = path.join(miniRoot, `${incomePage}.js`);
  assert.ok(existsSync(controller), "Phase 2 income page controller must exist before its interaction contract can run");

  let definition = null;
  const previousPage = global.Page;
  global.Page = (config) => {
    definition = config;
  };
  try {
    delete require.cache[require.resolve(controller)];
    require(controller);
  } finally {
    if (previousPage === undefined) delete global.Page;
    else global.Page = previousPage;
  }
  assert.ok(definition, "income page controller must register with Page()");
  return definition;
}

function visibleLiterals(source) {
  const values = [];
  const textPattern = /<(?:text|button|view)[^>]*>([^<{]+)<\/(?:text|button|view)>/g;
  const placeholderPattern = /placeholder=["']([^"']+)["']/g;
  for (const match of source.matchAll(textPattern)) values.push(match[1].trim());
  for (const match of source.matchAll(placeholderPattern)) values.push(match[1].trim());
  return values.filter(Boolean).join("\n");
}

test("registers an independent income page with the standard miniapp page artifacts", () => {
  const config = JSON.parse(readFileSync(path.join(miniRoot, "app.json"), "utf8"));

  assert.ok(config.pages.includes(incomePage), "app.json must register the independent income page");
  ["js", "json", "wxml", "wxss"].forEach((extension) => {
    assert.ok(existsSync(path.join(miniRoot, `${incomePage}.${extension}`)), `${incomePage}.${extension} must exist`);
  });
});

test("offers a Chinese income-source entry from the overview user flow", () => {
  const overviewWxml = readFileSync(path.join(miniRoot, "pages/overview/overview.wxml"), "utf8");
  const overviewJs = readFileSync(path.join(miniRoot, "pages/overview/overview.js"), "utf8");

  assert.match(overviewWxml, /收入来源/, "the overview flow must expose a Chinese income-source entry");
  assert.match(overviewJs, /\/pages\/income\/income/, "the overview entry must navigate to the independent income page");
});

test("renders the income page core actions and empty state in Chinese", () => {
  const wxml = readIncomeArtifact("wxml");

  ["收入来源", "添加收入来源", "编辑", "删除"].forEach((label) => {
    assert.match(wxml, new RegExp(label), `income page must render ${label}`);
  });
  assert.match(wxml, /暂未.*收入|还没有.*收入/, "income page must give users a Chinese empty state");
});

test("does not render internal completeness statuses as income-page text", () => {
  const visible = visibleLiterals(readIncomeArtifact("wxml"));

  assert.doesNotMatch(visible, /NOT_PROVIDED|CONFIRMED_NONE|PROVIDED|COMPLETE|PARTIAL|INSUFFICIENT/);
});

test("does not expose canonical calculated fields as editable income-form inputs", () => {
  const wxml = readIncomeArtifact("wxml");
  const editableFields = Array.from(wxml.matchAll(/data-field=["']([^"']+)["']/g), (match) => match[1]);

  [
    "monthlyAmount",
    "netMonthlyCashflow",
    "eligibleMonthlyPassiveIncome",
    "includedInCoreRate",
    "exclusionReason",
    "originKey",
    "duplicateOfOriginKey",
  ].forEach((field) => {
    assert.equal(editableFields.includes(field), false, `${field} must not be an editable income form field`);
  });
});

test("exposes exactly the eight Phase 2 V1 income types with Chinese display labels", () => {
  const definition = loadIncomePageDefinition();
  const actual = (definition.data.incomeTypeOptions || []).map((option) => [option.value, option.label]);

  assert.deepEqual(actual, fixture.v1IncomeTypeLabels);
});

test("uses Chinese frequency, receipt, and labor options while retaining canonical values internally", () => {
  const definition = loadIncomePageDefinition();
  const frequencies = (definition.data.frequencyOptions || []).map((option) => [option.value, option.label]);
  const receipts = definition.data.actualReceivedOptions || [];
  const labor = definition.data.requiresLaborOptions || [];

  assert.deepEqual(frequencies, [
    ["monthly", "每月"],
    ["quarterly", "每季度"],
    ["annual", "每年"],
  ]);
  assert.deepEqual(receipts.map((option) => option.value), [true, false]);
  assert.deepEqual(labor.map((option) => option.value), [false, true]);
  receipts.forEach((option) => assert.match(option.label, /到账/));
  labor.forEach((option) => assert.match(option.label, /持续.*劳动/));
});

test("provides Chinese factual fields for a rental source and no user-entered net cashflow", () => {
  const wxml = readIncomeArtifact("wxml");

  ["相关税费", "维护费用", "其他必要成本"].forEach((label) => {
    assert.match(wxml, new RegExp(label), `rental income form must render ${label}`);
  });
});

test("defines only Chinese user-facing confirmation, deletion, and validation messages", () => {
  const definition = loadIncomePageDefinition();
  const source = readIncomeArtifact("js");

  assert.equal(typeof definition.confirmIncomeSources, "function", "income page must provide explicit record confirmation");
  assert.equal(typeof definition.confirmNoIncome, "function", "income page must provide explicit confirmed-none action");
  assert.match(source, /确认.*完整.*收入|完整.*收入.*确认/);
  assert.match(source, /目前没有被动收入/);
  assert.match(source, /确认删除.*收入|删除.*收入/);
  assert.match(source, /请输入.*金额|请选择.*收入/);
  assert.doesNotMatch(visibleLiterals(readIncomeArtifact("wxml")), /actualReceived|requiresLabor|eligibleMonthlyPassiveIncome|includedInCoreRate|exclusionReason/);
});
