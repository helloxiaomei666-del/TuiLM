const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const miniRoot = path.join(__dirname, "..", "wechat-miniapp");
const liabilityPage = "pages/liabilities/liabilities";

function liabilityArtifact(extension) {
  return path.join(miniRoot, `${liabilityPage}.${extension}`);
}

function readLiabilityArtifact(extension) {
  const file = liabilityArtifact(extension);
  assert.ok(existsSync(file), `Task 4 liability page must provide ${liabilityPage}.${extension}`);
  return readFileSync(file, "utf8");
}

function loadPageDefinition(pagePath) {
  let definition = null;
  const previousPage = global.Page;
  global.Page = (config) => {
    definition = config;
  };

  const controller = path.join(miniRoot, pagePath);
  delete require.cache[require.resolve(controller)];
  try {
    require(controller);
  } finally {
    if (previousPage === undefined) delete global.Page;
    else global.Page = previousPage;
  }

  assert.ok(definition, `${pagePath} must register with Page()`);
  return {
    ...definition,
    data: JSON.parse(JSON.stringify(definition.data || {})),
    setData(patch) {
      this.data = { ...this.data, ...patch };
    },
  };
}

function visibleLiterals(source) {
  const values = [];
  const textPattern = /<(?:text|button|view)[^>]*>([^<{]+)<\/(?:text|button|view)>/g;
  const placeholderPattern = /placeholder=["']([^"']+)["']/g;
  for (const match of source.matchAll(textPattern)) values.push(match[1].trim());
  for (const match of source.matchAll(placeholderPattern)) values.push(match[1].trim());
  return values.filter(Boolean).join("\n");
}

test("registers all four liability artifacts as a non-tab page without changing the five tabs", () => {
  const config = JSON.parse(readFileSync(path.join(miniRoot, "app.json"), "utf8"));

  ["js", "json", "wxml", "wxss"].forEach((extension) => {
    assert.ok(existsSync(liabilityArtifact(extension)), `${liabilityPage}.${extension} must exist`);
  });
  assert.ok(config.pages.includes(liabilityPage));
  assert.deepEqual(config.tabBar.list.map((item) => item.pagePath), [
    "pages/overview/overview",
    "pages/assets/assets",
    "pages/security/security",
    "pages/route/route",
    "pages/drags/drags",
  ]);
  assert.equal(config.tabBar.list.some((item) => item.pagePath === liabilityPage), false);

  const pageConfig = JSON.parse(readLiabilityArtifact("json"));
  assert.equal(pageConfig.navigationBarTitleText, "负债");
});

test("adds a Chinese Overview entry with the exact non-tab navigation target", () => {
  const overviewWxml = readFileSync(path.join(miniRoot, "pages/overview/overview.wxml"), "utf8");
  const previousWx = global.wx;
  const navigations = [];
  global.wx = { navigateTo(options) { navigations.push(options); } };
  try {
    const overview = loadPageDefinition("pages/overview/overview.js");
    assert.match(overviewWxml, />负债<\/button>/);
    assert.match(overviewWxml, /bindtap=["']openLiabilities["']/);
    overview.openLiabilities();
    assert.deepEqual(navigations, [{ url: "/pages/liabilities/liabilities" }]);
  } finally {
    if (previousWx === undefined) delete global.wx;
    else global.wx = previousWx;
  }
});

test("renders the required Chinese liability contract and no internal visible values", () => {
  const wxml = readLiabilityArtifact("wxml");
  const visible = visibleLiterals(wxml);

  [
    "负债",
    "负债总额",
    "每月总还款",
    "尚未计入必要支出的月供",
    "负债情况待确认",
    "负债情况已确认",
    "确认以上是我当前完整的负债情况",
    "我目前没有负债",
    "该月供已包含在必要支出中",
    "该月供尚未包含在必要支出中",
    "暂无负债记录",
    "保存负债",
    "编辑",
    "删除",
  ].forEach((copy) => assert.match(visible, new RegExp(copy), `missing visible copy: ${copy}`));

  assert.match(
    wxml,
    /<button[^>]*bindtap=["']confirmNoLiabilities["'][^>]*>我目前没有负债<\/button>/,
  );
  assert.doesNotMatch(
    wxml,
    /<text[^>]*class=["'][^"']*status-text[^"']*["'][^>]*>我目前没有负债<\/text>/,
  );

  assert.doesNotMatch(
    visible,
    /NOT_PROVIDED|CONFIRMED_NONE|PROVIDED|COMPLETE|PARTIAL|INSUFFICIENT|\btrue\b|\bfalse\b|mortgage|car_loan|consumer_loan|credit_card_debt|\bother\b|\bmanual\b|\bliabilities\b|dragItems|effectiveEssentialExpense|investableNetAssets|schemaVersion/,
  );
});

test("maps explicit radio values to booleans while preserving an unresolved null", () => {
  const page = loadPageDefinition("pages/liabilities/liabilities.js");
  const wxml = readLiabilityArtifact("wxml");
  const source = readLiabilityArtifact("js");

  assert.equal(page.data.form.includedInEssentialExpense, null);
  assert.match(wxml, /<radio-group[^>]*bindchange=["']onIncludedInEssentialExpenseUiChange["']/);
  assert.match(wxml, /<radio[^>]*value=["']included["'][^>]*checked=["']\{\{form\.includedInEssentialExpense === true\}\}["']/);
  assert.match(wxml, /<radio[^>]*value=["']excluded["'][^>]*checked=["']\{\{form\.includedInEssentialExpense === false\}\}["']/);
  assert.doesNotMatch(wxml, /<switch\b/);

  ["unexpected", "", undefined].forEach((value) => {
    page.onIncludedInEssentialExpenseUiChange({ detail: { value } });
    assert.equal(page.data.form.includedInEssentialExpense, null);
  });
  page.onIncludedInEssentialExpenseUiChange({ detail: { value: "included" } });
  assert.equal(page.data.form.includedInEssentialExpense, true);
  page.onIncludedInEssentialExpenseUiChange({ detail: { value: "excluded" } });
  assert.equal(page.data.form.includedInEssentialExpense, false);
  page.onIncludedInEssentialExpenseUiChange({ detail: { value: "unexpected" } });
  assert.equal(page.data.form.includedInEssentialExpense, false);

  assert.doesNotMatch(source, /Boolean\s*\(|!!|value\s*\|\|\s*false|value\s*\?\?\s*false/);
});

test("keeps the liability type picker synchronized for new and edited forms", () => {
  const page = loadPageDefinition("pages/liabilities/liabilities.js");
  const wxml = readLiabilityArtifact("wxml");

  assert.equal(page.data.selectedLiabilityTypeIndex, 0);
  assert.equal(page.data.selectedLiabilityTypeLabel, "房贷");
  page.onLiabilityTypeChange({ detail: { value: "3" } });
  assert.equal(page.data.form.type, "credit_card_debt");
  assert.equal(page.data.selectedLiabilityTypeIndex, 3);
  assert.equal(page.data.selectedLiabilityTypeLabel, "信用卡债务");
  assert.match(wxml, /<picker[^>]*value=["']\{\{selectedLiabilityTypeIndex\}\}["']/);
  assert.match(wxml, /\{\{selectedLiabilityTypeLabel\}\}/);
});

test("exposes only raw form fields and exactly the three permitted summary bindings", () => {
  const wxml = readLiabilityArtifact("wxml");
  const editableFields = Array.from(wxml.matchAll(/data-field=["']([^"']+)["']/g), (match) => match[1]);
  const summaryFields = Array.from(
    wxml.matchAll(/summary\.([A-Za-z]+Text)/g),
    (match) => match[1],
  ).sort();

  assert.deepEqual(editableFields.sort(), ["monthlyPayment", "note", "outstandingBalance"]);
  [
    "id",
    "source",
    "mortgage",
    "carLoan",
    "otherDebt",
    "manualDrags",
    "dragItems",
    "effectiveEssentialExpense",
    "investableNetAssets",
  ].forEach((field) => assert.equal(editableFields.includes(field), false));
  assert.deepEqual(summaryFields, [
    "totalLiabilitiesText",
    "totalMonthlyPaymentText",
    "uncoveredMonthlyPaymentText",
  ]);
  assert.doesNotMatch(wxml, /effectiveEssentialExpense|investableNetAssets/);
});

test("keeps legacy monthly-outflow fields in a Chinese readonly reminder", () => {
  const wxml = readLiabilityArtifact("wxml");

  assert.match(wxml, /旧版退休时间测算/);
  assert.match(wxml, /不会编辑或迁移/);
  assert.doesNotMatch(wxml, /data-field=["'](?:mortgage|carLoan|otherDebt|manualDrags)["']/);
});
