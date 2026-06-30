# Retirement Test V0.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the retirement test MVP into V0.2 with clearer asset wording, split cashflow/asset statuses, dynamic summaries, a redesigned freedom-progress poster, stronger privacy/compliance copy, and expanded tests.

**Architecture:** Keep the existing static app and UMD modules. Extend `js/calculator.js` with asset/liability normalization, target asset progress, statuses, and poster summary helpers; update `js/app.js` to render clearer user-facing report sections; rewrite `js/share-card.js` poster text/layout while keeping Canvas-only local generation.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript, Canvas 2D, LocalStorage, Node.js `node:test`, no production dependencies.

---

## File map

- Modify `js/calculator.js`: add V0.2 asset/liability helpers, target asset progress, status derivation, dynamic poster summary, and display-safe formatting helpers.
- Modify `tests/calculator.test.js`: cover net asset口径, property value/mortgage balance behavior, status derivation, dynamic summary, forbidden summary terms.
- Modify `index.html`: rename property/mortgage labels, add field hints, add result top conclusion card, rename metric cards, add explainer details, add privacy notice and result clear button.
- Modify `js/app.js`: normalize new and legacy property fields, render V0.2 result copy, remove misleading phrases, bind clear-current-result control, pass new poster data.
- Modify `styles.css`: add conclusion card, status pills, explainer, privacy notice, poster dialog improvements.
- Modify `js/share-card.js`: rebuild poster as the neutral freedom progress card.
- Modify `tests/share-card.test.js`: assert new poster content and forbidden terms.
- Modify `tests/structure.test.js`: assert page copy, forbidden wording, local resources, documentation requirements.
- Modify `README.md` and `docs/product-notes.md`: document V0.2 wording, asset口径, privacy, and compliance boundaries.

## Task 1: Clarify asset and liability口径

**Files:**
- Modify: `tests/calculator.test.js`
- Modify: `tests/app.test.js`
- Modify: `js/calculator.js`
- Modify: `js/app.js`
- Modify: `index.html`

- [ ] **Step 1: Add failing calculator tests for gross assets, liabilities, and target asset progress**

Append to `tests/calculator.test.js`:

```js
test('calculateMetrics treats property value and mortgage balance without double subtraction', () => {
  const metrics = calculateMetrics({
    currentMonthlyCost: 10000,
    targetMonthlyCost: 10000,
    assets: {
      cash: 100000,
      funds: 200000,
      stocks: 300000,
      gold: 50000,
      propertyValue: 3000000,
      other: 50000,
    },
    debts: {
      mortgageBalance: 1000000,
      carLoan: 50000,
      consumerLoan: 20000,
      other: 30000,
    },
    passiveIncome: {},
    semiPassiveIncome: {},
  });

  assert.equal(metrics.totalAssets, 3700000);
  assert.equal(metrics.totalDebts, 1100000);
  assert.equal(metrics.netAssets, 2600000);
  assert.equal(metrics.retirementTargetAssets, 3000000);
  assert.equal(metrics.targetAssetProgress, 2600000 / 3000000);
});
```

- [ ] **Step 2: Add failing app normalization tests for new and legacy property fields**

Append to `tests/app.test.js`:

```js
test('normalizeFormData maps property value and mortgage balance to calculator input', () => {
  const data = normalizeFormData({
    propertyValue: '3000000',
    mortgageBalance: '1000000',
  });

  assert.equal(data.propertyValue, 3000000);
  assert.equal(data.mortgageBalance, 1000000);
  assert.equal(data.assets.propertyValue, 3000000);
  assert.equal(data.debts.mortgageBalance, 1000000);
});

test('normalizeFormData safely migrates legacy property value fields', () => {
  assert.equal(normalizeFormData({ propertyEquity: '1200000' }).propertyValue, 1200000);
  assert.equal(normalizeFormData({ propertyNetValue: '1300000' }).propertyValue, 1300000);
  assert.equal(normalizeFormData({ realEstateNetValue: '1400000' }).propertyValue, 1400000);
});
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```powershell
node --test tests/calculator.test.js tests/app.test.js
```

Expected: FAIL because `propertyValue`, `mortgageBalance`, and `targetAssetProgress` are not implemented.

- [ ] **Step 4: Implement calculator compatibility**

In `js/calculator.js`, update `calculateMetrics` asset keys from `propertyEquity` to support both `propertyValue` and legacy `propertyEquity`. Use one effective property value:

```js
function firstAmount(source, keys) {
  for (const key of keys) {
    if (source != null && Object.prototype.hasOwnProperty.call(source, key)) {
      return toAmount(source[key]);
    }
  }
  return 0;
}
```

Then use:

```js
const totalAssets = sumAmounts(assets, ['cash', 'funds', 'stocks', 'gold', 'other'])
  + firstAmount(assets, ['propertyValue', 'propertyEquity', 'propertyNetValue', 'realEstateNetValue']);
const totalDebts = sumAmounts(ownValue(data, 'debts'), ['carLoan', 'consumerLoan', 'other'])
  + firstAmount(ownValue(data, 'debts'), ['mortgageBalance', 'mortgage']);
const targetAssetProgress = safeRatio(netAssets, retirementTargetAssets);
```

Add `targetAssetProgress` to the returned metrics while keeping `assetRetirementRate` as an alias for backward compatibility.

- [ ] **Step 5: Implement app normalization compatibility**

In `js/app.js`, add `propertyValue`, `mortgageBalance`, `propertyNetValue`, and `realEstateNetValue` to normalized input handling. Ensure:

```js
data.propertyValue = data.propertyValue
  || toAmount(ownValue(source, 'propertyEquity'))
  || toAmount(ownValue(source, 'propertyNetValue'))
  || toAmount(ownValue(source, 'realEstateNetValue'));
data.mortgageBalance = data.mortgageBalance || toAmount(ownValue(source, 'mortgage'));
data.assets.propertyValue = data.propertyValue;
data.debts.mortgageBalance = data.mortgageBalance;
```

Do not double-count `propertyEquity` once `propertyValue` is present.

- [ ] **Step 6: Update form labels and hints**

In `index.html`, change:

```html
房产净值（元）
```

to:

```html
房产估值（元）
```

Change `name="propertyEquity"` to `name="propertyValue"` and add a hint:

```html
<small class="field-hint">请填写房产当前大致市场估值，不要在这里扣除房贷。剩余房贷请在负债页填写。</small>
```

Change mortgage label from:

```html
房贷（元）
```

to:

```html
剩余房贷（元）
```

Change `name="mortgage"` to `name="mortgageBalance"` and add:

```html
<small class="field-hint">请填写当前仍未偿还的房贷本金余额。</small>
```

- [ ] **Step 7: Run tests and commit**

Run:

```powershell
node --test tests/calculator.test.js tests/app.test.js tests/structure.test.js
node --test tests/*.test.js
git diff --check
```

Expected: all tests pass.

Commit:

```powershell
git add index.html js/calculator.js js/app.js tests/calculator.test.js tests/app.test.js
git commit -m "feat: clarify asset and liability inputs"
```

## Task 2: Add V0.2 status derivation and dynamic summary

**Files:**
- Modify: `tests/calculator.test.js`
- Modify: `js/calculator.js`

- [ ] **Step 1: Add failing tests for cashflow and asset status labels**

Append to `tests/calculator.test.js`:

```js
test('deriveCashFlowStatus classifies V0.2 cashflow boundaries', () => {
  const cases = [
    [0, 'labor-dependent', '完全劳动依赖期'],
    [0.01, 'cashflow-sprout', '现金流萌芽期'],
    [0.2, 'asset-starts-working', '资产开始工作期'],
    [0.5, 'semi-retirement-prep', '半退休准备期'],
    [0.8, 'near-cashflow-coverage', '接近现金流覆盖期'],
    [1, 'cashflow-coverage-watch', '现金流覆盖观察期'],
  ];

  for (const [rate, key, label] of cases) {
    const status = calculateMetrics({
      currentMonthlyCost: 10000,
      targetMonthlyCost: 10000,
      assets: {},
      debts: {},
      passiveIncome: { rent: { amount: rate * 10000, frequency: 'month' } },
      semiPassiveIncome: {},
    }).statuses.cashFlowStatus;
    assert.equal(status.key, key);
    assert.equal(status.label, label);
  }
});

test('deriveAssetStatus classifies target asset progress boundaries', () => {
  const metrics = calculateMetrics({
    currentMonthlyCost: 10000,
    targetMonthlyCost: 10000,
    assets: { cash: 3100000 },
    debts: {},
    passiveIncome: {},
    semiPassiveIncome: {},
  });

  assert.equal(metrics.statuses.assetStatus.key, 'asset-model-reached');
  assert.equal(metrics.statuses.assetStatus.label, '资产模型达标期');
});
```

- [ ] **Step 2: Add failing tests for overall status and forbidden terms**

Append:

```js
test('overall status separates asset model from cashflow coverage', () => {
  const metrics = calculateMetrics({
    currentMonthlyCost: 10000,
    targetMonthlyCost: 10000,
    assets: { cash: 3000000 },
    debts: {},
    passiveIncome: { rent: { amount: 4000, frequency: 'month' } },
    semiPassiveIncome: {},
  });

  assert.match(metrics.statuses.overallStatus.title, /资产模型/);
  assert.match(metrics.statuses.overallStatus.description, /现金流尚未/);
  assert.doesNotMatch(metrics.statuses.overallStatus.title + metrics.statuses.overallStatus.description, /已达到目标状态|可以退休|财务自由/);
});

test('getPosterSummaryByCashFlowRate returns dynamic safe summaries', () => {
  const cases = [
    [-0.1, 100, -1, '资产负债修复中'],
    [0, 0, 1000, '打基础中'],
    [0.05, 100, 1000, '现金流萌芽中'],
    [0.2, 100, 1000, '资产开始打工中'],
    [0.4, 100, 1000, '自由感变具体了'],
    [0.7, 100, 1000, '资产成为重要帮手'],
    [0.95, 100, 1000, '接近现金流覆盖'],
    [1.2, 100, 1000, '现金流覆盖观察期'],
  ];

  for (const [rate, income, netAssets, label] of cases) {
    const summary = getPosterSummaryByCashFlowRate(rate, income, netAssets);
    assert.equal(summary.stageLabel, label);
    assert.doesNotMatch(summary.summaryText, /可以退休|财务自由|已达到目标状态|资产已接管生活|稳赚|保证收益/);
  }
});
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```powershell
node --test tests/calculator.test.js
```

Expected: FAIL because `statuses` and `getPosterSummaryByCashFlowRate` are missing.

- [ ] **Step 4: Implement status helpers**

In `js/calculator.js`, add and export:

```js
function deriveCashFlowStatus(rate) { /* exact V0.2 thresholds */ }
function deriveAssetStatus(progress) { /* exact V0.2 thresholds */ }
function deriveOverallStatus(metrics) { /* prioritize netAssets, cashflow, then asset progress */ }
function getPosterSummaryByCashFlowRate(rate, stablePassiveIncome, netAssets) { /* exact table */ }
```

Add:

```js
statuses: {
  cashFlowStatus,
  assetStatus,
  overallStatus,
  posterSummary,
}
```

to `calculateMetrics`.

- [ ] **Step 5: Run tests and commit**

Run:

```powershell
node --test tests/calculator.test.js
node --test tests/*.test.js
git diff --check
```

Commit:

```powershell
git add js/calculator.js tests/calculator.test.js
git commit -m "feat: derive v0.2 retirement statuses"
```

## Task 3: Refine report page expression

**Files:**
- Modify: `tests/structure.test.js`
- Modify: `index.html`
- Modify: `js/app.js`
- Modify: `styles.css`

- [ ] **Step 1: Add failing structure tests for V0.2 report copy**

Append to `tests/structure.test.js`:

```js
test('page uses V0.2 user-facing result vocabulary', () => {
  for (const text of [
    '现金流退休率',
    '自由进度',
    '目标资产进度',
    '净资产',
    '总资产',
    '总负债',
    '房产估值',
    '剩余房贷',
    '资产月收入',
    '工资依赖',
    '这些指标怎么算',
    '年生活成本约 25 倍',
    '不代表可以立即辞职',
  ]) {
    assert.match(html, new RegExp(text));
  }

  for (const forbidden of ['房产净值', '已达到目标状态', '可以退休', '财务自由']) {
    assert.doesNotMatch(html, new RegExp(forbidden));
  }
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```powershell
node --test tests/structure.test.js
```

Expected: FAIL because V0.2 copy and sections are missing.

- [ ] **Step 3: Update report markup**

In `index.html`, add a report conclusion card before metric cards:

```html
<section class="result-summary-card" aria-labelledby="result-summary-title">
  <p class="eyebrow">测算小结</p>
  <h3 id="result-summary-title">你的自由进度</h3>
  <p id="result-summary-main" class="result-summary-main">等待生成结果</p>
  <p id="result-summary-detail" class="result-summary-detail">填写数据后，这里会解释现金流和资产模型的差异。</p>
  <p id="result-summary-caution" class="metric-copy">本结果仅供自我观察，不代表可以立即辞职。</p>
</section>
```

Rename metric headings:

- `资产退休率` -> `目标资产进度`
- `资产工作力` -> `资产月收入`
- `劳动依赖率` -> `工资依赖`

Add an explainer:

```html
<details class="formula-explainer">
  <summary>这些指标怎么算？</summary>
  <p>现金流退休率 = 稳定月被动收入 ÷ 目标月生活成本。它回答的是：我的生活有多少已经不靠工资？</p>
  <p>目标资产进度 = 当前净资产 ÷ 目标退休资产。当前净资产 = 总资产 - 总负债。</p>
  <p>总资产包括现金、基金、股票、黄金、房产估值和其他资产；总负债包括剩余房贷、车贷、消费贷和其他负债。</p>
  <p>目标退休资产采用目标月生活成本 × 12 × 25，也就是年生活成本约 25 倍的简化估算，不代表收益承诺。</p>
  <p>资产月收入 = 稳定被动收入 + 半被动收入。工资依赖表示目标生活成本中仍需工资或主动收入覆盖的比例。</p>
</details>
```

- [ ] **Step 4: Update report rendering**

In `js/app.js`, render:

- `result-summary-main`
- `result-summary-detail`
- `result-summary-caution`
- `asset-rate` using `metrics.targetAssetProgress`
- `asset-work-power` as asset monthly income
- `labor-rate` as wage dependency
- no text `已达到目标状态`

When estimate is reached, replace old text with:

```text
资产模型：当前已达标
现金流模型：尚未达标
```

or, when cashflow is covered:

```text
现金流已覆盖目标生活成本
```

- [ ] **Step 5: Add styles**

In `styles.css`, add `.result-summary-card`, `.result-summary-main`, `.result-summary-detail`, `.formula-explainer`, and status-pill styling.

- [ ] **Step 6: Run tests and commit**

Run:

```powershell
node --test tests/structure.test.js
node --test tests/*.test.js
git diff --check
```

Commit:

```powershell
git add index.html styles.css js/app.js tests/structure.test.js
git commit -m "feat: refine v0.2 report explanation"
```

## Task 4: Redesign the freedom progress poster

**Files:**
- Modify: `tests/share-card.test.js`
- Modify: `js/share-card.js`
- Modify: `js/app.js`

- [ ] **Step 1: Replace share-card tests with V0.2 content contract**

Update `tests/share-card.test.js` to assert:

```js
test('buildShareLines returns V0.2 freedom progress card copy', () => {
  const lines = buildShareLines({
    freedomProgress: '40%',
    targetAssetProgress: '89.3%',
    assetMonthlyIncome: '¥2,200.00 / 月',
    wageDependency: '60%',
    stageLabel: '资产开始打工中',
    summaryText: '资产已经开始上班，但主力员工还是我自己。',
  });
  const text = lines.join('\n');

  for (const required of [
    '测一测你的自由进度｜退了吗',
    '我的自由进度',
    '40%',
    '现在有 40% 的生活成本，不用完全靠工资来扛。',
    '资产开始打工中',
    '目标资产进度',
    '净资产占目标资产',
    '资产月收入',
    '工资依赖',
    '小结',
    '资产已经开始上班，但主力员工还是我自己。',
    '不是想躺平，只是想多一点选择生活的权利。',
    '不构成投资、理财、保险或退休决策建议',
  ]) {
    assert.match(text, new RegExp(required));
  }

  for (const forbidden of [
    '资产退休率',
    '资产工作力',
    '劳动依赖率',
    '关闭',
    '保存 PNG',
    '分享预览',
    '已达到目标状态',
    '可以退休',
    '财务自由',
  ]) {
    assert.doesNotMatch(text, new RegExp(forbidden));
  }
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```powershell
node --test tests/share-card.test.js
```

Expected: FAIL because current poster copy is still V0.1.

- [ ] **Step 3: Implement V0.2 share data mapping**

In `js/app.js`, update `formatShareReportData` to pass:

- `freedomProgress`
- `targetAssetProgress`
- `assetMonthlyIncome`
- `wageDependency`
- `stageLabel`
- `summaryText`

Use `metrics.statuses.posterSummary`.

- [ ] **Step 4: Rebuild share card text and Canvas layout**

In `js/share-card.js`, update `buildShareLines` and `drawShareCard`:

- Canvas size: 1080 × 1600.
- First visual: large circular progress ring and `freedomProgress`.
- Use cream background, warm cards, muted accent colors.
- Include three metric cards.
- Include dynamic summary card.
- Include bottom quote and compliance text.
- Do not draw fake QR code when no real link exists.
- Do not use external images or fonts.

- [ ] **Step 5: Run tests and commit**

Run:

```powershell
node --test tests/share-card.test.js
node --test tests/*.test.js
git diff --check
```

Commit:

```powershell
git add js/share-card.js js/app.js tests/share-card.test.js
git commit -m "feat: redesign freedom progress poster"
```

## Task 5: Update privacy, documentation, and acceptance copy

**Files:**
- Modify: `tests/structure.test.js`
- Modify: `index.html`
- Modify: `README.md`
- Modify: `docs/product-notes.md`

- [ ] **Step 1: Add failing documentation and privacy tests**

Append to `tests/structure.test.js`:

```js
test('documentation and page describe V0.2 asset and privacy boundaries', () => {
  const combined = `${html}\n${readme}\n${notes}`;
  for (const required of [
    '数据仅保存在当前浏览器，不会上传',
    '清空本次数据',
    '当前净资产 = 总资产 - 总负债',
    '总资产包括现金、基金、股票、黄金、房产估值和其他资产',
    '总负债包括剩余房贷、车贷、消费贷和其他负债',
    '目标退休资产采用目标月生活成本 × 12 × 25',
    '现金流退休率是第一核心指标',
    '目标资产进度只是辅助观察',
    '资产达标不等于现金流退休',
    '现金流覆盖也不代表可以立即辞职',
    '本地 Canvas 生成',
  ]) {
    assert.match(combined, new RegExp(required));
  }
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```powershell
node --test tests/structure.test.js
```

Expected: FAIL because docs and page copy are incomplete.

- [ ] **Step 3: Add privacy notice and clear button**

In `index.html`, add visible privacy notice near form and report actions:

```html
<p class="privacy-note">数据仅保存在当前浏览器，不会上传。如果你正在使用公共设备，建议测算后点击“清空本地数据”。</p>
<button id="clear-current-result" class="button button--secondary" type="button">清空本次数据</button>
```

Bind `clear-current-result` in `js/app.js` to existing clear draft behavior if not already done.

- [ ] **Step 4: Update README and product notes**

Update docs with exact V0.2 statements required in the test. Keep compliance language conservative.

- [ ] **Step 5: Run tests and commit**

Run:

```powershell
node --test tests/structure.test.js
node --test tests/*.test.js
git diff --check
```

Commit:

```powershell
git add index.html js/app.js README.md docs/product-notes.md tests/structure.test.js
git commit -m "docs: update v0.2 boundaries"
```

## Task 6: Final V0.2 acceptance audit

**Files:**
- Modify only if audit finds a verified issue, and add a regression test first where feasible.

- [ ] **Step 1: Run automated verification**

Run:

```powershell
node --test tests/*.test.js
git diff --check
git status --short
```

Expected: tests pass, whitespace check clean, working tree clean.

- [ ] **Step 2: Run network and forbidden copy scans**

Run:

```powershell
rg -n "https?://|fetch\(|XMLHttpRequest|WebSocket|navigator\.sendBeacon|EventSource|@import|url\(" index.html styles.css js README.md docs/product-notes.md
rg -n "房产净值|攒钱进度|已达到目标状态|可以退休|财务自由|稳赚|保证收益" index.html js README.md docs/product-notes.md tests
```

Expected:

- Network scan only allows documented local `http://127.0.0.1:4173`.
- Forbidden copy scan has no production hits. Test fixtures may include forbidden strings only as negative assertions.

- [ ] **Step 3: Audit original project isolation**

From `C:\Users\18955\Desktop\Codex_work\ios_app`, verify that this work changed only `retirement-test`. Do not write inside `wealth-freedom-demo`.

- [ ] **Step 4: Final report**

Report:

1. Modified files.
2. Net asset口径.
3. 房产估值 and 剩余房贷 handling.
4. Whether 攒钱进度 was replaced with 目标资产进度.
5. New result explanations.
6. Whether cashflow and asset statuses are split.
7. Whether misleading phrases were removed.
8. Whether retirement-age expression was weakened.
9. Poster redesign status.
10. Dynamic summary rules status.
11. Fake QR code avoidance.
12. Test changes.
13. `node --test tests/*.test.js` result.
14. `git diff --check` result.
15. Remaining limitations.
