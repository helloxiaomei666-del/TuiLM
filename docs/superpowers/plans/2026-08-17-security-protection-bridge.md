# TuiLM Phase 3 Security Protection Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将小程序持久化的 `securityAccounts` 原始事实通过纯 bridge 投影为 canonical `protectionAccounts`，并加入中文显式确认、确认失效和端到端保护边界。

**Architecture:** `securityAccounts` 继续是唯一持久化来源；新增无副作用的 `buildProtectionAccounts(securityAccounts)`，由 `overview-model` 在 canonical input 入口调用。Security 页面只增加最小确认区：完整确认或明确暂无都显式写入 `inputCompletion.protectionAccounts`，任何受管事实修改都原子地将其置为 `false`。

**Tech Stack:** WeChat Mini Program JavaScript/WXML, CommonJS utilities, Node built-in test runner, existing `storage`/`retirement-index-adapter` contracts.

## Global Constraints

- 本计划只描述后续实现；当前工作区不得修改生产代码或测试代码。
- 不实施 Drag、Web/H5、SDK、券商、网络、真实行情或大规模 Security UI 重构。
- `securityAccounts` 是唯一持久化事实；`protectionAccounts` 只在内存中派生，不进入 `storage.js`、`schemaVersion`、local storage 或快照。
- 不得从 demo 默认值、对象非空、余额或一次字段输入自动推断 `inputCompletion.protectionAccounts = true`。
- 新增用户可见按钮、状态、说明、Toast、Modal 和交互文案全部使用中文。
- 对 `balance`、`yearsPaid`、`personalMonthly`、`employerMonthly`、`estimatedMonthlyBenefit`、`loanOffsetMonthly`，只有 `Number.isFinite(value) && value >= 0` 才能进入 canonical 数值字段；非法或负数直接省略，不使用 `abs()`、非法值补零或正向转换。
- `actualMonthlyReceived: 0` 只作为 pension/enterpriseAnnuity/occupationalAnnuity 的派生安全标记，不是用户报告的 0 元收入事实。
- `estimatedMonthlyBenefit` 不得改变 `monthlyStablePassiveIncome` 或 `passiveIncomeCoverageRate`；当前领取收入仍只能来自 Income Phase 2 的 `pension_received` 或 `annuity_received`。
- `social_security` 是已存在 canonical type；`welfare_asset` 只作为已存在 Security 内部 role label，不能新增或伪装其他 canonical enum。
- 不修改 `retirement-index-model.js`、`retirement-index-adapter.js` 的公式/契约；只有 TDD Red 证明现有 contract 阻断时才可另行批准。
- 当前执行不得 commit、push 或 tag。

---

## File Map

| 文件 | 责任 |
| --- | --- |
| Create `apps/wealth-freedom-demo/wechat-miniapp/utils/security-protection-accounts-bridge.js` | 纯函数 `buildProtectionAccounts`、固定 source mapping 和 numeric sanitization。 |
| Modify `apps/wealth-freedom-demo/wechat-miniapp/utils/overview-model.js` | 在 `buildCanonicalRetirementInput` 的单一入口调用 bridge，禁止旧对象/派生字段回退。 |
| Modify `apps/wealth-freedom-demo/wechat-miniapp/pages/security/security.js` | 中文确认状态、完整确认、明确暂无、事实修改后的 completion 失效。 |
| Modify `apps/wealth-freedom-demo/wechat-miniapp/pages/security/security.wxml` | 最小确认状态卡、按钮和说明；不改变既有 Security 分类布局。 |
| Create `apps/wealth-freedom-demo/tests/fixtures/security-protection-accounts-phase3.fixture.js` | bridge 和页面测试共享的合法、缺失、非法、demo/user 原始事实。 |
| Create `apps/wealth-freedom-demo/tests/security-protection-accounts-bridge.test.js` | bridge 映射、类型证据、字段省略、不可变性和 future-income isolation 的 Red/Green 测试。 |
| Create `apps/wealth-freedom-demo/tests/security-input-phase3.test.js` | 页面显式确认、confirmed-none、mutation invalidation、中文 UX 和 storage boundary 测试。 |
| Modify `apps/wealth-freedom-demo/tests/overview-retirement-index.test.js` | Overview → bridge → adapter → model 的集成断言；不修改退休率公式断言。 |
| Modify `apps/wealth-freedom-demo/tests/wechat-miniapp-page-smoke.test.js` | 现有 Security 页面 smoke 测试补充确认状态/操作和修改后失效。 |

不修改：`apps/wealth-freedom-demo/wechat-miniapp/utils/storage.js`、
`wechat-miniapp/utils/retirement-index-model.js`、`wechat-miniapp/utils/retirement-index-adapter.js`、
`wechat-miniapp/utils/demo-data.js`。

## Task 1: Lock the Bridge Contract with Red Tests

**Files:**
- Create: `apps/wealth-freedom-demo/tests/fixtures/security-protection-accounts-phase3.fixture.js`
- Create: `apps/wealth-freedom-demo/tests/security-protection-accounts-bridge.test.js`
- Create later: `apps/wealth-freedom-demo/wechat-miniapp/utils/security-protection-accounts-bridge.js`

**Interfaces:**
- Consumes: raw object with source keys `pension`, `housingFund`, `supplementalHousingFund`, `enterpriseAnnuity`, `occupationalAnnuity`.
- Produces: `buildProtectionAccounts(securityAccounts = {}) -> Array`; each emitted record has `id`, `sourceKey`, `type`, `status`, `coverageLevel: "partial"` and only valid numeric fields.

- [ ] **Step 1: Add the shared fixture with all mapping cases.**

  Include one valid object with these expected source facts: pension balance `120000`, years `12`, personal monthly `900`, employer monthly `1800`, estimated benefit `2600`; housing balance `85000`, personal/employer monthly `1200`, offset `0`; supplemental balance `20000`, personal/employer monthly `400`, offset `0`; enterprise balance `30000`, personal `200`, employer `300`, estimated benefit `300`; occupational all zero. Include an empty object, an object with only unknown/reserved keys, and an invalid-values object containing `NaN`, `Infinity`, `-Infinity`, `-1`, and missing fields.

- [ ] **Step 2: Write failing bridge tests.**

  Use Node’s `node:test` and `node:assert/strict`. The main mapping assertion must require this exact shape for the pension record:

  ```js
  {
    id: "security:pension",
    sourceKey: "pension",
    type: "social_security",
    status: "future",
    coverageLevel: "partial",
    balance: 120000,
    yearsPaid: 12,
    personalMonthlyContribution: 900,
    employerMonthlyContribution: 1800,
    actualMonthlyReceived: 0,
    futureEstimatedMonthlyAmount: 2600,
  }
  ```

  Also assert: enterprise and occupational use `social_security`; housing and supplemental use `welfare_asset` with `sourceKey` distinguishing them; `commercialPensionInsurance` and unknown keys emit nothing; output order is pension, housing, supplemental, enterprise, occupational; `buildProtectionAccounts({})` is `[]`; source input is deep-equal before and after the call.

- [ ] **Step 3: Add Red tests for numeric sanitization and future-income isolation.**

  For every user fact field, assert valid finite non-negative values are present and each invalid/negative value is absent rather than `0` or a positive number. Assert pension/enterprise/occupational always expose `actualMonthlyReceived === 0` when the group has at least one valid fact, while the estimated amount is only `futureEstimatedMonthlyAmount`. Assert the bridge output contains no `incomeSources`, `netMonthlyPassiveIncome`, or `monthlyStablePassiveIncome` field.

- [ ] **Step 4: Run the Red suite.**

  Run from `C:\Users\18955\Desktop\Codex_work\TuiLM\apps\wealth-freedom-demo`:

  ```powershell
  node --test tests/security-protection-accounts-bridge.test.js
  ```

  Expected: FAIL because `security-protection-accounts-bridge.js` and `buildProtectionAccounts` do not exist. Do not alter production code in this step.

## Task 2: Implement the Pure Security Protection Bridge

**Files:**
- Create: `apps/wealth-freedom-demo/wechat-miniapp/utils/security-protection-accounts-bridge.js`
- Test: `apps/wealth-freedom-demo/tests/security-protection-accounts-bridge.test.js`

**Interfaces:**
- Consumes: `securityAccounts` raw object only; no `inputCompletion`, storage, wx, adapter, or model dependency.
- Produces: exported `buildProtectionAccounts(securityAccounts = {})` returning a fresh array.

- [ ] **Step 1: Implement the fixed group registry.**

  Define the ordered registry in this exact order: `pension`, `housingFund`, `supplementalHousingFund`, `enterpriseAnnuity`, `occupationalAnnuity`. Map pension/enterprise/occupational to `type: "social_security"`, `status: "future"`; map housing/supplemental to `type: "welfare_asset"`, `status: "current"`; set every emitted record’s `coverageLevel` to `"partial"`; never register `commercialPensionInsurance` as an output group.

- [ ] **Step 2: Implement finite non-negative field projection.**

  Use a helper equivalent to:

  ```js
  function validNonNegative(value) {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  ```

  Map `personalMonthly` → `personalMonthlyContribution`, `employerMonthly` → `employerMonthlyContribution`, `estimatedMonthlyBenefit` → `futureEstimatedMonthlyAmount`, and `loanOffsetMonthly` → `currentLoanOffsetMonthly`. Add `actualMonthlyReceived: 0` only for future retirement groups. Omit a field when the helper returns `null`; do not mutate the raw object.

- [ ] **Step 3: Emit only groups with at least one valid user fact.**

  If a known group is missing or all its managed numeric fields are invalid/missing, return no record for that group. When at least one valid field exists, emit the stable `id: \`security:${sourceKey}\`` and `sourceKey`. Do not coerce strings, NaN, infinities, or negatives into output values.

- [ ] **Step 4: Run the Green bridge suite.**

  ```powershell
  node --test tests/security-protection-accounts-bridge.test.js
  ```

  Expected: PASS, including mapping, output order, immutability, invalid-value omission, reserved/unknown exclusion, and absence of income fields.

## Task 3: Wire Overview to the Bridge Without Persistence Changes

**Files:**
- Modify: `apps/wealth-freedom-demo/wechat-miniapp/utils/overview-model.js:41-70`
- Modify: `apps/wealth-freedom-demo/tests/overview-retirement-index.test.js`

**Interfaces:**
- Consumes: `buildProtectionAccounts` from Task 2 and `state.securityAccounts`.
- Produces: `buildCanonicalRetirementInput` passes a freshly derived `protectionAccounts` array to the existing adapter while preserving `state.securityAccounts` and `inputCompletion`.

- [ ] **Step 1: Add the failing Overview integration assertion.**

  Build a complete raw state from the Phase 3 fixture without a persisted `protectionAccounts` field. Call `getOverviewModel(state)` with the existing canonical-required profile/assets/income/drag facts and no completion override. Assert the expected canonical completeness can only become complete when the Security object is bridged; assert `monthlyStablePassiveIncome` equals the same result with the Security object removed because future estimated benefits are not income.

- [ ] **Step 2: Replace the old Security fallback in `buildCanonicalRetirementInput`.**

  Add `const { buildProtectionAccounts } = require("./security-protection-accounts-bridge");` and replace the current conditional:

  ```js
  protectionAccounts: Array.isArray(state.protectionAccounts)
    ? state.protectionAccounts
    : Array.isArray(state.securityAccounts)
      ? state.securityAccounts
      : [],
  ```

  with:

  ```js
  protectionAccounts: buildProtectionAccounts(state.securityAccounts || {}),
  ```

  Do not add a persisted `protectionAccounts` field or modify the adapter/model.

- [ ] **Step 3: Verify the Overview integration and formula boundary.**

  ```powershell
  node --test tests/overview-retirement-index.test.js tests/security-protection-accounts-bridge.test.js
  ```

  Expected: PASS. Confirm that the overview receives an array derived from raw Security facts, `securityAccounts` remains unchanged, estimated benefits do not change `monthlyStablePassiveIncome` or `passiveIncomeCoverageRate`, and existing retirement-index values/weights remain unchanged.

## Task 4: Add Chinese Security Confirmation and Mutation Invalidation

**Files:**
- Modify: `apps/wealth-freedom-demo/wechat-miniapp/pages/security/security.js`
- Modify: `apps/wealth-freedom-demo/wechat-miniapp/pages/security/security.wxml`
- Create: `apps/wealth-freedom-demo/tests/security-input-phase3.test.js`
- Modify: `apps/wealth-freedom-demo/tests/wechat-miniapp-page-smoke.test.js`

**Interfaces:**
- Consumes: `storage.loadState/saveState`, `buildProtectionAccounts`, and current Security page state.
- Produces: page methods `confirmProtectionAccounts()`, `confirmNoProtectionAccounts()`, and a page-visible completion text derived from `inputCompletion.protectionAccounts` plus bridge output.

- [ ] **Step 1: Write failing page tests modeled on `tests/income-input-phase2.test.js`.**

  Use the existing page loader and wx test doubles. Define `loadSecurityPage()` with the same `global.Page` capture/restore pattern as `loadIncomePage()` in `tests/income-input-phase2.test.js`, call `storage.clearState()` before each test, and use this concrete assertion set:

  ```js
  test("keeps empty security facts pending until explicit confirmation", () => {
    const page = loadSecurityPage();
    page.onShow();
    const state = storage.loadState();
    assert.equal(state.mode, "user");
    assert.equal(state.inputCompletion.protectionAccounts, false);
    assert.match(page.data.securityCompletionText, /待确认/);
  });

  test("does not auto-confirm a non-empty security object", () => {
    const page = loadSecurityPage();
    const state = storage.saveState({
      ...storage.loadState(),
      securityAccounts: { pension: { balance: 120000 } },
    });
    page.onShow();
    assert.equal(state.inputCompletion.protectionAccounts, false);
    assert.equal(storage.loadState().inputCompletion.protectionAccounts, false);
    assert.match(page.data.securityCompletionText, /待确认/);
  });

  test("confirms non-empty security facts only after the Chinese action", () => {
    const page = loadSecurityPage();
    storage.saveState({
      ...storage.loadState(),
      securityAccounts: { pension: { balance: 120000 } },
    });
    page.onShow();
    page.confirmProtectionAccounts();
    assert.equal(storage.loadState().inputCompletion.protectionAccounts, true);
    assert.match(page.data.securityCompletionText, /已确认/);
  });

  test("confirms an explicit no-security answer with an empty bridge result", () => {
    const page = loadSecurityPage();
    page.onShow();
    page.confirmNoProtectionAccounts();
    assert.deepEqual(storage.loadState().securityAccounts, {});
    assert.equal(storage.loadState().inputCompletion.protectionAccounts, true);
    assert.match(page.data.securityCompletionText, /没有这些保障账户/);
  });

  test("invalidates confirmation after a Security fact changes", () => {
    const page = loadSecurityPage();
    storage.saveState({
      ...storage.loadState(),
      securityAccounts: { pension: { balance: 120000 } },
    });
    page.onShow();
    page.confirmProtectionAccounts();
    page.onSecurityInput({
      currentTarget: { dataset: { key: "pension.balance" } },
      detail: { value: "130000" },
    });
    assert.equal(storage.loadState().inputCompletion.protectionAccounts, false);
    assert.match(page.data.securityCompletionText, /待确认/);
  });
  ```

  Add assertions that all new WXML-visible confirmation labels and toast/modal strings are Chinese, and that state/storage never gains a `protectionAccounts` property.

- [ ] **Step 2: Add completion state to `security.js`.**

  In `data`, add `securityCompletionText: "保障情况待确认"`, `hasProtectionAccounts: false`, `confirmProtectionText: "确认以上是我当前完整的保障情况"`, and `confirmNoProtectionText: "我目前没有这些保障账户"`. In `applyState`, derive the bridge output, set `hasProtectionAccounts` to `records.length > 0`, and set the text to `保障情况待确认` when completion is not true, `保障情况已确认` when completion is true and records exist, and `我目前没有这些保障账户` when completion is true and the bridge is empty.

- [ ] **Step 3: Invalidate completion atomically on every Security fact update.**

  Update `onSecurityInput` so the state passed to `storage.saveState` includes the updated raw `securityAccounts` and:

  ```js
  inputCompletion: {
    ...(this.data.state.inputCompletion || {}),
    protectionAccounts: false,
  }
  ```

  Keep `storage.js` unchanged. The same invalidation must apply to any future page action that clears a managed group.

- [ ] **Step 4: Add explicit confirmation methods with Chinese validation.**

  Implement `confirmProtectionAccounts()` to set only `inputCompletion.protectionAccounts = true` when `buildProtectionAccounts(currentState.securityAccounts).length > 0`; otherwise show `请先录入保障信息，或确认目前没有这些保障账户`. Implement `confirmNoProtectionAccounts()` to set completion true only when the bridge result is empty; when records exist, show `请先清空或核对保障账户信息`. Neither method writes `protectionAccounts` or changes income/assets.

- [ ] **Step 5: Add the minimal Chinese WXML confirmation section.**

  Reuse existing `card`/`form-actions` styles and add a status text bound to `securityCompletionText`. Render `confirmProtectionText` under `wx:if="{{hasProtectionAccounts}}"` with `bindtap="confirmProtectionAccounts"`; render `confirmNoProtectionText` under `wx:if="{{!hasProtectionAccounts}}"` with `bindtap="confirmNoProtectionAccounts"`. Include the exact explanatory copy `确认表示你已检查当前页面内容；不会把预计月领计入当前被动收入。` and do not redesign category tabs, group cards, or field layout.

- [ ] **Step 6: Run the focused page tests.**

  ```powershell
  node --test tests/security-input-phase3.test.js tests/wechat-miniapp-page-smoke.test.js
  ```

  Expected: PASS for pending, explicit full confirmation, explicit confirmed-none, mutation invalidation, Chinese UX, raw storage preservation, and existing Security page behavior.

## Task 5: Full Regression and Phase Gate Verification

**Files:**
- Modify only if a focused regression test exposes a real contract mismatch: the files listed in Tasks 1–4.

**Interfaces:**
- Consumes: all Task 1–4 outputs.
- Produces: verified Phase 3 implementation readiness evidence; no new API, schema, formula, SDK, network, or commit.

- [ ] **Step 1: Run all focused Phase 3 and neighboring contract tests.**

  ```powershell
  cd C:\Users\18955\Desktop\Codex_work\TuiLM\apps\wealth-freedom-demo
  node --test tests/security-protection-accounts-bridge.test.js tests/security-input-phase3.test.js tests/overview-retirement-index.test.js tests/wechat-miniapp-page-smoke.test.js tests/storage-input-loop-phase1.test.js tests/retirement-index-contract.test.js tests/income-input-phase2.test.js
  ```

  Expected: PASS. A failure must be diagnosed against the Phase 3 boundary; do not weaken assertions or alter retirement formulas to make the suite pass.

- [ ] **Step 2: Run syntax and static miniapp validation.**

  ```powershell
  node --check wechat-miniapp/utils/security-protection-accounts-bridge.js
  node --check wechat-miniapp/utils/overview-model.js
  node --check wechat-miniapp/pages/security/security.js
  node scripts/validate-miniapp.js
  ```

  Expected: all commands exit 0; no new page, network, SDK, or persisted canonical field is reported.

- [ ] **Step 3: Run the repository’s full miniapp test and preflight commands.**

  ```powershell
  node --test tests/*.test.js
  powershell -ExecutionPolicy Bypass -File scripts/wechat-miniapp-preflight.ps1
  ```

  Expected: all tests and preflight checks pass, including existing canonical type, storage migration, Security UI, income isolation, and overview tests.

- [ ] **Step 4: Perform the final read-only scope audit.**

  ```powershell
  git diff --check
  git status --short --untracked-files=all
  node -e "const storage=require('./wechat-miniapp/utils/storage.js'); const state=storage.loadState(); if (Object.prototype.hasOwnProperty.call(state, 'protectionAccounts')) process.exit(1);"
  git diff --name-only -- wechat-miniapp/utils/storage.js wechat-miniapp/utils/retirement-index-model.js wechat-miniapp/utils/retirement-index-adapter.js wechat-miniapp/utils/demo-data.js
  rg -n "fetch\(|https?://|SDK" wechat-miniapp/utils/security-protection-accounts-bridge.js wechat-miniapp/pages/security/security.js
  ```

  Expected: the Node assertion succeeds, the protected-file diff command prints no path, the network/SDK search prints no match, and only the explicitly planned files are changed. Do not commit, push, or tag.

## Plan Self-Review

- [x] Spec coverage: bridge mapping, canonical evidence, numeric sanitization, future-income isolation, explicit confirmation, confirmed-none, mutation invalidation, Chinese UX, storage boundary, Overview E2E, and formula boundary each have a task.
- [x] Interface consistency: every task uses `buildProtectionAccounts(securityAccounts = {}) -> Array`; Overview and page tasks consume the same bridge output.
- [x] File boundary: `storage.js`, `demo-data.js`, `retirement-index-model.js`, and `retirement-index-adapter.js` are explicitly protected; only bridge, overview, Security page, and focused tests are in scope.
- [x] No implementation is executed by this plan-writing turn; no commit step is included because the current gate forbids commit/push/tag.
- [x] Placeholder scan: no `TODO`, `TBD`, vague “write tests”, or undefined function names remain.
