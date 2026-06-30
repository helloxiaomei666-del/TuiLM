# Retirement Test MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an isolated, zero-dependency, mobile-first retirement progress test with a five-step form, conservative calculations, report, downloadable share poster, documentation, and compliance text.

**Architecture:** Keep the site directly openable as static files. Put all pure financial calculations in a UMD-style calculator module that works in the browser and Node tests; keep UI orchestration in a separate browser module; isolate Canvas rendering in a share-card module. Use Node's built-in test runner plus real browser verification, with no production dependencies or network calls.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript, Canvas 2D, LocalStorage, Node.js `node:test`, Python static server for browser verification.

---

## File map

- Create `index.html`: semantic page shell, landing view, five form steps, report view, poster dialog, compliance copy.
- Create `styles.css`: tokens, mobile layout, form controls, report cards, poster dialog, responsive and reduced-motion rules.
- Create `js/calculator.js`: amount normalization, frequency conversion, totals, ratios, status, retirement estimate, accelerator scenarios, formatting.
- Create `js/app.js`: state restoration, navigation, form collection, validation, live summaries, report rendering, data clearing.
- Create `js/share-card.js`: share-line construction, Canvas rendering, preview, PNG download.
- Create `tests/calculator.test.js`: unit tests for all calculation behavior and edge cases.
- Create `tests/app.test.js`: unit tests for validation, fallback rules, and safe restored state.
- Create `tests/share-card.test.js`: unit tests for poster content construction.
- Create `tests/structure.test.js`: static checks for required views, fields, disclosures, accessibility hooks, and no remote resources.
- Create `README.md`: run, test, privacy, scope, and isolation instructions.
- Create `docs/product-notes.md`: product intent, formulas, assumptions,完整免责声明, compliance boundaries, future CTA integration.

## Task 1: Calculator primitives

**Files:**
- Create: `tests/calculator.test.js`
- Create: `js/calculator.js`

- [ ] **Step 1: Write failing tests for amount and frequency normalization**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../js/calculator.js');

test('toAmount converts empty, invalid, and negative amounts to zero', () => {
  assert.equal(calc.toAmount(''), 0);
  assert.equal(calc.toAmount('oops'), 0);
  assert.equal(calc.toAmount(-1), 0);
  assert.equal(calc.toAmount('1200.50'), 1200.5);
});

test('toMonthly converts stable periods and excludes irregular income', () => {
  assert.equal(calc.toMonthly(1200, 'month'), 1200);
  assert.equal(calc.toMonthly(1200, 'quarter'), 400);
  assert.equal(calc.toMonthly(1200, 'year'), 100);
  assert.equal(calc.toMonthly(1200, 'irregular'), 0);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/calculator.test.js`

Expected: FAIL because `../js/calculator.js` does not exist.

- [ ] **Step 3: Implement the UMD module and minimal primitives**

```js
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.RetirementCalculator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function toAmount(value) {
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0 ? amount : 0;
  }

  function toMonthly(value, frequency) {
    const amount = toAmount(value);
    if (frequency === 'quarter') return amount / 3;
    if (frequency === 'year') return amount / 12;
    if (frequency === 'irregular') return 0;
    return amount;
  }

  return { toAmount, toMonthly };
});
```

- [ ] **Step 4: Run the tests and verify GREEN**

Run: `node --test tests/calculator.test.js`

Expected: 2 tests pass, 0 fail.

- [ ] **Step 5: Commit calculator primitives**

```powershell
git add js/calculator.js tests/calculator.test.js
git commit -m "test: define calculator normalization"
```

## Task 2: Core metrics and classifications

**Files:**
- Modify: `tests/calculator.test.js`
- Modify: `js/calculator.js`

- [ ] **Step 1: Add failing tests for the full metric calculation**

Append tests that call this API:

```js
test('calculateMetrics separates passive and semi-passive income', () => {
  const result = calc.calculateMetrics({
    currentMonthlyCost: 8000,
    targetMonthlyCost: 10000,
    assets: { cash: 120000, funds: 180000, stocks: 90000, gold: 30000, propertyEquity: 500000, other: 80000 },
    debts: { mortgage: 300000, carLoan: 20000, consumerLoan: 10000, other: 0 },
    passiveIncome: {
      dividends: { amount: 3600, frequency: 'year' },
      rent: { amount: 1200, frequency: 'month' },
      interest: { amount: 600, frequency: 'quarter' },
      reits: { amount: 0, frequency: 'month' },
      pension: { amount: 0, frequency: 'month' },
      annuity: { amount: 0, frequency: 'month' },
      royalties: { amount: 0, frequency: 'month' },
      other: { amount: 1200, frequency: 'year' }
    },
    semiPassiveIncome: { amount: 600, frequency: 'month' }
  });

  assert.equal(result.totalAssets, 1000000);
  assert.equal(result.totalDebts, 330000);
  assert.equal(result.netAssets, 670000);
  assert.equal(result.retirementTargetAssets, 3000000);
  assert.equal(result.monthlyPassiveIncome, 1800);
  assert.equal(result.cashflowRetirementRate, 0.18);
  assert.equal(result.assetRetirementRate, 670000 / 3000000);
  assert.equal(result.laborDependencyRate, 0.82);
  assert.equal(result.assetWorkPower, 2400);
  assert.equal(result.safetyMonths, 15);
  assert.equal(result.stage.key, 'cashflow-seed');
});

test('calculateMetrics supports negative net assets and zero divisors', () => {
  const result = calc.calculateMetrics({
    currentMonthlyCost: 0,
    targetMonthlyCost: 0,
    assets: { cash: 1000 },
    debts: { consumerLoan: 3000 },
    passiveIncome: {},
    semiPassiveIncome: {}
  });
  assert.equal(result.netAssets, -2000);
  assert.equal(result.retirementTargetAssets, null);
  assert.equal(result.cashflowRetirementRate, null);
  assert.equal(result.assetRetirementRate, null);
  assert.equal(result.safetyMonths, null);
});

test('rates above one remain truthful while displayed labor dependence bottoms at zero', () => {
  const result = calc.calculateMetrics({
    currentMonthlyCost: 1000,
    targetMonthlyCost: 1000,
    assets: { cash: 400000 },
    debts: {},
    passiveIncome: { rent: { amount: 1500, frequency: 'month' } },
    semiPassiveIncome: {}
  });
  assert.equal(result.cashflowRetirementRate, 1.5);
  assert.equal(result.assetRetirementRate > 1, true);
  assert.equal(result.laborDependencyRate, 0);
  assert.equal(result.cashflowCovered, true);
  assert.equal(result.assetTargetReached, true);
});
```

- [ ] **Step 2: Run the targeted tests and verify RED**

Run: `node --test --test-name-pattern="calculateMetrics|rates above" tests/calculator.test.js`

Expected: FAIL because `calculateMetrics` is missing.

- [ ] **Step 3: Implement sums, safe ratios, stages, and metrics**

Add private helpers `sumKnownKeys`, `safeRatio`, and `classifyStage`, then expose `calculateMetrics`. Use fixed asset keys, debt keys, and passive-income keys so restored junk properties cannot enter totals. Return `null` for ratios whose denominator is zero. Preserve negative net assets, but clamp displayed labor dependency to zero.

Required result shape:

```js
{
  totalAssets, totalDebts, netAssets, retirementTargetAssets,
  monthlyPassiveIncome, monthlySemiPassiveIncome,
  cashflowRetirementRate, assetRetirementRate, laborDependencyRate,
  assetWorkPower, safetyMonths, stage,
  cashflowCovered, assetTargetReached
}
```

- [ ] **Step 4: Run all calculator tests and verify GREEN**

Run: `node --test tests/calculator.test.js`

Expected: 5 tests pass, 0 fail.

- [ ] **Step 5: Commit core metrics**

```powershell
git add js/calculator.js tests/calculator.test.js
git commit -m "feat: calculate retirement progress metrics"
```

## Task 3: Conservative retirement estimate and accelerator

**Files:**
- Modify: `tests/calculator.test.js`
- Modify: `js/calculator.js`

- [ ] **Step 1: Add failing tests for retirement timing states**

```js
test('estimateRetirement uses the zero-return cashflow-adjusted target', () => {
  const estimate = calc.estimateRetirement({
    age: 35,
    targetMonthlyCost: 10000,
    monthlyPassiveIncome: 2000,
    netAssets: 600000,
    monthlySalary: 20000,
    monthlySideIncome: 2000,
    monthlyLivingExpense: 8000,
    monthlyFixedExpense: 2000,
    monthlyDebtPayment: 2000
  });
  assert.equal(estimate.status, 'estimated');
  assert.equal(estimate.monthlyInvestable, 10000);
  assert.equal(estimate.adjustedTargetAssets, 2400000);
  assert.equal(estimate.monthsRemaining, 180);
  assert.equal(estimate.estimatedAge, 50);
  assert.equal(estimate.daysRemaining, 5479);
});

test('estimateRetirement returns reached and unavailable states safely', () => {
  assert.equal(calc.estimateRetirement({ age: 40, targetMonthlyCost: 1000, monthlyPassiveIncome: 1000, netAssets: 0 }).status, 'reached');
  assert.equal(calc.estimateRetirement({ age: 40, targetMonthlyCost: 1000, monthlyPassiveIncome: 0, netAssets: 0 }).status, 'unavailable');
});

test('calculateAccelerators compares 100, 500, and 1000 yuan scenarios', () => {
  const input = {
    age: 35,
    targetMonthlyCost: 10000,
    monthlyPassiveIncome: 2000,
    netAssets: 600000,
    monthlySalary: 20000,
    monthlySideIncome: 2000,
    monthlyLivingExpense: 8000,
    monthlyFixedExpense: 2000,
    monthlyDebtPayment: 2000
  };
  const scenarios = calc.calculateAccelerators(input);
  assert.deepEqual(scenarios.map((item) => item.addedMonthlyIncome), [100, 500, 1000]);
  assert.deepEqual(scenarios.map((item) => item.monthsEarlier), [3, 15, 30]);
});
```

- [ ] **Step 2: Run the timing tests and verify RED**

Run: `node --test --test-name-pattern="estimateRetirement|calculateAccelerators" tests/calculator.test.js`

Expected: FAIL because both functions are missing.

- [ ] **Step 3: Implement the zero-return model**

Implement `estimateRetirement(input)` exactly from the approved design formula. Round `monthsRemaining` to two decimals for calculations, `estimatedAge` to one decimal for display data, and `daysRemaining` with `Math.round(months * 365.2425 / 12)`. Return status `reached` when the gap is zero and `unavailable` when a positive gap has no monthly investable amount.

Implement `calculateAccelerators(input)` by calculating the baseline once, then recalculating with added passive income values `[100, 500, 1000]`. For an estimated baseline return non-negative rounded months and years earlier; carry `reached` or `unavailable` states without inventing a time.

- [ ] **Step 4: Add formatter tests and implementations**

First add and observe failures for:

```js
test('formatters produce concise Chinese currency and percentages', () => {
  assert.match(calc.formatCurrency(1234.5), /1,234\.50/);
  assert.equal(calc.formatPercent(0.1811), '18.1%');
  assert.equal(calc.formatPercent(null), '暂无法计算');
});
```

Then implement `formatCurrency` with `Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })` and `formatPercent` with at most one decimal.

- [ ] **Step 5: Run all calculator tests and commit**

Run: `node --test tests/calculator.test.js`

Expected: all calculator tests pass with no warnings.

```powershell
git add js/calculator.js tests/calculator.test.js
git commit -m "feat: estimate conservative retirement timing"
```

## Task 4: Semantic five-step page shell

**Files:**
- Create: `tests/structure.test.js`
- Create: `index.html`
- Create: `styles.css`

- [ ] **Step 1: Write a failing static structure test**

Use `fs.readFileSync` and assertions that require:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');

test('page contains landing, five form steps, report, and poster dialog', () => {
  assert.match(html, /id="landing-view"/);
  assert.equal((html.match(/data-step="[1-5]"/g) || []).length, 5);
  assert.match(html, /id="report-view"/);
  assert.match(html, /id="share-dialog"/);
});

test('page contains every required input and disclosure', () => {
  for (const name of ['age', 'city', 'desiredRetirementAge', 'currentMonthlyCost', 'targetMonthlyCost', 'cash', 'funds', 'stocks', 'gold', 'propertyEquity', 'otherAssets', 'mortgage', 'carLoan', 'consumerLoan', 'otherDebt', 'monthlySalary', 'monthlySideIncome', 'monthlyLivingExpense', 'monthlyFixedExpense', 'monthlyDebtPayment']) {
    assert.match(html, new RegExp(`name="${name}"`));
  }
  assert.match(html, /本工具仅用于个人财务状态测算和自我观察/);
  assert.match(html, /不构成投资建议、理财建议、保险建议或退休决策建议/);
});

test('page uses only local resources', () => {
  assert.doesNotMatch(html, /(?:src|href)="https?:\/\//);
});

test('styles are mobile-first, keyboard-visible, and motion-safe', () => {
  assert.match(css, /:root/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /:focus-visible/);
});
```

- [ ] **Step 2: Run the structure test and verify RED**

Run: `node --test tests/structure.test.js`

Expected: FAIL because `index.html` does not exist.

- [ ] **Step 3: Create semantic HTML with all required fields**

Build a single `<main>` with three mutually exclusive views. Use a real `<form id="retirement-form" novalidate>`, five `<fieldset data-step>` groups, persistent progress text, per-field error `<span>` elements, and buttons with explicit `type`. Represent each passive item as an amount input plus frequency select with values `month`, `quarter`, `year`, `irregular`. Load scripts in order: calculator, share-card, app, all with local relative paths and `defer`.

- [ ] **Step 4: Create the visual system**

Define CSS custom properties for white, near-black, grays, cool blue, borders, radii, spacing, and shadows. Implement `.view[hidden] { display: none; }`, a 720px content shell, 44px minimum controls, two-column amount/frequency rows, accessible focus rings, responsive single-column behavior under 640px, and `prefers-reduced-motion` overrides.

- [ ] **Step 5: Run structure tests and commit**

Run: `node --test tests/structure.test.js`

Expected: 4 tests pass, 0 fail.

```powershell
git add index.html styles.css tests/structure.test.js
git commit -m "feat: add mobile retirement test shell"
```

## Task 5: Form state, validation, and navigation

**Files:**
- Create: `tests/app.test.js`
- Create: `js/app.js`
- Modify: `index.html`

- [ ] **Step 1: Write failing pure tests for validation and fallback behavior**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../js/app.js');

test('normalizeFormData falls back target cost to current cost', () => {
  const data = app.normalizeFormData({ currentMonthlyCost: '8000', targetMonthlyCost: '' });
  assert.equal(data.currentMonthlyCost, 8000);
  assert.equal(data.targetMonthlyCost, 8000);
});

test('validateForReport returns actionable required-field errors', () => {
  const errors = app.validateForReport({ age: 0, currentMonthlyCost: 0, targetMonthlyCost: 0 });
  assert.deepEqual(Object.keys(errors), ['age', 'currentMonthlyCost', 'targetMonthlyCost']);
});

test('desired retirement age cannot be below current age', () => {
  const errors = app.validateForReport({ age: 40, desiredRetirementAge: 35, currentMonthlyCost: 8000, targetMonthlyCost: 8000 });
  assert.equal(errors.desiredRetirementAge, '希望退休年龄不能小于当前年龄');
});
```

- [ ] **Step 2: Run app tests and verify RED**

Run: `node --test tests/app.test.js`

Expected: FAIL because `js/app.js` does not exist.

- [ ] **Step 3: Implement a testable UMD app module**

Expose `normalizeFormData`, `validateForReport`, and `init`. Guard DOM startup with `if (typeof document !== 'undefined')`. Normalize restored values through the calculator. In the browser, bind landing, previous, next, generate, restart, and clear buttons. Persist form data and current step under one namespaced LocalStorage key: `retirement-test:v1:draft`.

- [ ] **Step 4: Implement navigation and inline validation**

Only one fieldset is visible at once. Next validates the current step's required fields; final generation validates all report prerequisites, returns to the earliest invalid step, displays short inline errors, and focuses the first invalid field. Update asset, debt, net-asset, and monthly-investable summaries on `input` and `change`.

- [ ] **Step 5: Run app and structure tests and commit**

Run: `node --test tests/app.test.js tests/structure.test.js`

Expected: all tests pass.

```powershell
git add js/app.js index.html tests/app.test.js tests/structure.test.js
git commit -m "feat: add five-step form workflow"
```

## Task 6: Report rendering and retirement scenarios

**Files:**
- Modify: `js/app.js`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `tests/structure.test.js`

- [ ] **Step 1: Extend the structure test with report contracts and verify RED**

Require unique output IDs for every result:

```js
for (const id of ['cashflow-rate', 'asset-rate', 'asset-work-power', 'labor-rate', 'safety-months', 'estimated-age', 'countdown-days', 'accelerator-list', 'retirement-stage']) {
  assert.match(html, new RegExp(`id="${id}"`));
}
assert.match(html, /想持续追踪退休率变化/);
assert.match(html, /进入《退了吗》/);
```

Run: `node --test tests/structure.test.js`

Expected: FAIL for missing report output hooks.

- [ ] **Step 2: Add report markup and render functions**

Add eight focused report sections in the approved order. In `app.js`, call `calculateMetrics`, `estimateRetirement`, and `calculateAccelerators` exactly once per report generation and pass results to small render functions. Show truthful values over 100%, clamp only progress-bar width, and use explicit covered/target-reached badges. If retirement time is unavailable, show the approved non-numeric message.

- [ ] **Step 3: Add compliance-aware copy states**

For 90%+ cashflow status include “不代表你一定可以辞职”. For the estimate include “该结果只是测算，不代表承诺，也不构成投资建议”. For accelerator results include “场景模拟，不是投资建议”. The CTA button must show an inline “MVP 暂未接入真实地址” status and must not navigate.

- [ ] **Step 4: Run all tests and commit**

Run: `node --test tests/*.test.js`

Expected: all tests pass with no warnings.

```powershell
git add index.html styles.css js/app.js tests/structure.test.js
git commit -m "feat: render retirement progress report"
```

## Task 7: Share poster and PNG download

**Files:**
- Create: `tests/share-card.test.js`
- Create: `js/share-card.js`
- Modify: `js/app.js`
- Modify: `index.html`
- Modify: `styles.css`

- [ ] **Step 1: Write a failing test for poster content**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const share = require('../js/share-card.js');

test('buildShareLines includes required metrics and safe footer', () => {
  const lines = share.buildShareLines({
    cashflowRate: '21%', assetRate: '34%', assetWorkPower: '¥1,680.00/月',
    laborRate: '79%', estimatedAge: '58 岁', countdown: '10482 天', stage: '现金流萌芽期'
  });
  const text = lines.join('\n');
  for (const required of ['现金流退休率', '资产退休率', '资产工作力', '劳动依赖率', '预计退休年龄', '距离目标状态', '退休不是年龄，是资产开始承担生活', '仅供自我观察']) {
    assert.match(text, new RegExp(required));
  }
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/share-card.test.js`

Expected: FAIL because `js/share-card.js` does not exist.

- [ ] **Step 3: Implement poster data and Canvas drawing**

Expose `buildShareLines`, `drawShareCard`, and `downloadShareCard` through UMD. `drawShareCard(canvas, data)` uses a 1080×1600 logical canvas, device-independent fixed layout, white background, black typography, gray dividers, and cool-blue progress accent. Use only system fonts and text; no external images. Wrap footer copy within the canvas and include the short disclosure.

- [ ] **Step 4: Bind dialog, preview, and download**

The app opens the poster dialog only after a report exists, passes formatted report data to Canvas, and provides close and save buttons. Save uses `canvas.toDataURL('image/png')` and a temporary anchor named `我的退休进度报告.png`. Return focus to the trigger after closing.

- [ ] **Step 5: Run all tests and commit**

Run: `node --test tests/*.test.js`

Expected: all tests pass.

```powershell
git add js/share-card.js js/app.js index.html styles.css tests/share-card.test.js
git commit -m "feat: generate downloadable retirement poster"
```

## Task 8: Documentation and compliance audit

**Files:**
- Create: `README.md`
- Create: `docs/product-notes.md`
- Modify: `tests/structure.test.js`

- [ ] **Step 1: Add failing documentation assertions**

```js
const readme = fs.readFileSync('README.md', 'utf8');
const notes = fs.readFileSync('docs/product-notes.md', 'utf8');

test('documentation states isolation, assumptions, and local operation', () => {
  assert.match(readme, /未修改.*wealth-freedom-demo/);
  assert.match(readme, /python -m http\.server 4173/);
  assert.match(notes, /4% 仅作为简化估算假设/);
  assert.match(notes, /零收益保守模型/);
  assert.match(notes, /未开始领取.*不计入当前被动收入/);
});
```

Run: `node --test tests/structure.test.js`

Expected: FAIL because documentation files do not exist.

- [ ] **Step 2: Write README**

Document direct `index.html` opening, recommended `python -m http.server 4173`, URL `http://127.0.0.1:4173`, `node --test tests/*.test.js`, browser-only storage, clear-data control, supported features, placeholder CTA/share boundaries, and the exact statement that the existing《退了吗》project was not modified.

- [ ] **Step 3: Write product notes**

Document product positioning, each formula, frequency rules, safety cushion using cash only, zero-return timing model, accelerator method, stage thresholds, 4% caveat, passive/semi-passive/pension caveats, full disclaimer, and future one-way CTA/data-export boundary.

- [ ] **Step 4: Run tests and static scans**

```powershell
node --test tests/*.test.js
rg -n "https?://|fetch\(|XMLHttpRequest|WebSocket" index.html styles.css js README.md docs/product-notes.md
```

Expected: tests pass; scan finds only the documented local `http://127.0.0.1:4173` URL in README and no production network code.

- [ ] **Step 5: Commit documentation**

```powershell
git add README.md docs/product-notes.md tests/structure.test.js
git commit -m "docs: document retirement test boundaries"
```

## Task 9: Full verification and self-audit

**Files:**
- Modify only if a failing test or verified browser defect requires a focused fix; every defect first receives a failing regression test where feasible.

- [ ] **Step 1: Run automated verification**

```powershell
node --test tests/*.test.js
git diff --check
git status --short
```

Expected: all tests pass, no whitespace errors, only intentional uncommitted verification fixes if any.

- [ ] **Step 2: Start a local static server**

Run from the project root: `python -m http.server 4173 --bind 127.0.0.1`

Expected: server listens on `http://127.0.0.1:4173`.

- [ ] **Step 3: Verify the desktop and mobile flows in the in-app browser**

At desktop and a narrow mobile viewport, verify landing, all five steps, back/next, required errors, live totals, report values, over-100% badges, unavailable estimate, CTA placeholder, restart, and no horizontal overflow. Inspect the browser console and network state for errors or unexpected requests.

- [ ] **Step 4: Verify persistence and poster behavior**

Enter a partial draft, reload, confirm restoration, clear it, and confirm removal. Generate a representative report, open the poster, confirm every required metric and disclaimer is visible, trigger PNG save, and confirm the browser accepts the download action.

- [ ] **Step 5: Audit isolation and scope**

From `C:\Users\18955\Desktop\Codex_work\ios_app`, list top-level changes and confirm all work is under `retirement-test`. Do not change or stage anything under `wealth-freedom-demo`. Verify the new repository log contains only this project's commits.

- [ ] **Step 6: Commit verified fixes and produce the handoff**

If verification required fixes, commit them with focused messages after regression tests pass. Final handoff must state project location, original-project isolation, local run instructions, implemented metrics, MVP placeholders, disclaimer presence, future integration boundary, test evidence, and one concrete next step.
