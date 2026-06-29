const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const calc = require("../wechat-miniapp/utils/calculation-core.js");
const storage = require("../wechat-miniapp/utils/storage.js");
const { getOverviewModel } = require("../wechat-miniapp/utils/overview-model.js");

const repoRoot = path.join(__dirname, "..");
const miniRoot = path.join(repoRoot, "wechat-miniapp");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createWxMock() {
  const store = new Map();
  const navigations = [];
  const tabSwitches = [];
  const scrolls = [];
  return {
    navigations,
    tabSwitches,
    scrolls,
    getStorageSync(key) {
      return store.has(key) ? clone(store.get(key)) : undefined;
    },
    setStorageSync(key, value) {
      store.set(key, clone(value));
    },
    removeStorageSync(key) {
      store.delete(key);
    },
    navigateTo(options) {
      navigations.push(options);
    },
    switchTab(options) {
      tabSwitches.push(options);
    },
    pageScrollTo(options) {
      scrolls.push(options);
    },
  };
}

function event({ category, field, group, key, id, page, value }) {
  const dataset = {};
  if (category) dataset.category = category;
  if (field) dataset.field = field;
  if (group) dataset.group = group;
  if (key) dataset.key = key;
  if (id) dataset.id = id;
  if (page) dataset.page = page;
  return {
    currentTarget: { dataset },
    detail: { value },
  };
}

function loadPage(pagePath) {
  let definition = null;
  const previousPage = global.Page;
  global.Page = (config) => {
    definition = config;
  };

  const absolutePath = path.join(miniRoot, pagePath);
  delete require.cache[require.resolve(absolutePath)];
  try {
    require(absolutePath);
  } finally {
    global.Page = previousPage;
  }

  assert.ok(definition, `${pagePath} should call Page()`);

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

test.beforeEach(() => {
  global.wx = createWxMock();
  storage.clearState();
});

test.afterEach(() => {
  storage.clearState();
  delete global.wx;
});

test("overview page updates inputs, clears data, and opens legal page", () => {
  const page = loadPage("pages/overview/overview.js");
  [
    "currentAssetsText",
    "monthlyInvestableText",
    "todayPnlText",
    "securityTotalText",
    "statusText",
    "cashflowTitle",
    "cashflowText",
    "freedomDate",
    "cashflowRetirementRateText",
    "cashflowRetirementProgressWidth",
    "assetRetirementRateText",
    "runwayMonthsText",
    "laborDependenceRateText",
    "monthlyPassiveIncomeText",
    "cashflowHeadlineText",
    "cashflowDenominatorText",
    "cashflowDisclosureText",
  ].forEach((key) => {
    assert.equal(typeof page.data.overview[key], "string", `overview.${key} should be a string before first load`);
  });
  page.onLoad();
  assert.equal(page.data.isEditingProfile, false);
  assert.equal(page.data.showAdvancedProfile, false);

  page.toggleEditPanel();
  assert.equal(page.data.isEditingProfile, true);
  page.toggleAdvancedProfile();
  assert.equal(page.data.showAdvancedProfile, true);
  page.toggleEditPanel();
  assert.equal(page.data.isEditingProfile, false);
  assert.equal(page.data.showAdvancedProfile, false);

  page.onProfileInput(event({ field: "salary", value: "23456.78" }));
  assert.equal(storage.loadState().userProfile.salary, 23456.78);
  assert.equal(page.data.profile.salary, 23456.78);

  page.onProfileInput(event({ field: "targetMonthlyLivingCost", value: "7000" }));
  assert.equal(storage.loadState().userProfile.targetMonthlyLivingCost, 7000);
  assert.equal(page.data.profile.targetMonthlyLivingCost, 7000);

  page.onProfileInput(event({ field: "salaryYear3", value: "0" }));
  page.onProfileInput(event({ field: "salaryYear2", value: "0" }));
  page.onProfileInput(event({ field: "salaryYear1", value: "10000" }));
  page.onProfileInput(event({ field: "salary", value: "11000" }));
  assert.equal(storage.loadState().userProfile.salaryYear3, 0);
  assert.equal(storage.loadState().userProfile.salaryYear2, 0);
  assert.equal(storage.loadState().userProfile.salaryYear1, 10000);
  assert.equal(page.data.overview.salaryGrowthText, "10.0%");

  page.openLegal();
  assert.deepEqual(global.wx.navigations[0], { url: "/pages/legal/legal" });

  page.goTab(event({ page: "assets" }));
  page.goTab(event({ page: "security" }));
  page.goTab(event({ page: "route" }));
  page.goTab(event({ page: "drags" }));
  assert.deepEqual(global.wx.tabSwitches, [
    { url: "/pages/assets/assets" },
    { url: "/pages/security/security" },
    { url: "/pages/route/route" },
    { url: "/pages/drags/drags" },
  ]);

  page.clearLocalData();
  assert.notEqual(page.data.state, null);
});

test("assets page gates OCR until confirmation and supports add refresh delete", () => {
  const page = loadPage("pages/assets/assets.js");
  page.onShow();
  const initialCount = page.data.holdings.length;
  assert.equal(page.data.isFormOpen, false);
  assert.ok(page.data.summary.allocationRows.length >= 4);

  page.toggleAssetForm();
  assert.equal(page.data.isFormOpen, true);
  page.toggleAssetForm();
  assert.equal(page.data.isFormOpen, false);

  page.simulateOcr();
  assert.ok(page.data.pendingOcr);
  page.onPendingOcrInput(event({ field: "quantity", value: "1234.56" }));
  page.onPendingOcrInput(event({ field: "currentPrice", value: "2.34" }));
  assert.equal(page.data.pendingOcr.quantity, "1234.56");
  assert.equal(page.data.pendingOcr.currentPrice, "2.34");
  page.addHolding();
  assert.equal(storage.loadState().holdings.length, initialCount);

  page.confirmOcr();
  assert.equal(page.data.pendingOcr, null);
  assert.equal(page.data.form.code, "000300");
  assert.equal(page.data.form.quantity, "1234.56");
  assert.equal(page.data.form.currentPrice, "2.34");

  page.addHolding();
  const added = storage.loadState().holdings[0];
  assert.equal(storage.loadState().holdings.length, initialCount + 1);
  assert.equal(page.data.isFormOpen, false);

  page.editHolding(event({ id: added.id }));
  assert.equal(page.data.editingHoldingId, added.id);
  assert.equal(page.data.formActionText, "保存修改");
  assert.equal(page.data.isFormOpen, true);
  assert.deepEqual(global.wx.scrolls[0], { selector: "#assetEditForm", duration: 220 });
  page.onFormInput(event({ field: "amount", value: "130000" }));
  page.saveHolding();
  const editedState = storage.loadState();
  const editedAdded = editedState.holdings.find((item) => item.id === added.id);
  const editedSnapshot = editedState.valuationSnapshots[0];
  assert.equal(editedState.holdings.length, initialCount + 1);
  assert.equal(editedState.valuationSnapshots.length, 1);
  assert.equal(editedAdded.currentValue, 130000);
  assert.equal(editedAdded.currentPrice, 130000 / Number(editedAdded.quantity));
  assert.equal(editedSnapshot.totalValue, calc.getHoldingTotals(editedState.holdings).total);
  assert.equal(editedSnapshot.items.find((item) => item.holdingId === added.id).currentValue, 130000);
  assert.equal(page.data.summary.totalText, page.data.summary.valuationTotalText);
  assert.equal(getOverviewModel(editedState).result.currentAssets, editedSnapshot.totalValue);
  assert.equal(page.data.editingHoldingId, "");
  assert.equal(page.data.isFormOpen, false);

  page.refreshQuotes();
  const refreshedState = storage.loadState();
  const refreshedAdded = refreshedState.holdings.find((item) => item.id === added.id);
  const refreshedCash = refreshedState.holdings.find((item) => item.type === "cash");
  assert.equal(refreshedState.holdings.length, initialCount + 1);
  assert.equal(refreshedState.valuationSnapshots.length, 1);
  assert.equal(refreshedAdded.quoteStatus, "ok");
  assert.equal(refreshedAdded.source, "local mock quote adapter");
  assert.equal(refreshedCash.quoteStatus, "skipped");
  assert.equal(typeof page.data.summary.quoteStatusText, "string");
  assert.equal(typeof page.data.summary.valuationChangeText, "string");
  assert.equal(typeof page.data.summary.valuationStatusText, "string");

  page.deleteHolding(event({ id: added.id }));
  assert.equal(storage.loadState().holdings.some((item) => item.id === added.id), false);
});

test("security page saves account input without changing investable assets", () => {
  const overview = loadPage("pages/overview/overview.js");
  overview.onLoad();
  const beforeAssets = overview.data.overview.currentAssetsText;

  const page = loadPage("pages/security/security.js");
  page.onShow();
  assert.ok(page.data.groups.length >= 5);
  assert.equal(page.data.selectedSecurityCategoryKey, "socialSecurity");
  assert.equal(page.data.selectedSecurityGroupKey, "pension");
  assert.equal(page.data.selectedCategory.title, "社会保障");
  assert.equal(page.data.selectedCategory.countText, "4 项");
  assert.equal(page.data.selectedGroup.title, "基本养老保险");
  assert.equal(page.data.selectedGroup.retirementRole, "stable_retirement_cashflow");
  assert.ok(
    page.data.groups.some(
      (group) => group.key === "pension" && group.fields.some((field) => field.key === "pension.balance"),
    ),
  );

  page.onSecurityInput(event({ key: "pension.balance", value: "222222.22" }));

  assert.equal(storage.loadState().securityAccounts.pension.balance, 222222.22);
  const pensionGroup = page.data.groups.find((group) => group.key === "pension");
  assert.match(pensionGroup.balanceText, /万|元/);
  assert.match(page.data.summary.impactText, /预计退休后月领|退休保障/);

  page.switchSecurityCategory(event({ category: "welfareAsset" }));
  assert.equal(page.data.selectedSecurityCategoryKey, "welfareAsset");
  assert.equal(page.data.selectedSecurityGroupKey, "housingFund");
  assert.equal(page.data.selectedCategory.title, "福利资产");
  assert.ok(page.data.groupsInCategory.some((group) => group.key === "housingFund"));
  assert.equal(page.data.groupsInCategory.some((group) => group.key === "enterpriseAnnuity"), false);

  page.switchSecurityCategory(event({ category: "socialSecurity" }));
  page.switchSecurityGroup(event({ group: "enterpriseAnnuity" }));
  assert.equal(page.data.selectedGroup.title, "企业年金");
  assert.equal(page.data.selectedGroup.calculationRole, "retirement_cashflow");
  page.onSecurityInput(event({ key: "enterpriseAnnuity.balance", value: "33333" }));
  assert.equal(storage.loadState().securityAccounts.enterpriseAnnuity.balance, 33333);

  overview.onShow();
  assert.equal(overview.data.overview.currentAssetsText, beforeAssets);
});

test("route page loads yearly points and changes selected year", () => {
  const page = loadPage("pages/route/route.js");
  page.onShow();

  assert.ok(page.data.years.length > 1);
  const first = page.data.selected.title;
  const firstChart = page.data.chart.points.map((item) => `${item.index}:${item.stateClass}`).join("|");
  const firstDiagnosis = page.data.diagnosis.title;
  assert.ok(page.data.chart.points.length >= 3);
  assert.match(page.data.chart.targetLineBottom, /%$/);
  assert.match(page.data.chart.reachedText, /达成目标|暂未达成/);
  assert.equal(page.data.diagnosis.cards.length, 3);

  page.onYearChanging({ detail: { value: 1 } });
  assert.equal(page.data.selectedIndex, 1);
  assert.notEqual(page.data.selected.title, first);
  assert.equal(page.data.chart.points.map((item) => `${item.index}:${item.stateClass}`).join("|"), firstChart);
  assert.notEqual(page.data.diagnosis.title, firstDiagnosis);
  assert.ok(page.data.diagnosis.trajectory.length >= 1);

  page.onYearChange({ detail: { value: 1 } });
  assert.equal(page.data.selectedIndex, 1);
  assert.notEqual(page.data.selected.title, first);
});

test("drags page accepts decimal monthly amounts and supports edit delete", () => {
  const page = loadPage("pages/drags/drags.js");
  page.onShow();
  assert.equal(page.data.summary.total, 0);
  assert.equal(page.data.dragTotalText, page.data.summary.totalText);

  page.onCategoryChange({ detail: { value: 1 } });
  page.onFormInput(event({ field: "amount", value: "123.45" }));
  page.onFormInput(event({ field: "title", value: "decimal drag" }));
  page.addDrag();

  const saved = storage.loadState().manualDrags[0];
  assert.equal(saved.amount, 123.45);
  assert.equal(page.data.summary.total, 123.45);
  assert.equal(page.data.dragTotalText, page.data.summary.totalText);
  assert.match(page.data.summary.savedMonthsText, /\d+ 个月|年/);
  assert.ok(page.data.summary.categoryRows.length >= 1);
  assert.equal(page.data.summary.topDragTitle, "房贷");
  assert.equal(page.data.drags[0].categoryLabel, "房贷");
  assert.match(page.data.drags[0].impactClass, /impact-/);

  page.editDrag(event({ id: saved.id }));
  assert.equal(page.data.editingDragId, saved.id);
  assert.equal(page.data.formActionText, "保存修改");
  assert.deepEqual(global.wx.scrolls[0], { selector: "#dragEditForm", duration: 220 });
  page.onFormInput(event({ field: "amount", value: "456.78" }));
  page.saveDrag();

  const editedState = storage.loadState();
  const edited = editedState.manualDrags.find((item) => item.id === saved.id);
  assert.equal(editedState.manualDrags.length, 1);
  assert.equal(edited.amount, 456.78);
  assert.equal(page.data.summary.total, 456.78);
  assert.equal(getOverviewModel(editedState).values.manualDragOutflow, 456.78);
  assert.equal(page.data.editingDragId, "");
  assert.equal(page.data.summary.categoryRows[0].type, "mortgage");

  page.deleteDrag(event({ id: saved.id }));
  assert.equal(storage.loadState().manualDrags.some((item) => item.id === saved.id), false);
  assert.equal(page.data.summary.total, 0);
  assert.equal(page.data.dragTotalText, page.data.summary.totalText);
  assert.equal(page.data.summary.categoryRows.length, 0);
});
