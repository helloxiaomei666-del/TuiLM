const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const miniRoot = path.join(__dirname, "..", "wechat-miniapp");
const overviewWxml = readFileSync(path.join(miniRoot, "pages/overview/overview.wxml"), "utf8");
const overviewJs = readFileSync(path.join(miniRoot, "pages/overview/overview.js"), "utf8");

function getPrimaryCard() {
  const start = overviewWxml.indexOf('<view class="progress-card">');
  const end = overviewWxml.indexOf('<view class="route-preview-card">');
  assert.ok(start >= 0, "overview must retain its primary metric card");
  assert.ok(end > start, "overview primary metric card must end before the route preview");
  return overviewWxml.slice(start, end);
}

test("uses the canonical retirement index as the overview primary metric", () => {
  const primaryCard = getPrimaryCard();

  assert.match(primaryCard, /总退休率|退了吗指数/);
  assert.match(primaryCard, /overview\.retirementIndexText/);
  assert.doesNotMatch(primaryCard, /class="progress-number">\{\{overview\.progressText\}\}/);
});

test("does not retain legacy retirement progress as the primary metric combination", () => {
  const primaryCard = getPrimaryCard();

  assert.doesNotMatch(primaryCard, /退休进度[\s\S]*overview\.progressText/);
  assert.doesNotMatch(primaryCard, /overview\.progressText[\s\S]*退休进度/);
});

test("renders total asset progress as a separate secondary metric", () => {
  const primaryCard = getPrimaryCard();

  assert.match(primaryCard, /总资产进度[\s\S]*overview\.totalAssetProgressText/);
  assert.doesNotMatch(primaryCard, /总资产进度[\s\S]*overview\.retirementIndexText/);
});

test("renders passive income coverage as an independent secondary metric", () => {
  const primaryCard = getPrimaryCard();

  assert.match(primaryCard, /被动收入覆盖率[\s\S]*overview\.passiveIncomeCoverageText/);
  assert.doesNotMatch(primaryCard, /被动收入覆盖率[\s\S]*overview\.retirementIndexText/);
});

test("renders cash safety runway as an independent secondary metric", () => {
  const primaryCard = getPrimaryCard();

  assert.match(primaryCard, /现金安全垫[\s\S]*overview\.cashSafetyRunwayText/);
  assert.doesNotMatch(primaryCard, /现金安全垫[\s\S]*(currentAssets|livingCost|runwayMonthsText)/);
});

test("keeps all three V1 secondary retirement metrics visible", () => {
  const primaryCard = getPrimaryCard();

  [
    ["被动收入覆盖率", "passiveIncomeCoverageText"],
    ["现金安全垫", "cashSafetyRunwayText"],
    ["总资产进度", "totalAssetProgressText"],
  ].forEach(([label, binding]) => {
    assert.match(primaryCard, new RegExp(`${label}[\\s\\S]*overview\\.${binding}`));
  });
});

test("displays the canonical index text through the available complete-state path", () => {
  const primaryCard = getPrimaryCard();

  assert.match(primaryCard, /wx:if="\{\{overview\.retirementIndexAvailable\}\}"/);
  assert.match(
    primaryCard,
    /wx:if="\{\{overview\.retirementIndexAvailable\}\}"[^>]*>\{\{overview\.retirementIndexText\}\}</,
  );
});

test("uses an unavailable insufficient-state path instead of a retirement percentage", () => {
  const primaryCard = getPrimaryCard();

  assert.match(primaryCard, /overview\.retirementIndexCompleteness\s*===\s*["']INSUFFICIENT["']/);
  assert.match(primaryCard, /wx:else[\s\S]*>--</);
  assert.match(primaryCard, /数据不足|暂无法计算/);
});

test("marks partial canonical data differently from complete data", () => {
  const primaryCard = getPrimaryCard();

  assert.match(primaryCard, /overview\.retirementIndexCompleteness\s*===\s*["']PARTIAL["']/);
  assert.match(primaryCard, /数据不完整|信息不完整/);
});

test("consumes formatted overview fields without recalculating retirement metrics in the page", () => {
  assert.match(overviewWxml, /overview\.retirementIndexText/);
  assert.match(overviewWxml, /overview\.passiveIncomeCoverageText/);
  assert.doesNotMatch(overviewJs, /currentAssets\s*\/\s*target/);
  assert.doesNotMatch(overviewJs, /incomeSources[\s\S]{0,120}\.reduce\s*\(/);
  assert.doesNotMatch(overviewJs, /stableIncome\s*\/\s*expense/);
});
