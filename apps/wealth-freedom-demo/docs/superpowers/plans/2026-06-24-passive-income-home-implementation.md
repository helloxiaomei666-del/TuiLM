# Passive Income Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the strict passive-income model and replace the miniapp overview hero with the approved cashflow-first four-metric panel.

**Architecture:** Add one side-effect-free CommonJS model under `wechat-miniapp/utils/`, then let the existing `overview-model` adapt stored state and merge new metrics with the untouched legacy retirement simulation. Extend storage defaults compatibly and render the returned strings in the overview page; page code must not duplicate formulas.

**Tech Stack:** WeChat Mini Program WXML/WXSS/CommonJS JavaScript, Node.js `node:test`, existing miniapp validator.

---

## Scope and file map

- Create `tests/passive-income-model.test.js`: pure model behavior and edge cases.
- Create `wechat-miniapp/utils/passive-income-model.js`: normalization, aggregation, rates, gaps, runway, and status.
- Modify `wechat-miniapp/utils/demo-data.js`: add target living cost and demo income-stream collection.
- Modify `wechat-miniapp/utils/storage.js`: migrate `incomeStreams` without overwriting saved data.
- Modify `tests/wechat-miniapp.test.js`: storage and overview integration assertions.
- Modify `tests/wechat-miniapp-page-smoke.test.js`: runtime page binding assertions.
- Modify `wechat-miniapp/utils/overview-model.js`: call the new model and format the four metrics.
- Modify `wechat-miniapp/pages/overview/overview.js`: extend safe empty strings only.
- Modify `wechat-miniapp/pages/overview/overview.wxml`: cashflow-first hero and four-metric panel.
- Modify `wechat-miniapp/pages/overview/overview.wxss`: styles for the new panel, preserving miniapp-safe CSS constraints.

Do not modify the legacy calculation formulas, asset pages, security formulas, route page, drag page, project configuration, or Web Demo in this increment.

Because several target files already contain uncommitted user work, do not create commits containing those overlapping files. Preserve the current working tree and report the exact touched paths instead.

### Task 1: Strict passive-income model

**Files:**
- Create: `tests/passive-income-model.test.js`
- Create: `wechat-miniapp/utils/passive-income-model.js`

- [ ] **Step 1: Write failing tests for frequency conversion and strict classification**

Create tests that require this API:

```js
const {
  annualizeToMonthly,
  getMonthlyPassiveIncome,
  getMonthlySemiPassiveIncome,
} = require("../wechat-miniapp/utils/passive-income-model.js");

test("converts monthly quarterly and annual cashflow to monthly values", () => {
  assert.equal(annualizeToMonthly(1200, "monthly").value, 1200);
  assert.equal(annualizeToMonthly(3600, "quarterly").value, 1200);
  assert.equal(annualizeToMonthly(14400, "annual").value, 1200);
});

test("keeps semi-passive income out of strict passive income", () => {
  const streams = [
    { id: "rent", type: "passive", amount: 800, frequency: "monthly", status: "current", requiresLabor: false, includeInPassiveIncome: true },
    { id: "app", type: "semi_passive", amount: 300, frequency: "monthly", status: "current", requiresLabor: true, includeInSemiPassiveIncome: true },
  ];
  assert.equal(getMonthlyPassiveIncome([], streams).value, 800);
  assert.equal(getMonthlySemiPassiveIncome(streams).value, 300);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --test tests/passive-income-model.test.js
```

Expected: FAIL because `wechat-miniapp/utils/passive-income-model.js` does not exist.

- [ ] **Step 3: Implement the minimal conversion and aggregation API**

Implement pure functions with `{ ok, value, reason, warnings, items }` results. Fixed frequency rules are monthly `amount`, quarterly `amount / 3`, and annual `amount / 12`. Reject negative/non-finite amounts and unknown frequencies. Strict aggregation requires `type === "passive"`, `status === "current"`, `requiresLabor === false`, and `includeInPassiveIncome === true`; semi-passive aggregation uses its separate flag.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the same command. Expected: all Task 1 tests pass.

- [ ] **Step 5: Add failing tests for rates, gap, runway, thresholds, future income, and over-100 display**

Require these behaviors:

```js
assert.equal(getCashflowRetirementRate(800, 6000).value, 800 / 6000);
assert.equal(getLaborDependenceRate(1.25).value, 0);
assert.deepEqual(getPassiveIncomeGap(7500, 6000).value, { gap: 0, surplus: 1500 });
assert.equal(getRunwayMonths(51000, 6000).value, 8.5);
assert.equal(getRetirementStatus({ targetMonthlyLivingCost: 6000 }, [], streams).status.code, "cashflow_seed");
```

Also test invalid/zero living cost, exact 10/30/60/90 percent boundaries, future pension exclusion, and a semi-passive stream with `includeInPassiveIncome: true` remaining excluded.

- [ ] **Step 6: Run focused tests and verify RED for missing functions**

Expected: FAIL because the new rate and status functions are not yet exported.

- [ ] **Step 7: Implement the minimal metric and status functions**

Use raw rates for status, `Math.min(rawRate, 1)` for progress display, and `Math.max(0, 1 - rawRate)` for labor dependence. Select `targetMonthlyLivingCost` first, then `monthlyLivingCost`; return `ok: false` if both are invalid. The status boundaries are `<10`, `10–<30`, `30–<60`, `60–<90`, and `>=90` percent.

- [ ] **Step 8: Run focused tests and verify GREEN**

Expected: all passive-income model tests pass with no warnings.

### Task 2: Compatible default state and migration

**Files:**
- Modify: `wechat-miniapp/utils/demo-data.js`
- Modify: `wechat-miniapp/utils/storage.js`
- Modify: `tests/wechat-miniapp.test.js`

- [ ] **Step 1: Write failing migration tests**

Add assertions that default state contains `userProfile.targetMonthlyLivingCost` and `incomeStreams`, and that `storage.migrateState({ holdings: [] })` returns an empty income-stream array without altering holdings.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --test tests/wechat-miniapp.test.js
```

Expected: FAIL because defaults and migration do not yet expose `incomeStreams`.

- [ ] **Step 3: Add compatible defaults and migration**

Set demo `targetMonthlyLivingCost` equal to the existing `livingCost` so the initial denominator remains explainable. Add `defaultIncomeStreams` as an empty array. In `migrateState`, preserve saved arrays and otherwise use defaults:

```js
incomeStreams: Array.isArray(state && state.incomeStreams)
  ? state.incomeStreams
  : defaults.incomeStreams,
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Expected: the storage/default tests pass and existing storage tests remain green.

### Task 3: Overview-model integration

**Files:**
- Modify: `tests/wechat-miniapp.test.js`
- Modify: `wechat-miniapp/utils/overview-model.js`

- [ ] **Step 1: Write a failing overview integration test**

Build a state with target living cost 6,000 and one strict monthly passive stream of 800. Assert:

```js
assert.equal(model.cashflowRetirementRateText, "13.3%");
assert.equal(model.cashflowRetirementProgressWidth, "13.3%");
assert.equal(model.laborDependenceRateText, "86.7%");
assert.equal(model.monthlyPassiveIncomeText, "800 元");
assert.match(model.cashflowHeadlineText, /13.3%/);
assert.match(model.cashflowDenominatorText, /目标生活成本/);
```

Also assert that existing `progressText`, `freedomDate`, and `monthlyInvestableText` remain available.

- [ ] **Step 2: Run the focused test and verify RED**

Expected: FAIL because the new overview fields are undefined.

- [ ] **Step 3: Integrate the passive-income model**

Call `getRetirementStatus` from `overview-model`. Pass existing asset progress as `assetRetirementRate`, current cash holdings as conservative `liquidAssets`, and current required outflow as living cost plus mortgage, car loan, other debt, and manual drag total. Format strings in the model; do not put formulas in WXML or page code.

- [ ] **Step 4: Run the focused test and verify GREEN**

Expected: new and legacy overview assertions pass.

### Task 4: Cashflow-first overview UI

**Files:**
- Modify: `tests/wechat-miniapp.test.js`
- Modify: `tests/wechat-miniapp-page-smoke.test.js`
- Modify: `wechat-miniapp/pages/overview/overview.js`
- Modify: `wechat-miniapp/pages/overview/overview.wxml`
- Modify: `wechat-miniapp/pages/overview/overview.wxss`

- [ ] **Step 1: Write failing static and page-smoke tests**

Require visible text and bindings for:

```text
现金流退休率
资产退休率
安全垫月数
劳动依赖率
完全被动收入
```

Assert that the overview page data has safe string defaults for every new binding, loads the new model fields, and includes a target-living-cost input bound to `targetMonthlyLivingCost`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
node --test tests/wechat-miniapp.test.js tests/wechat-miniapp-page-smoke.test.js
```

Expected: FAIL because the new UI copy and bindings are absent.

- [ ] **Step 3: Implement the overview UI**

Replace the hero's primary emphasis with cashflow retirement rate and its explanation. Render a four-card panel in this order: cashflow retirement rate, asset retirement rate, runway months, labor dependence rate. Keep expected retirement date and target gap in a secondary legacy section. Add `targetMonthlyLivingCost` to the existing profile edit form. Preserve privacy navigation and all four action buttons.

- [ ] **Step 4: Add miniapp-safe styles**

Use flex layouts only; do not introduce CSS Grid, pseudo-elements, viewport font units, radii outside existing validator rules, or optional chaining in JavaScript. Keep `padding-bottom: 136rpx` on `.overview-page`.

- [ ] **Step 5: Run focused tests and verify GREEN**

Expected: both overview-focused files pass.

### Task 5: Regression and simulator-ready verification

**Files:**
- No product changes expected.

- [ ] **Step 1: Run syntax checks on changed JavaScript**

```powershell
node --check wechat-miniapp/utils/passive-income-model.js
node --check wechat-miniapp/utils/overview-model.js
node --check wechat-miniapp/utils/demo-data.js
node --check wechat-miniapp/utils/storage.js
node --check wechat-miniapp/pages/overview/overview.js
```

Expected: all exit 0.

- [ ] **Step 2: Run the miniapp validator**

```powershell
node scripts/validate-miniapp.js
```

Expected: `Miniapp validation passed.`

- [ ] **Step 3: Run all tests recursively**

```powershell
$tests = Get-ChildItem tests -Recurse -Filter *.test.js | Select-Object -ExpandProperty FullName
node --test $tests
```

Expected: 0 failures.

- [ ] **Step 4: Run the project preflight**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/wechat-miniapp-preflight.ps1
```

Expected: local project checks pass; external developer-tool/account checks may remain explicitly reported as external prerequisites.

- [ ] **Step 5: Inspect the final diff scope**

Confirm only the planned files changed during this implementation and no project configuration, legacy formula, Web Demo, route, asset, security, or drag files were edited.
