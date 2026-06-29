const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { existsSync, readdirSync, readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const miniRoot = path.join(__dirname, "..", "wechat-miniapp");
const calc = require("../wechat-miniapp/utils/calculation-core.js");
const storage = require("../wechat-miniapp/utils/storage.js");
const { getDefaultState } = require("../wechat-miniapp/utils/demo-data.js");
const { getOverviewModel, buildCalculationValues } = require("../wechat-miniapp/utils/overview-model.js");
const valuation = require("../wechat-miniapp/utils/valuation-model.js");
const {
  decorateHoldings,
  getAssetSummary,
  getAssetFormFromHolding,
  getMockOcrResult,
  normalizeAssetForm,
  refreshHoldings,
  upsertAssetHolding,
} = require("../wechat-miniapp/utils/asset-model.js");
const { decorateDrags, getDragSummary, normalizeDragForm } = require("../wechat-miniapp/utils/drag-model.js");
const {
  buildSecurityForm,
  getSecurityCategoryView,
  getSecurityGroups,
  getSecuritySummary,
  updateSecurityField,
} = require("../wechat-miniapp/utils/security-model.js");
const {
  getRouteChart,
  getRouteDiagnostics,
  getRouteYears,
  getSelectedRouteYear,
} = require("../wechat-miniapp/utils/route-model.js");

function walkFiles(dir, predicate = () => true) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(file, predicate);
    return predicate(file) ? [file] : [];
  });
}

test("wechat miniapp declares five expected tab pages", () => {
  const config = JSON.parse(readFileSync(path.join(miniRoot, "app.json"), "utf8"));
  const pageSet = new Set(config.pages);
  const tabPages = config.tabBar.list.map((item) => item.pagePath);

  assert.deepEqual(tabPages, [
    "pages/overview/overview",
    "pages/assets/assets",
    "pages/security/security",
    "pages/route/route",
    "pages/drags/drags",
  ]);
  tabPages.forEach((page) => assert.ok(pageSet.has(page), `${page} should be in pages`));
  config.tabBar.list.forEach((item) => {
    assert.ok(existsSync(path.join(miniRoot, item.iconPath)), `${item.iconPath} should exist`);
    assert.ok(existsSync(path.join(miniRoot, item.selectedIconPath)), `${item.selectedIconPath} should exist`);
  });
});

test("wechat miniapp page files exist for each declared page", () => {
  const config = JSON.parse(readFileSync(path.join(miniRoot, "app.json"), "utf8"));
  config.pages.forEach((page) => {
    ["js", "json", "wxml", "wxss"].forEach((ext) => {
      assert.ok(existsSync(path.join(miniRoot, `${page}.${ext}`)), `${page}.${ext} should exist`);
    });
  });
});

test("tab pages keep 393px-safe spacing and visual primitives", () => {
  const appWxss = readFileSync(path.join(miniRoot, "app.wxss"), "utf8");
  const tabPageClasses = {
    "pages/overview/overview": "overview-page",
    "pages/assets/assets": "asset-page",
    "pages/security/security": "security-page",
    "pages/route/route": "route-page",
    "pages/drags/drags": "drag-page",
  };
  const wxssFiles = [
    path.join(miniRoot, "app.wxss"),
    ...Object.keys(tabPageClasses).map((page) => path.join(miniRoot, `${page}.wxss`)),
  ];

  assert.match(appWxss, /letter-spacing:\s*0;/);
  Object.entries(tabPageClasses).forEach(([page, className]) => {
    const source = readFileSync(path.join(miniRoot, `${page}.wxss`), "utf8");
    assert.match(source, new RegExp(`\\.${className}\\s*\\{[\\s\\S]*?padding-bottom:\\s*136rpx;`), `${page} should reserve tabbar space`);
  });

  wxssFiles.forEach((file) => {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /display\s*:\s*grid|::before|::after|font-size\s*:\s*[^;]*vw/, `${file} should avoid miniapp layout risks`);
    const letterSpacingRules = source.match(/letter-spacing:\s*[^;]+;/g) || [];
    letterSpacingRules.forEach((rule) => assert.match(rule, /letter-spacing:\s*0;/, `${file} should not use non-zero letter spacing`));

    for (const match of source.matchAll(/border-radius:\s*(\d+)rpx/g)) {
      const radius = Number(match[1]);
      assert.ok(radius <= 16 || radius >= 100, `${file} should keep card radii at 16rpx or use pill radius`);
    }
  });
});

test("miniapp final copy avoids prototype wording in visible surfaces", () => {
  const wxmlFiles = walkFiles(path.join(miniRoot, "pages"), (file) => file.endsWith(".wxml"));
  const legalJs = readFileSync(path.join(miniRoot, "pages/legal/legal.js"), "utf8");
  const assetsJs = readFileSync(path.join(miniRoot, "pages/assets/assets.js"), "utf8");
  const assetModel = readFileSync(path.join(miniRoot, "utils/asset-model.js"), "utf8");
  const quoteClient = readFileSync(path.join(miniRoot, "utils/quote-client.js"), "utf8");

  wxmlFiles.forEach((file) => {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /MVP|Demo|刷新估值 Demo|模拟截图识别|>清除</, `${file} should use final product copy`);
  });
  assert.match(readFileSync(path.join(miniRoot, "pages/overview/overview.wxml"), "utf8"), /清除本地数据/);
  assert.match(readFileSync(path.join(miniRoot, "pages/assets/assets.wxml"), "utf8"), /刷新估值/);
  assert.match(readFileSync(path.join(miniRoot, "pages/legal/legal.wxml"), "utf8"), /使用边界/);
  assert.doesNotMatch(legalJs, /当前 MVP|MVP 草案/);
  assert.doesNotMatch(assetsJs, /模拟识别结果/);
  assert.doesNotMatch(assetModel, /本地 Demo/);
  assert.doesNotMatch(quoteClient, /本地 Demo/);
});

test("wechat miniapp JS avoids risky modern syntax", () => {
  const jsFiles = walkFiles(miniRoot, (file) => file.endsWith(".js"));
  jsFiles.forEach((file) => {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /\?\./, `${file} should not use optional chaining`);
    assert.doesNotMatch(source, /\?\?/, `${file} should not use nullish coalescing`);
  });
});

test("miniapp string components declare empty string defaults", () => {
  [
    path.join(miniRoot, "components/metric-card/metric-card.js"),
    path.join(miniRoot, "components/section-card/section-card.js"),
  ].forEach((file) => {
    const source = readFileSync(file, "utf8");
    assert.match(source, /type:\s*String/);
    assert.match(source, /value:\s*""/);
  });
});

test("overview page uses cashflow-first four-rate layout with folded profile editing", () => {
  const overviewWxml = readFileSync(path.join(miniRoot, "pages/overview/overview.wxml"), "utf8");
  const overviewConfig = JSON.parse(readFileSync(path.join(miniRoot, "pages/overview/overview.json"), "utf8"));

  assert.match(overviewWxml, /退休状态总览/);
  assert.match(overviewWxml, /现金流退休率/);
  assert.match(overviewWxml, /完全被动收入/);
  assert.match(overviewWxml, /资产退休率/);
  assert.match(overviewWxml, /安全垫月数/);
  assert.match(overviewWxml, /劳动依赖率/);
  assert.match(overviewWxml, /class="hero-panel cashflow-hero"/);
  assert.equal((overviewWxml.match(/class="rate-card"/g) || []).length, 3);
  assert.match(overviewWxml, /cashflowRetirementRateText/);
  assert.match(overviewWxml, /assetRetirementRateText/);
  assert.match(overviewWxml, /runwayMonthsText/);
  assert.match(overviewWxml, /laborDependenceRateText/);
  assert.match(overviewWxml, /cashflowHeadlineText/);
  assert.match(overviewWxml, /cashflowDisclosureText/);
  assert.match(overviewWxml, /class="legacy-panel"/);
  assert.match(overviewWxml, /预计退休时间/);
  assert.match(overviewWxml, /目标差额/);
  assert.match(overviewWxml, /下一步行动/);
  assert.match(overviewWxml, /补充资产/);
  assert.match(overviewWxml, /完善保障/);
  assert.match(overviewWxml, /查看路线/);
  assert.match(overviewWxml, /检查拖累项/);
  assert.match(overviewWxml, /bindtap="goTab"/);
  assert.match(overviewWxml, /data-page="assets"/);
  assert.match(overviewWxml, /data-page="security"/);
  assert.match(overviewWxml, /data-page="route"/);
  assert.match(overviewWxml, /data-page="drags"/);
  assert.match(overviewWxml, /拖累项/);
  assert.match(overviewWxml, /dragTotalText/);
  assert.match(overviewWxml, /dragCountText/);
  assert.match(overviewWxml, /基础数据/);
  assert.match(overviewWxml, /编辑基础数据/);
  assert.match(overviewWxml, /isEditingProfile/);
  assert.match(overviewWxml, /showAdvancedProfile/);
  assert.match(overviewWxml, /bindtap="toggleEditPanel"/);
  assert.match(overviewWxml, /bindtap="toggleAdvancedProfile"/);
  assert.doesNotMatch(overviewWxml, /class="action-row"/);
  assert.doesNotMatch(overviewWxml, /open-type="switchTab"/);
  assert.match(overviewWxml, /class="head-actions"/);
  assert.match(overviewWxml, /data-field="salaryYear3"/);
  assert.match(overviewWxml, /data-field="salaryYear2"/);
  assert.match(overviewWxml, /data-field="salaryYear1"/);
  assert.match(overviewWxml, /data-field="targetMonthlyLivingCost"/);
  assert.ok(overviewWxml.indexOf('class="edit-summary"') < overviewWxml.indexOf('class="edit-body"'));
  assert.doesNotMatch(overviewWxml, /<metric-card/);
  assert.doesNotMatch(overviewWxml, /<section-card/);
  assert.deepEqual(overviewConfig.usingComponents, undefined);
});

test("route page uses a visual route map before diagnostics", () => {
  const routeWxml = readFileSync(path.join(miniRoot, "pages/route/route.wxml"), "utf8");
  const routeWxss = readFileSync(path.join(miniRoot, "pages/route/route.wxss"), "utf8");

  assert.match(routeWxml, /class="card route-hero"/);
  assert.match(routeWxml, /class="chart-panel"/);
  assert.match(routeWxml, /class="target-line"/);
  assert.match(routeWxml, /chart.targetLineBottom/);
  assert.match(routeWxml, /chart.points/);
  assert.match(routeWxml, /class="chart-point/);
  assert.match(routeWxml, /class="bar-fill"/);
  assert.match(routeWxml, /class="selected-grid"/);
  assert.match(routeWxml, /拖动选择年份/);
  assert.doesNotMatch(routeWxss, /\.chart-point\.is-selected/);
  assert.doesNotMatch(routeWxss, /\.chart-point\.is-reached[\s\S]*\.bar-fill/);
  assert.match(routeWxml, /diagnosis.cards/);
  assert.match(routeWxml, /diagnosis.trajectory/);
  assert.ok(routeWxml.indexOf('class="chart-panel"') < routeWxml.indexOf("route-diagnosis"));
  assert.doesNotMatch(routeWxss, /display\s*:\s*grid/);
  assert.doesNotMatch(routeWxss, /::before|::after|conic-gradient|radial-gradient|var\(/);
});

test("asset holdings use non-overlapping delete action layout", () => {
  const assetsWxml = readFileSync(path.join(miniRoot, "pages/assets/assets.wxml"), "utf8");
  const assetsWxss = readFileSync(path.join(miniRoot, "pages/assets/assets.wxss"), "utf8");

  assert.match(assetsWxml, /class="summary-metrics"/);
  assert.match(assetsWxml, /summary\.allocationRows/);
  assert.match(assetsWxml, /class="allocation-panel"/);
  assert.match(assetsWxml, /asset-entry-cta/);
  assert.match(assetsWxml, /wx:if="\{\{!isFormOpen\}\}"/);
  assert.match(assetsWxml, /wx:if="\{\{isFormOpen\}\}" id="assetEditForm"/);
  assert.match(assetsWxml, /bindtap="openAssetForm"/);
  assert.match(assetsWxml, /bindtap="toggleAssetForm"/);
  assert.match(assetsWxml, /class="holding-main"/);
  assert.match(assetsWxml, /class="holding-quote/);
  assert.match(assetsWxml, /quoteStatusText/);
  assert.match(assetsWxml, /valuationChangeText/);
  assert.match(assetsWxml, /valuationStatusText/);
  assert.match(assetsWxml, /刷新估值/);
  assert.match(assetsWxml, /<view class="edit-chip"[\s\S]*bindtap="editHolding"/);
  assert.match(assetsWxml, /<view class="delete-chip"[\s\S]*bindtap="deleteHolding"/);
  assert.doesNotMatch(assetsWxml, /<button class="edit-chip"/);
  assert.doesNotMatch(assetsWxml, /<button class="delete-chip"/);
  assert.match(assetsWxml, /id="assetEditForm"/);
  assert.doesNotMatch(assetsWxml, /class="delete-button"/);
  assert.doesNotMatch(assetsWxss, /\.delete-button/);
  assert.doesNotMatch(assetsWxss, /position:\s*absolute/);
  assert.match(assetsWxss, /\.edit-chip\s*,\s*\n\.delete-chip\s*\{[\s\S]*border:\s*0/);
  assert.match(assetsWxss, /\.edit-chip\s*,\s*\n\.delete-chip\s*\{[\s\S]*width:\s*72rpx/);
  assert.match(assetsWxss, /\.edit-chip\s*,\s*\n\.delete-chip\s*\{[\s\S]*min-width:\s*0/);
  assert.match(assetsWxss, /\.holding-quote\s*\{/);
  assert.match(assetsWxss, /\.allocation-fill\s*\{/);
  assert.match(assetsWxss, /\.asset-entry-cta\s*\{/);
});

test("security page groups inputs and explains account impact", () => {
  const securityWxml = readFileSync(path.join(miniRoot, "pages/security/security.wxml"), "utf8");
  const securityWxss = readFileSync(path.join(miniRoot, "pages/security/security.wxss"), "utf8");

  assert.match(securityWxml, /class="card security-hero"/);
  assert.match(securityWxml, /退休保障/);
  assert.match(securityWxml, /社会保障/);
  assert.match(securityWxml, /福利资产/);
  assert.match(securityWxml, /退休能力/);
  assert.match(securityWxml, /summary\.impactText/);
  assert.match(securityWxml, /summary\.pensionGapText/);
  assert.match(securityWxml, /supportFactorText/);
  assert.match(securityWxml, /class="security-metrics"/);
  assert.match(securityWxml, /按退休作用分类录入/);
  assert.doesNotMatch(securityWxml, /先选“保险”或“金”/);
  assert.match(securityWxml, /security-category-tabs/);
  assert.match(securityWxml, /securityCategories/);
  assert.match(securityWxml, /switchSecurityCategory/);
  assert.match(securityWxml, /groupsInCategory/);
  assert.match(securityWxml, /switchSecurityGroup/);
  assert.match(securityWxml, /selectedCategory\.note/);
  assert.match(securityWxml, /selectedGroup/);
  assert.match(securityWxml, /wx:for-item="group"/);
  assert.match(securityWxml, /wx:for="\{\{selectedGroup\.fields\}\}"/);
  assert.match(securityWxml, /wx:for-item="field"/);
  assert.match(securityWxml, /data-key="\{\{field\.key\}\}"/);
  assert.doesNotMatch(securityWxml, /wx:for="\{\{groups\}\}"[\s\S]*wx:for="\{\{group\.fields\}\}"/);
  assert.ok(securityWxml.indexOf('class="impact-panel"') < securityWxml.indexOf('class="card security-form"'));
  assert.doesNotMatch(securityWxss, /display\s*:\s*grid/);
  assert.doesNotMatch(securityWxss, /::before|::after|conic-gradient|radial-gradient|var\(/);
  assert.match(securityWxss, /\.security-category-tabs/);
  assert.match(securityWxss, /\.submenu-chip\.is-active/);
});

test("drag rows expose compact edit and delete actions", () => {
  const dragsJs = readFileSync(path.join(miniRoot, "pages/drags/drags.js"), "utf8");
  const dragsWxml = readFileSync(path.join(miniRoot, "pages/drags/drags.wxml"), "utf8");
  const dragsWxss = readFileSync(path.join(miniRoot, "pages/drags/drags.wxss"), "utf8");

  assert.match(dragsWxml, /class="card drag-hero"/);
  assert.match(dragsWxml, /summary\.headlineText/);
  assert.match(dragsWxml, /summary\.savedMonthsText/);
  assert.match(dragsWxml, /class="priority-card \{\{summary\.topDragClass\}\}"/);
  assert.match(dragsWxml, /summary\.categoryRows/);
  assert.match(dragsWxml, /class="category-fill \{\{item\.className\}\}"/);
  assert.match(dragsWxml, /class="drag-impact-pill \{\{item\.impactClass\}\}"/);
  assert.match(dragsWxml, /item\.categoryLabel/);
  assert.match(dragsWxml, /item\.impactText/);
  assert.match(dragsWxml, /id="dragEditForm"/);
  assert.match(dragsWxml, /class="drag-actions"/);
  assert.match(dragsWxml, /class="edit-chip"[\s\S]*bindtap="editDrag"/);
  assert.match(dragsWxml, /class="delete-chip"[\s\S]*bindtap="deleteDrag"/);
  assert.match(dragsJs, /formActionText:\s*"保存修改"/);
  assert.doesNotMatch(dragsWxml, /class="delete-button"/);
  assert.doesNotMatch(dragsWxss, /\.delete-button/);
  assert.doesNotMatch(dragsWxss, /position:\s*absolute/);
  assert.doesNotMatch(dragsWxss, /display\s*:\s*grid/);
  assert.doesNotMatch(dragsWxss, /::before|::after|conic-gradient|radial-gradient|var\(/);
  assert.match(dragsWxss, /\.priority-card\.impact-high/);
  assert.match(dragsWxss, /\.category-track\s*\{/);
  assert.match(dragsWxss, /\.drag-actions\s*\{[\s\S]*width:\s*72rpx/);
  assert.match(dragsWxss, /\.edit-chip\s*,\s*\n\.delete-chip\s*\{[\s\S]*width:\s*72rpx/);
});

test("asset OCR flow exposes editable pending confirmation card", () => {
  const assetsJs = readFileSync(path.join(miniRoot, "pages/assets/assets.js"), "utf8");
  const assetsWxml = readFileSync(path.join(miniRoot, "pages/assets/assets.wxml"), "utf8");

  assert.match(assetsJs, /onPendingOcrInput/);
  assert.match(assetsJs, /confidenceText/);
  assert.match(assetsWxml, /待确认识别结果/);
  assert.match(assetsWxml, /bindinput="onPendingOcrInput"/);
  assert.match(assetsWxml, /data-field="quantity"/);
  assert.match(assetsWxml, /data-field="costPrice"/);
  assert.match(assetsWxml, /data-field="currentPrice"/);
  assert.match(assetsWxml, /确认并回填/);
  assert.match(assetsWxml, /取消识别/);
});

test("wechat miniapp exposes privacy and disclaimer page from overview", () => {
  const config = JSON.parse(readFileSync(path.join(miniRoot, "app.json"), "utf8"));
  const overviewJs = readFileSync(path.join(miniRoot, "pages/overview/overview.js"), "utf8");
  const overviewWxml = readFileSync(path.join(miniRoot, "pages/overview/overview.wxml"), "utf8");
  const legalJs = readFileSync(path.join(miniRoot, "pages/legal/legal.js"), "utf8");

  assert.ok(config.pages.includes("pages/legal/legal"));
  assert.match(overviewWxml, /隐私与免责声明/);
  assert.match(overviewJs, /\/pages\/legal\/legal/);
  assert.match(legalJs, /不构成投资建议/);
  assert.match(legalJs, /不承诺收益/);
  assert.match(legalJs, /未确认结果不得持久化/);
});

test("miniapp overview model reuses migrated calculation core", () => {
  const state = getDefaultState();
  const values = buildCalculationValues(state);
  const directResult = calc.simulate(values);
  const model = getOverviewModel(state);
  const snapshot = valuation.buildValuationSnapshot(state.holdings, [], {
    now: "2026-06-13T10:00:00.000Z",
  });
  const withSnapshot = getOverviewModel({
    ...state,
    valuationSnapshots: [snapshot],
  });

  assert.equal(model.result.currentAssets, directResult.currentAssets);
  assert.equal(model.result.monthlyInvestable, directResult.monthlyInvestable);
  assert.equal(model.progressText, `${model.progress.toFixed(1)}%`);
  assert.match(model.progressWidth, /%$/);
  assert.equal(model.currentAssetsText, "33.2 万");
  assert.equal(model.monthlyInvestableText, "1.1 万");
  assert.equal(model.securityTotalText, "25.5 万");
  assert.match(model.securitySupportText, /未来支持/);
  assert.doesNotMatch(model.securitySupportText, /现金流支持/);
  assert.equal(model.annualReturnText, "5.0%");
  assert.equal(model.salaryGrowthText, "7.5%");
  assert.equal(model.dragTotalText, "0 元");
  assert.equal(model.dragCountText, "0 项 · 已参与退休时间模拟");
  assert.equal(model.monthlyIncomeText, "2.0 万");
  assert.equal(model.baseExpenseText, "8,500 元");
  assert.equal(withSnapshot.valuationChangeText, "暂无昨日对比");
  assert.equal(withSnapshot.valuationStatusText, "部分资产沿用手动价格");
});

test("miniapp overview model exposes cashflow-first metrics without removing legacy results", () => {
  const state = getDefaultState();
  state.userProfile.targetMonthlyLivingCost = 6000;
  state.incomeStreams = [{
    id: "rent-income",
    name: "净房租",
    type: "passive",
    amount: 800,
    frequency: "monthly",
    status: "current",
    requiresLabor: false,
    includeInPassiveIncome: true,
  }];

  const model = getOverviewModel(state);

  assert.equal(model.cashflowRetirementRateText, "13.3%");
  assert.equal(model.cashflowRetirementProgressWidth, "13.3%");
  assert.equal(model.laborDependenceRateText, "86.7%");
  assert.equal(model.monthlyPassiveIncomeText, "800 元");
  assert.match(model.cashflowHeadlineText, /13\.3%/);
  assert.match(model.cashflowDenominatorText, /目标生活成本/);
  assert.match(model.runwayMonthsText, /月/);
  assert.match(model.assetRetirementRateText, /%/);
  assert.match(model.freedomDate, /年|暂不可达/);
  assert.match(model.monthlyInvestableText, /元|万/);
});

test("miniapp storage fallback can save and reset local state", () => {
  storage.clearState();
  const state = storage.loadState();
  state.userProfile.salary = 21000;
  storage.saveState(state);

  assert.equal(storage.loadState().userProfile.salary, 21000);
  assert.equal(storage.resetState().userProfile.salary, getDefaultState().userProfile.salary);
});

test("miniapp state adds passive-income defaults without overwriting saved arrays", () => {
  const defaults = getDefaultState();
  const migrated = storage.migrateState({
    userProfile: { livingCost: 6000 },
    holdings: [],
  });
  const savedIncomeStreams = [{ id: "saved-income" }];
  const migratedWithIncome = storage.migrateState({ incomeStreams: savedIncomeStreams });

  assert.equal(defaults.userProfile.targetMonthlyLivingCost, defaults.userProfile.livingCost);
  assert.deepEqual(defaults.incomeStreams, []);
  assert.deepEqual(migrated.holdings, []);
  assert.deepEqual(migrated.incomeStreams, []);
  assert.deepEqual(migratedWithIncome.incomeStreams, savedIncomeStreams);
});

test("miniapp asset model can add, summarize, refresh, and remove holdings", () => {
  const state = getDefaultState();
  const holding = normalizeAssetForm({
    type: "stock",
    name: "测试基金",
    code: "TEST01",
    quantity: 100,
    costPrice: 1,
    currentPrice: 1.2,
  });
  const withAdded = [holding, ...state.holdings];
  const decorated = decorateHoldings(withAdded);
  const summary = getAssetSummary(withAdded);
  const refreshed = refreshHoldings(withAdded);
  const removed = withAdded.filter((item) => item.id !== holding.id);

  assert.equal(holding.currentValue, 120);
  assert.equal(decorated[0].name, "测试基金");
  assert.match(summary.totalText, /万|元/);
  assert.equal(summary.allocationRows.length, 4);
  assert.ok(summary.allocationRows.some((item) => item.type === "stock" && item.barWidth.endsWith("%")));
  assert.equal(refreshed.length, withAdded.length);
  assert.equal(refreshed[0].quoteStatus, "ok");
  assert.equal(refreshed.find((item) => item.type === "cash").quoteStatus, "skipped");
  assert.equal(removed.some((item) => item.id === holding.id), false);
});

test("miniapp asset model updates an existing holding amount and summaries", () => {
  const state = getDefaultState();
  const holding = normalizeAssetForm({
    type: "stock",
    name: "A stock",
    code: "ASTOCK",
    amount: 100000,
    quantity: 10000,
    costPrice: 10,
    currentPrice: 10,
  });
  const withAdded = [holding, ...state.holdings];
  const form = {
    ...getAssetFormFromHolding(holding),
    amount: "130000",
  };
  const beforeTotal = calc.getHoldingTotals(withAdded).total;
  const updated = upsertAssetHolding(withAdded, form, holding.id);
  const updatedHolding = updated.find((item) => item.id === holding.id);
  const afterTotal = calc.getHoldingTotals(updated).total;

  assert.equal(updated.length, withAdded.length);
  assert.equal(updatedHolding.currentValue, 130000);
  assert.equal(updatedHolding.quantity, 10000);
  assert.equal(updatedHolding.currentPrice, 13);
  assert.equal(afterTotal - beforeTotal, 30000);
});

test("miniapp asset OCR mock exposes pending confirmation fields", () => {
  const result = getMockOcrResult("commodity");

  assert.equal(result.type, "commodity");
  assert.equal(result.name, "截图识别黄金持仓");
  assert.equal(result.currentPrice, "672");
});

test("miniapp drag model accepts non-hundred monthly amounts", () => {
  const state = getDefaultState();
  const drag = normalizeDragForm({
    category: "other",
    title: "测试拖累项",
    amount: "123.45",
  });
  const withDrag = {
    ...state,
    manualDrags: [drag],
  };
  const model = getOverviewModel(withDrag);
  const decorated = decorateDrags(withDrag.manualDrags, model.values, model.result);
  const summary = getDragSummary(withDrag.manualDrags, model.values, model.result);

  assert.equal(drag.amount, 123.45);
  assert.equal(normalizeDragForm({ id: drag.id, category: "other", title: "更新拖累项", amount: "456.78" }).id, drag.id);
  assert.equal(summary.total, 123.45);
  assert.match(summary.savedMonthsText, /\d+ 个月|年/);
  assert.equal(summary.categoryRows.length, 1);
  assert.equal(summary.categoryRows[0].type, "other");
  assert.equal(summary.categoryRows[0].shareText, "100%");
  assert.equal(decorated[0].id, drag.id);
  assert.equal(decorated[0].impactText, "已计入现金流");
  assert.equal(decorated[0].categoryLabel, "其他");
  assert.equal(decorated[0].impactClass, "impact-low");
  assert.equal(model.values.manualDragOutflow, 123.45);

  const medicalDrag = normalizeDragForm({
    category: "medical",
    title: "医疗",
    amount: "641",
  });
  const withMedicalDrag = {
    ...state,
    manualDrags: [medicalDrag],
  };
  const medicalModel = getOverviewModel(withMedicalDrag);
  const [medicalDecorated] = decorateDrags(withMedicalDrag.manualDrags, medicalModel.values, medicalModel.result);

  assert.match(medicalDecorated.impactText, /^若减少可提前约 \d+ 个月$/);

  const highImpactDrag = normalizeDragForm({
    category: "other",
    title: "高影响拖累项",
    amount: "124645",
  });
  const highImpactState = {
    ...state,
    manualDrags: [highImpactDrag],
  };
  const highImpactModel = getOverviewModel(highImpactState);
  const [highImpactDecorated] = decorateDrags(highImpactState.manualDrags, highImpactModel.values, highImpactModel.result);
  const highImpactSummary = getDragSummary(highImpactState.manualDrags, highImpactModel.values, highImpactModel.result);

  assert.match(highImpactDecorated.impactText, /^若减少可提前约 \d+ 个月$/);
  assert.equal(highImpactDecorated.impactClass, "impact-high");
  assert.equal(highImpactSummary.topDragTitle, "高影响拖累项");
  assert.equal(highImpactSummary.topDragClass, "impact-high");
  assert.ok(highImpactSummary.savedMonths > 0);
});

test("miniapp security model updates support without changing investable assets", () => {
  const state = getDefaultState();
  const before = getOverviewModel(state);
  const securityAccounts = updateSecurityField(state.securityAccounts, "pension.balance", 150000);
  const after = getOverviewModel({
    ...state,
    securityAccounts,
  });
  const summary = getSecuritySummary(securityAccounts, after.values, after.result);
  const fields = buildSecurityForm(securityAccounts);
  const groups = getSecurityGroups(securityAccounts);
  const socialSecurityView = getSecurityCategoryView(securityAccounts, "socialSecurity");
  const welfareAssetView = getSecurityCategoryView(securityAccounts, "welfareAsset", "housingFund");
  const pensionGroup = groups.find((group) => group.key === "pension");
  const enterpriseAnnuityGroup = groups.find((group) => group.key === "enterpriseAnnuity");
  const occupationalAnnuityGroup = groups.find((group) => group.key === "occupationalAnnuity");
  const commercialPensionGroup = groups.find((group) => group.key === "commercialPensionInsurance");
  const housingFundGroup = groups.find((group) => group.key === "housingFund");

  assert.equal(before.result.currentAssets, after.result.currentAssets);
  assert.equal(summary.total, 285000);
  assert.ok(summary.supportText.includes("不计入可投资资产"));
  assert.match(summary.supportText, /未来支持/);
  assert.doesNotMatch(summary.supportText, /现金流支持/);
  assert.match(summary.supportFactorText, /%/);
  assert.match(summary.pensionGapText, /20 年|已达到/);
  assert.match(summary.impactText, /预计退休后月领|退休保障/);
  assert.equal(fields.find((item) => item.key === "pension.balance").value, 150000);
  assert.equal(fields.find((item) => item.key === "supplementalHousingFund.balance").value, 20000);
  assert.ok(summary.monthlyIncomeText.includes("预计月领"));
  assert.equal(groups.length, 6);
  assert.ok(pensionGroup);
  assert.equal(pensionGroup.categoryKey, "socialSecurity");
  assert.equal(pensionGroup.title, "基本养老保险");
  assert.equal(pensionGroup.retirementRole, "stable_retirement_cashflow");
  assert.equal(pensionGroup.calculationRole, "retirement_cashflow");
  assert.ok(pensionGroup.fields.some((field) => field.key === "pension.balance"));
  assert.match(pensionGroup.balanceText, /万|元/);
  assert.match(pensionGroup.monthlyContributionText, /万|元/);
  assert.equal(enterpriseAnnuityGroup.categoryKey, "socialSecurity");
  assert.equal(occupationalAnnuityGroup.categoryKey, "socialSecurity");
  assert.equal(commercialPensionGroup.categoryKey, "socialSecurity");
  assert.equal(commercialPensionGroup.isReserved, true);
  assert.equal(commercialPensionGroup.fields.length, 0);
  assert.equal(housingFundGroup.categoryKey, "welfareAsset");
  assert.equal(housingFundGroup.calculationRole, "welfare_asset");
  assert.equal(socialSecurityView.categories.length, 2);
  assert.equal(socialSecurityView.selectedCategory.title, "社会保障");
  assert.equal(socialSecurityView.selectedCategory.countText, "4 项");
  assert.equal(socialSecurityView.selectedGroup.key, "pension");
  assert.deepEqual(
    socialSecurityView.groupsInCategory.map((group) => group.key),
    ["pension", "enterpriseAnnuity", "occupationalAnnuity", "commercialPensionInsurance"],
  );
  assert.equal(welfareAssetView.selectedCategory.title, "福利资产");
  assert.equal(welfareAssetView.selectedCategory.countText, "2 项");
  assert.deepEqual(
    welfareAssetView.groupsInCategory.map((group) => group.key),
    ["housingFund", "supplementalHousingFund"],
  );
});

test("miniapp route model exposes yearly route selection", () => {
  const model = getOverviewModel(getDefaultState());
  const years = getRouteYears(model.result);
  const selected = getSelectedRouteYear(model.result, 1);
  const chart = getRouteChart(model.result, 5);
  const diagnosis = getRouteDiagnostics(model.result, 5);

  assert.ok(years.length > 1);
  assert.equal(years[0].year, 0);
  assert.equal(selected.index, 1);
  assert.match(selected.assetText, /万|元/);
  assert.match(selected.gapText, /距目标还差|已超过目标/);
  assert.match(chart.targetText, /万|元/);
  assert.match(chart.targetLineBottom, /%$/);
  assert.match(chart.reachedText, /达成目标|暂未达成/);
  assert.ok(chart.points.length >= 3);
  assert.equal(chart.points.some((item) => item.stateClass.includes("is-selected")), false);
  assert.equal(chart.points.some((item) => item.markerText === "选中"), false);
  assert.ok(chart.points.every((item) => /%$/.test(item.barHeight)));
  assert.equal(diagnosis.cards.length, 3);
  assert.equal(diagnosis.trajectory.length, 5);
  assert.match(diagnosis.cards[0].label, /现金流状态/);
  assert.match(diagnosis.cards[1].value, /暂不可达|预计第|该年已达到/);
  assert.match(diagnosis.cards[2].value, /耗尽|转正|未看到/);
});

test("miniapp route diagnostics explains negative cashflow routes", () => {
  const state = getDefaultState();
  const model = getOverviewModel({
    ...state,
    userProfile: {
      ...state.userProfile,
      livingCost: 45000,
      sideIncome: 0,
    },
  });
  const diagnosis = getRouteDiagnostics(model.result, 5);

  assert.match(diagnosis.cards[0].value, /每月缺口/);
  assert.match(diagnosis.cards[1].value, /暂不可达|预计第|该年已达到/);
  assert.match(diagnosis.cards[2].value, /耗尽|转正|未看到/);
  assert.ok(diagnosis.trajectory.length <= 5);
  assert.ok(diagnosis.trajectory.length > 0);
});

test("miniapp standalone validator passes", () => {
  const output = execFileSync(process.execPath, [path.join(__dirname, "..", "scripts/validate-miniapp.js")], {
    cwd: path.join(__dirname, ".."),
    encoding: "utf8",
  });

  assert.match(output, /Miniapp validation passed/);
});
