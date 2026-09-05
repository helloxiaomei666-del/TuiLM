# TuiLM Phase 4A Liability Facts and Expense Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add schema-v3 `liabilities[]` raw facts, a Chinese-only liability page, and in-memory expense-deduplication summaries without changing any current retirement calculation or legacy simulation result.

**Architecture:** Keep `liabilities[]` as the sole persisted liability fact source. Put item validation and the five specified summary values in a pure `liability-model.js`; let `storage.js` own schema-v3 migration, raw-fact validation, and derived-field stripping. The new non-tab page owns only form state, CRUD, explicit confirmation, and presentation of the three allowed summary values; it must not alter Overview or canonical retirement input.

**Tech Stack:** WeChat Mini Program CommonJS modules, conservative ES6, Node built-in `node:test`, `node:assert/strict`, existing wx/Page mocks, and `node scripts/validate-miniapp.js`.

**Spec:** `docs/superpowers/specs/2026-08-22-liability-facts-expense-dedup-design.md`

**Task 2 review contract revision:** This records the Task 2 storage-contract amendment made from `6b5d3c881aed43f5eed0b5564b5032f5c06c4f0b feat(miniapp): add liability fact summary model`. The Phase 4A implementation chain subsequently advanced through Task 2, Task 3, and Task 4; the current committed HEAD is `39d0fd2 feat(miniapp): add liability input page`. The amended malformed-v3 rejection and snapshot-derived-field persistence rules remain authoritative; this historical revision does not impose a current implementation or Git-operation restriction.

## Global Constraints

- The original design baseline was `272dca1 feat(miniapp): bridge security into retirement protection`; the Task 2 review revision baseline is the full hash above. Read the authoritative spec before each implementation task; the spec takes precedence over this plan.
- Implement `schemaVersion: 3`; v2 always migrates to `liabilities: []` and `inputCompletion.liabilities: false` while preserving legacy `userProfile.mortgage`, `carLoan`, `otherDebt`, and `manualDrags` unchanged.
- V2 initialization is not a malformed-v3 fallback. When `schemaVersion === 3`, `liabilities` is required and must be an array accepted in full by Task 1's `validateLiabilityFacts()`. `null`, object, string, number, boolean, explicit `undefined`, missing, other non-arrays, and invalid array items fail identically at save/load/migration boundaries with the validator's Chinese error. Never replace them with `[]` or confirmed-none.
- `MALFORMED_V3_LOAD -> ERROR -> ZERO STORAGE WRITE`: validation failure must leave the original wx record and memory state unchanged, including when liability completion is true. No `setStorageSync`, `removeStorageSync`, partial write, default-state replacement, or destructive normalization is allowed. Save failure is likewise non-writing; migration/canonicalization must not mutate its input. Validate before committing any derived-field cleanup.
- A current liability has exactly V1 fields `id`, `type`, `outstandingBalance`, `monthlyPayment`, `includedInEssentialExpense`, `source`, and `note`; no other type is valid.
- `outstandingBalance` is valid only when `Number.isFinite(value) && value > 0`; zero means settled and must be rejected. `monthlyPayment` is valid only when finite and greater than or equal to zero.
- `id` is non-empty, unique within `liabilities[]`, stable after creation, preserved by editing, and not user-editable. Use the current income-page timestamp-plus-sequence local pattern in the controller, and check against existing IDs before accepting a new candidate; do not display the ID.
- `source` is always system-written `manual` in V1. Do not add import, broker, SDK, network, quote, or synchronization behavior.
- `includedInEssentialExpense` is an explicit boolean in every persisted `LiabilityFact`. New page-form state starts as `null` to represent “尚未选择”; `null` is temporary page state only, never a raw fact or storage value. Never infer either boolean from type, amount, legacy profile fields, `manualDrags`, title, or note.
- The only new summary formula owner is `calculateLiabilitySummary(liabilities, context)`. It produces `totalLiabilities`, `totalMonthlyPayment`, `uncoveredMonthlyPayment`, `effectiveEssentialExpense`, and `investableNetAssets` in memory only.
- Persisted raw facts include `liabilities`, `manualDrags`, and `securityAccounts`. Non-persisted derived payloads include `protectionAccounts`, `dragItems`, and the five liability summary fields; none may survive at state top level or inside `calculationSnapshots`, `valuationSnapshots`, or any other already-known Phase 4A persisted snapshot container, including nested objects and arrays. Preserve legal historical snapshot fields, records, order, and existing raw facts; do not clear snapshots, recompute history, redesign their schema, or introduce new containers. Further liability-derived scores/recommendations remain prohibited.
- The existing boolean `inputCompletion.protectionAccounts` and `inputCompletion.dragItems` are confirmation facts, not the same-named derived payloads. Preserve their semantics and all legitimate completion fields. Do not blindly delete matching names throughout every object or expand the snapshot rule to remove every historical calculation field; preserve existing top-level canonical stripping separately.
- The liability page may show only `负债总额`, `每月总还款`, and `尚未计入必要支出的月供`. It must not display `effectiveEssentialExpense` or `investableNetAssets`.
- Add `inputCompletion.liabilities` as explicit user confirmation only. It must not enter the canonical retirement completeness gate.
- Do not modify `retirement-index-adapter.js`, `retirement-index-model.js`, `calculation-core.js`, retirement-rate formulas, Drag scoring/types/gates, or the legacy retirement-time simulation.
- Keep the tabBar at five items. Register `pages/liabilities/liabilities` as a non-tab page reached from Overview through `wx.navigateTo`.
- Every new user-visible label, helper, empty state, Toast, Modal, and rejection message is Chinese; do not expose raw enum names, booleans, `manual`, `liabilities`, `dragItems`, schema versions, or completeness enums.
- All implementation work is TDD: add the targeted failing test first, observe its functional RED, make the smallest implementation change, observe GREEN, then run the listed regression command.
- This document is a plan only. Do not execute its code changes, test changes, commits, SDK calls, or network calls while authoring or reviewing the plan.

## Planned File Map

| File | Planned responsibility |
| --- | --- |
| `apps/wealth-freedom-demo/wechat-miniapp/utils/liability-model.js` | Pure V1 item validation, Chinese type labels, and the five in-memory summary values. |
| `apps/wealth-freedom-demo/wechat-miniapp/utils/demo-data.js` | Schema-v3 defaults, empty `liabilities`, and the new completion key. |
| `apps/wealth-freedom-demo/wechat-miniapp/utils/storage.js` | v2 initialization, symmetric v3 validation with zero-write failure, completion normalization, and derived stripping at state/snapshot boundaries. |
| `apps/wealth-freedom-demo/wechat-miniapp/pages/liabilities/liabilities.js` | Controller-only CRUD, validation messages, confirmation, and presentation data. |
| `apps/wealth-freedom-demo/wechat-miniapp/pages/liabilities/liabilities.json` | Page configuration. |
| `apps/wealth-freedom-demo/wechat-miniapp/pages/liabilities/liabilities.wxml` | Chinese form, list, confirmation, legacy reminder, and exactly three visible summaries. |
| `apps/wealth-freedom-demo/wechat-miniapp/pages/liabilities/liabilities.wxss` | Page-local styles using existing Mini Program-safe WXSS conventions. |
| `apps/wealth-freedom-demo/wechat-miniapp/app.json` | Register the non-tab liability page without changing the five tab entries. |
| `apps/wealth-freedom-demo/wechat-miniapp/pages/overview/overview.js` | Add only `openLiabilities()` navigation behavior. |
| `apps/wealth-freedom-demo/wechat-miniapp/pages/overview/overview.wxml` | Add one Chinese Overview entry for the liability page. |
| `apps/wealth-freedom-demo/tests/fixtures/liability-facts-phase4a.fixture.js` | Valid V1 facts, invalid variants, v2 legacy input, and non-interference baseline states. |
| `apps/wealth-freedom-demo/tests/liability-facts-phase4a.test.js` | Pure validation and exact five-value summary contracts. |
| `apps/wealth-freedom-demo/tests/storage-input-loop-phase1.test.js` | Existing migration, wx, memory, canonical-derived stripping, and raw-fact persistence coverage updated for v3. |
| `apps/wealth-freedom-demo/tests/liability-non-interference-phase4a.test.js` | Regression guard that persisted liabilities do not alter retirement outputs, canonical completeness, Drag, or the legacy simulation. |
| `apps/wealth-freedom-demo/tests/liability-input-phase4a.test.js` | Controller CRUD, explicit confirmation, confirmed-none, validation, atomic invalidation, and ID stability. |
| `apps/wealth-freedom-demo/tests/liability-input-phase4a-view.test.js` | Page registration, Chinese-only visible UI, navigation, readonly legacy reminder, and three-summary display boundary. |
| `apps/wealth-freedom-demo/tests/wechat-miniapp-page-smoke.test.js` | Existing Page/wx smoke suite extended with an end-to-end liability-page flow. |

---

### Task 1: Create the pure liability fact and summary boundary

**Files:**

- Create: `apps/wealth-freedom-demo/wechat-miniapp/utils/liability-model.js`
- Create: `apps/wealth-freedom-demo/tests/fixtures/liability-facts-phase4a.fixture.js`
- Create: `apps/wealth-freedom-demo/tests/liability-facts-phase4a.test.js`

**Interfaces:**

- Produces `LIABILITY_TYPES`, ordered exactly as `mortgage`, `car_loan`, `consumer_loan`, `credit_card_debt`, `other`, with Chinese labels `房贷`、`车贷`、`消费贷`、`信用卡债务`、`其他负债`.
- Produces `validateLiabilityFact(fact, existingIds = []) -> { ok: boolean, value?: LiabilityFact, message?: string }`, where successful `value` has only the seven V1 fields and all numeric fields are numbers.
- Produces `validateLiabilityFacts(liabilities) -> { ok: boolean, value?: LiabilityFact[], message?: string }`; it rejects a non-array, an empty/non-string id, duplicate IDs, a changed/unknown type, invalid source, invalid boolean, a non-string note, `outstandingBalance <= 0`, and invalid monthly payment.
- Produces `calculateLiabilitySummary(liabilities, { monthlyEssentialExpense, investableAssetsTotal }) -> { totalLiabilities: number, totalMonthlyPayment: number, uncoveredMonthlyPayment: number, effectiveEssentialExpense: number | null, investableNetAssets: number | null }`.
- `calculateLiabilitySummary` is pure: it must not require `storage`, `wx`, a page, canonical adapter, retirement model, network, or SDK.

- [ ] **Step 1: Write the failing pure-model tests and fixture**

  Add fixture facts that include one `includedInEssentialExpense: true` item and one `false` item. Add tests that call the real future module and assert all of the following:

  ```js
  const summary = calculateLiabilitySummary(validLiabilities, {
    monthlyEssentialExpense: 6000,
    investableAssetsTotal: 100000,
  });

  assert.deepEqual(summary, {
    totalLiabilities: 150000,
    totalMonthlyPayment: 2500,
    uncoveredMonthlyPayment: 900,
    effectiveEssentialExpense: 6900,
    investableNetAssets: -50000,
  });
  ```

  Add table-driven cases proving: only the five types work; an empty id, duplicate id, non-manual source, non-boolean marker, `0`, negative, `NaN`, and infinities for `outstandingBalance` all fail; `monthlyPayment: 0` succeeds; empty liabilities produce the first three totals as zero; absent/invalid `monthlyEssentialExpense` yields only `effectiveEssentialExpense: null`; absent/invalid `investableAssetsTotal` yields only `investableNetAssets: null`; and the input array/items remain deep-equal to their pre-call snapshots.

- [ ] **Step 2: Run the focused test to verify functional RED**

  Run:

  ```powershell
  cd C:\Users\18955\Desktop\Codex_work\TuiLM\apps\wealth-freedom-demo
  node --test tests/liability-facts-phase4a.test.js
  ```

  Expected RED: `Cannot find module '../wechat-miniapp/utils/liability-model.js'` or a missing exported function assertion. A syntax, fixture, or test-loader failure is not an acceptable RED.

- [ ] **Step 3: Write the minimum pure implementation**

  Implement only the three exports described above. Preserve input immutability by constructing a new normalized V1 object on success. Use strict `Number.isFinite(value)` checks rather than coercing strings, `value || 0`, or absolute values. Use the exact fixed formulas:

  ```text
  totalLiabilities = sum(outstandingBalance)
  totalMonthlyPayment = sum(monthlyPayment)
  uncoveredMonthlyPayment = sum(monthlyPayment where includedInEssentialExpense === false)
  effectiveEssentialExpense = valid monthlyEssentialExpense ? monthlyEssentialExpense + uncoveredMonthlyPayment : null
  investableNetAssets = valid investableAssetsTotal ? investableAssetsTotal - totalLiabilities : null
  ```

  Validation messages returned to the controller must be Chinese. Do not introduce an ID generator, persistence, page code, canonical connection, or UI formatting in this module.

- [ ] **Step 4: Run the focused test to verify GREEN**

  Run:

  ```powershell
  node --test tests/liability-facts-phase4a.test.js
  ```

  Expected GREEN: every validation, exact-summary, null-boundary, and input-immutability assertion passes.

- [ ] **Step 5: Run the Task 1 regression set**

  Run:

  ```powershell
  node --test tests/retirement-index-model.test.js tests/retirement-index-contract.test.js
  ```

  Expected regression result: all existing canonical-model contracts remain green; no retirement-model file is changed.

**Commit scope (only after implementation authorization):** `utils/liability-model.js`, `tests/fixtures/liability-facts-phase4a.fixture.js`, and `tests/liability-facts-phase4a.test.js` only.

---

### Task 2: Upgrade raw-state storage to schema v3 and preserve the single-source boundary

**Files:**

- Modify: `apps/wealth-freedom-demo/wechat-miniapp/utils/demo-data.js`
- Modify: `apps/wealth-freedom-demo/wechat-miniapp/utils/storage.js`
- Modify: `apps/wealth-freedom-demo/tests/storage-input-loop-phase1.test.js`
- Modify: `apps/wealth-freedom-demo/tests/fixtures/liability-facts-phase4a.fixture.js`
- Retain / modify only if required by the amended tests: `apps/wealth-freedom-demo/tests/liability-non-interference-phase4a.test.js` (already created in the retained Task 2 implementation).

**Interfaces:**

- `getDefaultState()` and `getEmptyState()` return `schemaVersion: 3`, `liabilities: []`, and an `inputCompletion.liabilities` value of `false`.
- `migrateState(state)` returns a schema-v3 normalized state only on success. V2 forces empty liabilities and false liability completion, including the control case with no liability field. V3 must validate the source liability value before defaults can conceal a missing field; preserve only the validator's complete seven-field array, or throw `Error(validation.message)`. Non-array errors use `负债列表格式无效`. Preserve valid v3 liability completion only when `mode === "user"` and the source value is exactly `true`; do not reset an already valid confirmed state on repeated migration/load.
- `saveState(nextState)` and `loadState()` use that same Task 1 validation boundary, not separate acceptance rules. Invalid v3 data throws a Chinese validation error without altering persisted data or the caller's object. In particular, failed load must not auto-write migration results, clear data, return defaults, or produce `[] + true`. This includes invalid states that also contain stale derived fields.
- Successful migrate/save/load results retain only raw liabilities. Keep the existing top-level stripping of `monthlyEssentialExpense`, `liquidCash`, `investableAssets`, and `targetRetirementAssets`; also strip `protectionAccounts`, `dragItems`, and all five liability summaries from the top level and persisted snapshot structures at every nesting depth. Preserve legal snapshot facts and completion booleans under the Global Constraints. Only a successfully validated, sanitized state may be written back.
- None of these functions calls retirement calculation code, summary code, canonical adapter code, or the new page. No recovery UI or whole-Storage rewrite is part of the fix.

- [ ] **Step 1: Write the failing Storage tests and non-interference RED suite**

  Update `storage-input-loop-phase1.test.js` rather than creating a second Storage mock. Reuse its `createWxStorage`, `withWxStorage`, and `reloadStorageModule` helpers to add these real paths:

  ```js
  const migrated = storage.migrateState(v2LegacyWithMortgageAndManualDrags);
  assert.equal(migrated.schemaVersion, 3);
  assert.deepEqual(migrated.liabilities, []);
  assert.equal(migrated.inputCompletion.liabilities, false);
  assert.equal(migrated.userProfile.mortgage, legacy.userProfile.mortgage);
  assert.deepEqual(migrated.manualDrags, legacy.manualDrags);
  ```

  Add v3 tests that save and reload valid raw liabilities through both wx-backed storage and the Node memory fallback; assert other completion flags survive, all five summary names are absent from saved/reloaded state, and malformed v3 liability input is rejected with a Chinese validation error rather than partially saved.

  Add stale `dragItems` to the existing derived-field cases and assert it is absent after `migrateState`, `saveState`, wx reload, and memory reload while `manualDrags` remains byte-for-byte equivalent. Use a legal v3 liability plus deliberately stale `effectiveEssentialExpense` and `investableNetAssets` to prove that persisted output retains only raw `liabilities`.

  **Finding 1: malformed-v3 load rejection and save/load symmetry.** Extend the existing Storage test file using its real production Storage import and existing helpers. At minimum, add the following independent cases; the true completion is deliberate, and each seeded load starts with zero writes:

  ```js
  for (const malformed of [null, {}, "invalid"]) {
    test(`malformed v3 load rejects ${JSON.stringify(malformed)} without writes`, () => {
      const invalid = validV3LiabilityState({ liabilities: malformed });
      withWxStorage({ [storage.storageKey]: invalid }, (wxStorage) => {
        const before = wxStorage.read(storage.storageKey);
        assert.equal(before.inputCompletion.liabilities, true);
        assert.throws(() => storage.loadState(), /负债列表格式无效/);
        assert.equal(wxStorage.writeCount, 0);
        assert.deepEqual(wxStorage.read(storage.storageKey), before);
        assert.throws(() => storage.migrateState(invalid), /负债列表格式无效/);
        assert.throws(() => storage.saveState(invalid), /负债列表格式无效/);
        assert.equal(wxStorage.writeCount, 0);
        assert.deepEqual(wxStorage.read(storage.storageKey), before);
        assert.deepEqual(invalid, before);
      });
    });
  }
  ```

  Also cover number, boolean, explicit `undefined`, and an absent `liabilities` property; assert an empty result is never returned. The current wx mock JSON-clones its records, so explicit `undefined` becomes missing there: cover explicit `undefined` directly through save/migration and missing through seeded load. Add malformed-array cases, including an invalid item after a valid one and duplicate IDs; compare rejection messages with the real Task 1 `validateLiabilityFacts()` result. Repeat with liability completion false and with stale derived fields alongside malformed data. Track both set/remove calls in the existing helper and require neither on failure; do not create a second Storage mock. On the memory path, establish a valid saved state, attempt malformed saves/migration, and assert a subsequent real load still returns the original valid state. Do not add a production backdoor merely to seed the private memory state.

  **V2 migration control and valid-v3 stability.** Preserve the existing v2 test that ignores v3-shaped extras, and add the distinct no-liability-field control:

  ```js
  const legacyWithoutLiabilities = {
    ...clone(phase1Fixture.legacyState), schemaVersion: 2, mode: "user",
  };
  assert.equal(Object.hasOwn(legacyWithoutLiabilities, "liabilities"), false);
  const initialized = storage.migrateState(legacyWithoutLiabilities);
  assert.equal(initialized.schemaVersion, 3);
  assert.deepEqual(initialized.liabilities, []);
  assert.equal(initialized.inputCompletion.liabilities, false);
  assert.deepEqual(initialized.manualDrags, legacyWithoutLiabilities.manualDrags);
  ```

  Exercise that control through wx load/writeback as well. Retain v3 empty/nonempty array round-trips, true/false liability completion, mixed existing completion flags, and repeated migration/load stability. These controls must remain GREEN while the new malformed-v3 cases are RED.

  **Finding 2: snapshot derived stripping without historical loss.** Add cases for both `calculationSnapshots` and `valuationSnapshots`, and any other persisted snapshot container found in the existing Phase 4A path. Inject every field in `liabilityFixture.staleLiabilityDerivedFields` into snapshot records and into nested object/array members. Include derived `protectionAccounts` and `dragItems` payloads to enforce the same single-source rule. Assert exact equality against clean historical fixtures, not merely absence at state top level. A representative nested preservation assertion is:

  ```js
  const cleanHistory = [{
    id: "history-1", snapshotDate: "2026-08-22", totalValue: 100000,
    items: [{ holdingId: "cash", currentValue: 100000 }],
  }];
  const dirtyHistory = [{
    ...clone(cleanHistory[0]),
    ...liabilityFixture.staleLiabilityDerivedFields,
    protectionAccounts: [{ id: "stale-protection" }],
    dragItems: [{ type: "mortgage", score: 20 }],
    items: [{
      ...clone(cleanHistory[0].items[0]),
      ...liabilityFixture.staleLiabilityDerivedFields,
      protectionAccounts: [{ id: "nested-stale-protection" }],
      dragItems: [{ type: "mortgage", score: 20 }],
    }],
  }];
  for (const container of ["calculationSnapshots", "valuationSnapshots"]) {
    for (const schemaVersion of [2, 3]) {
      const input = validV3LiabilityState({ schemaVersion, [container]: clone(dirtyHistory) });
      const before = clone(input);
      const migrated = storage.migrateState(input);
      assert.deepEqual(migrated[container], cleanHistory);
      assert.deepEqual(input, before);
    }
  }
  ```

  Extend the same expected-clean assertions to direct wx-backed save/persisted-record inspection, wx load from a dirty seeded record (including reload), and memory-backed save/load. Cover both source versions and multiple snapshot records so count/order preservation is observable; add deeper object/array nesting, legal raw history fields, and legitimate completion booleans to catch indiscriminate key deletion. Preserve existing `snapshotDate`, `totalValue`, `items[].currentValue`, other legal fields, `manualDrags`, and `securityAccounts`; do not rebuild history from current facts. Verify a second migration/load is stable. New tests must call real Storage; fixture expected values and independent assertions must not reuse the production stripping helper.

  Retain the existing `liability-non-interference-phase4a.test.js` created during initial Task 2 implementation. It must compare `getOverviewModel()` for otherwise identical v3 states with and without valid raw liabilities and assert equality for `retirementIndex`, `totalAssetProgress`, `passiveIncomeCoverageRate`, `cashSafetyRunwayMonths`, `retirementIndexCompleteness`, `result.monthlyInvestable`, `result.months`, and `dragTotalText`. It must also deep-compare `buildCalculationValues()` output and raw `manualDrags`, then use the existing canonical adapter result to prove liability completion does not become a missing/required canonical section.

- [ ] **Step 2: Run the focused Storage and boundary tests to verify functional RED**

  Run:

  ```powershell
  node --test tests/storage-input-loop-phase1.test.js tests/liability-non-interference-phase4a.test.js
  ```

  Expected RED for the retained Task 2 implementation: malformed-v3 load fails the expected-throw/zero-write assertions because it returns an empty array and writes it back; snapshot assertions fail because the forbidden derived fields survive. Existing v2 initialization, valid-v3 round-trip, and non-interference controls remain GREEN. Do not roll back the current implementation to reproduce the original pre-v3 RED, weaken assertions to match the previous 43-pass report, or accept a harness/import failure as functional RED.

- [ ] **Step 3: Write the minimum schema and Storage implementation**

  Preserve the already-implemented schema-v3 defaults in `demo-data.js`: empty `liabilities` in demo/user states and `liabilities: false` in `defaultInputCompletion`. Do not reimplement Task 1 or change the seven-field contract.

  In `storage.js`:

  1. Retain `liabilities` in `inputCompletionKeys` with the existing explicit user-mode-true rule. Validate v3 facts before returning any normalized completion; do not turn malformed facts into confirmed-none.
  2. Retain existing top-level canonical stripping. Extend the same Storage-owned boundary to strip the seven prohibited derived payloads from known persisted snapshot structures at every object/array depth. Share the field policy across save/load/migration; do not introduce a parallel sanitizer with different rules. Respect the completion-boolean exception and preserve unrelated legal historical fields; do not recursively apply the broader top-level blacklist indiscriminately.
  3. Preserve source-version detection before spreading defaults. For v2, explicitly initialize `liabilities: []` and liability completion false after the spread; absence is valid initialization. For v3, do not use defaults to mask a missing field.
  4. Pass the original v3 liability value to Task 1's `validateLiabilityFacts()` in the shared boundary. Throw `Error(validation.message)` on failure and use `validation.value` on success. Remove the non-array-to-empty fallback; do not coerce items or preserve partial arrays. Save, load, and migration must agree on every accepted/rejected fact.
  5. Permit wx writeback or memory replacement only after full validation and sanitization succeed. On failure, propagate the Chinese error, leave the original storage and input object unchanged, and do not call set/remove, clear/reset, return a default state, or partially persist cleanup. Preserve successful migration/writeback and memory fallback behavior otherwise.
  6. Keep `userProfile.mortgage`, `carLoan`, `otherDebt`, `manualDrags`, holdings, income streams, Security raw facts, and legitimate existing completion fields unchanged. Preserve legal snapshot contents, record count/order, and business meaning; the only snapshot change is removal of forbidden derived payloads, not deletion, clearing, schema redesign, or recomputation.

  Do not alter `overview-model.js`, `retirement-index-adapter.js`, `retirement-index-model.js`, `calculation-core.js`, or any retirement formula.

- [ ] **Step 4: Run the focused test set to verify GREEN**

  Run:

  ```powershell
  node --test tests/liability-facts-phase4a.test.js tests/storage-input-loop-phase1.test.js tests/liability-non-interference-phase4a.test.js
  ```

  Expected GREEN: v2-to-v3 initialization remains exact; malformed v3 is symmetrically rejected by save/load/migration with Chinese errors and zero storage writes, including completion true; valid v3 raw facts and confirmation survive repeated loads. Top-level and nested calculation/valuation snapshot assertions prove all prohibited derived payloads are stripped on wx and memory paths while legal history and legacy facts remain intact. All listed retirement/canonical outputs remain unchanged. Report actual test counts; the earlier 43/43 result is not the amended gate.

- [ ] **Step 5: Run the Task 2 regression set**

  Run:

  ```powershell
  node --test tests/security-protection-accounts-bridge.test.js tests/security-input-phase3.test.js tests/overview-retirement-index-phase3.test.js tests/overview-retirement-index.test.js
  ```

  Expected regression result: Security remains a single raw fact source, stale protection handling remains green, canonical completeness behavior is unchanged, and no Drag or retirement calculation contract changes.

**Commit scope (only after implementation authorization):** `utils/demo-data.js`, `utils/storage.js`, `tests/storage-input-loop-phase1.test.js`, `tests/fixtures/liability-facts-phase4a.fixture.js`, and `tests/liability-non-interference-phase4a.test.js` only.

---

### Task 3: Implement liability CRUD and explicit-completion controller behavior

**Files:**

- Create: `apps/wealth-freedom-demo/wechat-miniapp/pages/liabilities/liabilities.js`
- Create: `apps/wealth-freedom-demo/tests/liability-input-phase4a.test.js`
- Modify: `apps/wealth-freedom-demo/tests/fixtures/liability-facts-phase4a.fixture.js`

**Interfaces:**

- The Page controller exposes `onShow`, `applyState`, `onFormInput`, `onLiabilityTypeChange`, `onIncludedInEssentialExpenseChange`, `saveLiability`, `editLiability`, `cancelEdit`, `deleteLiability`, `confirmLiabilities`, and `confirmNoLiabilities`.
- Page form fields are only `type`, `outstandingBalance`, `monthlyPayment`, `includedInEssentialExpense`, and `note`. New-form `includedInEssentialExpense` is `null` until the user explicitly selects `true` or `false`; only actual booleans may pass validation into a persisted `LiabilityFact`. `id` and `source` never come from a page input.
- `createLiabilityId(existingLiabilities)` is controller-local and follows the existing income-page timestamp-plus-monotonic-sequence pattern: `liability-<Date.now()>-<sequence>`. It regenerates while the candidate exists in the current list. This is an implementation detail, not displayed or accepted from the user.
- Successful create/edit/delete performs exactly one `storage.saveState()` of the new `liabilities` array and `inputCompletion.liabilities: false`, while spreading all other completion fields unchanged.
- Full confirmation writes only `inputCompletion.liabilities: true` when at least one valid item exists. Confirmed-none writes it only for an empty array. Both operations preserve facts and all other completion fields.

- [ ] **Step 1: Write the failing real-controller tests**

  Follow `security-input-phase3.test.js` for Page registration capture and the existing storage mock, but load `pages/liabilities/liabilities.js`. Add tests that drive the controller rather than asserting source strings:

  ```js
  page.onFormInput(event({ field: "outstandingBalance", value: "120000" }));
  page.onFormInput(event({ field: "monthlyPayment", value: "0" }));
  page.saveLiability();

  const saved = storage.loadState();
  assert.equal(saved.liabilities.length, 1);
  assert.equal(saved.liabilities[0].outstandingBalance, 120000);
  assert.equal(saved.liabilities[0].monthlyPayment, 0);
  assert.equal(saved.liabilities[0].source, "manual");
  assert.equal(saved.inputCompletion.liabilities, false);
  ```

  Add cases for rejection of zero/negative/non-finite balance without mutating storage; exact retention of the ID when editing; delete-by-id; duplicate generated candidate regeneration; Chinese validation messages; explicit full confirmation; explicit confirmed-none only for empty data; nonempty confirmed-none rejection with `请先清空或核对负债信息`; and create/edit/delete atomic invalidation after a previously confirmed state. Assert all other `inputCompletion` fields retain their preexisting values after every action.

  Add the dedicated unselected-marker contract before the implementation: a new form has `includedInEssentialExpense === null`; calling `saveLiability()` without selecting the inclusion state leaves `storage.loadState()` byte-for-byte unchanged and produces the Chinese Toast `请选择这笔月供是否已包含在每月必要支出中`; an explicit `false` saves exactly `false`; an explicit `true` saves exactly `true`. Neither success path may persist `null`.

- [ ] **Step 2: Run the focused controller test to verify functional RED**

  Run:

  ```powershell
  node --test tests/liability-input-phase4a.test.js
  ```

  Expected RED: the page controller file is missing or its required handlers are absent. A wx mock setup failure is not an acceptable RED.

- [ ] **Step 3: Write the minimum controller implementation**

  Implement controller-local form state and reuse Task 1 validation/summary functions plus Task 2 Storage. The controller must:

  1. initialize an empty form with a valid default type, blank numeric strings, `includedInEssentialExpense: null`, and empty note;
  2. convert form numbers only at validation/save time. Reject a `null` inclusion state before any `saveState()` call with the Chinese Toast `请选择这笔月供是否已包含在每月必要支出中`; accept only an explicit `true` or `false` after the user’s picker/switch action. Do not use `Boolean(value)`, `value || false`, or `!!value` to convert an unselected value;
  3. write `source: "manual"` itself and omit user control of it;
  4. generate an ID only for creates, preserve the existing ID during edits, and reject any unexpected duplicate rather than overwriting another record;
  5. format only the three allowed summary values for controller display data; calculate but do not place `effectiveEssentialExpense` or `investableNetAssets` in page data;
  6. load legacy profile values only into a Chinese readonly reminder string, never into a form field or new liability;
  7. use Chinese-only confirmation, delete-modal, empty-state, and validation messages;
  8. never call `getOverviewModel`, the canonical adapter, the retirement model, or the legacy simulation.

- [ ] **Step 4: Run the focused controller test to verify GREEN**

  Run:

  ```powershell
  node --test tests/liability-input-phase4a.test.js
  ```

  Expected GREEN: CRUD, stable IDs, explicit confirmation, confirmed-none rejection, mutation invalidation, raw persistence, and Chinese messages all pass through the real controller and Storage API.

- [ ] **Step 5: Run the Task 3 regression set**

  Run:

  ```powershell
  node --test tests/income-input-phase2.test.js tests/security-input-phase3.test.js tests/wechat-miniapp-page-smoke.test.js
  ```

  Expected regression result: existing income/security confirmation and CRUD flows stay green, and the existing smoke page set is unaffected.

**Commit scope (only after implementation authorization):** `pages/liabilities/liabilities.js`, `tests/liability-input-phase4a.test.js`, and the Phase 4A fixture update only.

---

### Task 4: Add the non-tab Chinese page artifacts, Overview navigation, and final UI boundary tests

**Files:**

- Create: `apps/wealth-freedom-demo/wechat-miniapp/pages/liabilities/liabilities.json`
- Create: `apps/wealth-freedom-demo/wechat-miniapp/pages/liabilities/liabilities.wxml`
- Create: `apps/wealth-freedom-demo/wechat-miniapp/pages/liabilities/liabilities.wxss`
- Modify: `apps/wealth-freedom-demo/wechat-miniapp/app.json`
- Modify: `apps/wealth-freedom-demo/wechat-miniapp/pages/overview/overview.js`
- Modify: `apps/wealth-freedom-demo/wechat-miniapp/pages/overview/overview.wxml`
- Create: `apps/wealth-freedom-demo/tests/liability-input-phase4a-view.test.js`
- Modify: `apps/wealth-freedom-demo/tests/wechat-miniapp-page-smoke.test.js`

**Interfaces:**

- `app.json.pages` includes `pages/liabilities/liabilities`; `tabBar.list` remains exactly its existing five paths.
- `overview.js` exposes `openLiabilities()` and calls `wx.navigateTo({ url: "/pages/liabilities/liabilities" })`.
- Liability WXML binds only Task 3 handlers and form fields, presents Chinese labels, and renders exactly the three `summary` display values.
- The page presents legacy `mortgage`/`carLoan`/`otherDebt` as a Chinese readonly reminder only; it has no editable bindings for those fields, `manualDrags`, `dragItems`, `effectiveEssentialExpense`, or `investableNetAssets`.

- [ ] **Step 1: Write the failing page-artifact, navigation, and smoke tests**

  Model the static test after `income-input-phase2-view.test.js` and add it before page artifacts exist. It must assert all four files exist, the page is registered outside the tabBar, and Overview has visible Chinese liability entry copy plus the exact `/pages/liabilities/liabilities` navigation target.

  Extract WXML visible literals as the existing income view test does. Assert that static user-visible page copy includes `负债`, `负债总额`, `每月总还款`, `尚未计入必要支出的月供`, `负债情况待确认`, `负债情况已确认`, `确认以上是我当前完整的负债情况`, `我目前没有负债`, and `该月供已包含在必要支出中`. Assert it excludes completeness enums, booleans, raw type enums, `manual`, `liabilities`, `dragItems`, `effectiveEssentialExpense`, and `investableNetAssets` as visible text. Do not require controller-only Toast or Modal error messages to be present in WXML; Task 3 controller tests own those assertions.

  Assert WXML has no `data-field` for the two non-visible derived values or old profile/monthly-drag fields. Extend `wechat-miniapp-page-smoke.test.js` with a real load of the liability page, one add/edit/delete/confirm interaction, and one Overview navigation interaction that records `wx.navigateTo`.

- [ ] **Step 2: Run the focused UI tests to verify functional RED**

  Run:

  ```powershell
  node --test tests/liability-input-phase4a-view.test.js tests/wechat-miniapp-page-smoke.test.js
  ```

  Expected RED: the liability page artifacts are missing, the page is unregistered, and the Overview navigation entry is absent. A test parser failure is not an acceptable RED.

- [ ] **Step 3: Write the minimum page and navigation implementation**

  Register the new page in `app.json` after the existing pages and do not change `tabBar.list`. Add one ordinary Overview button and `openLiabilities()` using `wx.navigateTo`.

  Build the WXML from existing input-page patterns: Chinese type picker, amount/monthly-payment `digit` inputs, explicit inclusion picker/switch, note input, add/edit/delete actions, empty state, confirmation actions, and Chinese Toast/Modal flows already supplied by the controller. Render only three summary cards: `负债总额`, `每月总还款`, and `尚未计入必要支出的月供`.

  Include a Chinese readonly reminder that existing `userProfile.mortgage`、`carLoan`、`otherDebt` remain legacy retirement-time monthly-outflow inputs and are not edited or migrated here. Do not render their numeric values as a new liability, do not render `manualDrags`, and do not connect them to the form.

  Use page-local WXSS modeled on existing safe page styles: no CSS grid, CSS variables, pseudo-elements, radial/conic gradients, or unsupported selectors. Do not add arithmetic expressions to WXML bindings; precompute all display strings in the controller.

- [ ] **Step 4: Run the focused UI tests to verify GREEN**

  Run:

  ```powershell
  node --test tests/liability-input-phase4a.test.js tests/liability-input-phase4a-view.test.js tests/wechat-miniapp-page-smoke.test.js
  ```

  Expected GREEN: the independent page has all four artifacts, navigation is non-tab and functional, visible copy is Chinese, the legacy reminder is readonly, and the user can see exactly the three permitted summaries.

- [ ] **Step 5: Run the Task 4 regression set**

  Run:

  ```powershell
  node --test tests/income-input-phase2-view.test.js tests/security-input-phase3.test.js tests/overview-retirement-index-view.test.js
  node scripts/validate-miniapp.js
  ```

  Expected regression result: all existing input-page views remain green and Mini Program validation passes with five tab items and the registered non-tab liability page.

**Commit scope (only after implementation authorization):** liability page `.json`, `.wxml`, `.wxss`; `app.json`; Overview `.js`/`.wxml`; liability view test; and smoke-test update only.

---

## Final Release Gate and Exact-Scope Review

Run these commands only after every Task has its expected GREEN result. This gate creates no new implementation and does not authorize a commit by itself.

1. Run the full JavaScript regression suite from the real app directory:

   ```powershell
   cd C:\Users\18955\Desktop\Codex_work\TuiLM\apps\wealth-freedom-demo
   node --test tests/*.test.js
   ```

   Expected: all pre-existing and Phase 4A tests pass; report the actual pass count.

2. Re-run focused Phase 4A boundaries, including real Storage, page, and non-interference paths:

   ```powershell
   node --test `
     tests/liability-facts-phase4a.test.js `
     tests/storage-input-loop-phase1.test.js `
     tests/liability-non-interference-phase4a.test.js `
     tests/liability-input-phase4a.test.js `
     tests/liability-input-phase4a-view.test.js `
     tests/wechat-miniapp-page-smoke.test.js
   ```

   Expected: valid liabilities persist as raw facts; malformed-v3 save/load/migration rejects symmetrically with Chinese errors and zero writes; derived payloads do not persist at top level or inside snapshot structures, whose legal historical contents remain intact; confirmed-none/invalidations are correct; all five frozen retirement/canonical outputs are unchanged; only the three permitted liability summaries are visible.

3. Validate Mini Program structure and compatibility:

   ```powershell
   node scripts/validate-miniapp.js
   ```

   Expected: `Miniapp validation passed.` with five tab items unchanged.

4. Review source boundaries and scope from repository root:

   ```powershell
   cd C:\Users\18955\Desktop\Codex_work\TuiLM
   git diff --check
   git diff --name-only
   git status --short
   rg -n "liabilities|effectiveEssentialExpense|investableNetAssets" apps/wealth-freedom-demo/wechat-miniapp/utils/overview-model.js apps/wealth-freedom-demo/wechat-miniapp/utils/retirement-index-adapter.js apps/wealth-freedom-demo/wechat-miniapp/utils/retirement-index-model.js apps/wealth-freedom-demo/wechat-miniapp/utils/calculation-core.js
   ```

   Expected: no whitespace errors; no Phase 4A change to canonical adapter/model or legacy simulation; `overview-model.js` has no new liability-derived input/output; only separately authorized scoped files are modified. This authorized spec/plan revision must not be silently changed during implementation, and its current uncommitted document changes must not be mixed into a code commit without the user's separate Git-scoping decision.

5. Inspect final user-visible text in `pages/liabilities/liabilities.wxml` and controller-owned messages. Verify all new literal copy is Chinese, exactly three summaries are rendered, and no internal enum/boolean/schema/derived-only name is visible.

6. Before any commit is proposed, perform a final reviewer check against every Global Constraint and the authoritative spec. A commit may contain only the scoped files introduced in Tasks 1–4, and only after the user separately authorizes committing.

## Plan Self-Review Checklist

- [x] **Spec coverage:** Task 1 covers V1 schema validation, all five types, `outstandingBalance > 0`, `monthlyPayment >= 0`, uniqueness, stable IDs, source, and all five pure summary values. Task 2 covers schema v3, v2 migration, explicit liability completion storage, raw-only persistence, stale `dragItems`, legacy retention, wx and memory paths, and non-interference. Task 3 covers CRUD, explicit confirmation, confirmed-none, mutation invalidation, atomic persistence, and Chinese controller messages. Task 4 covers independent page registration, Overview navigation, legacy readonly reminder, Chinese UI, and exactly three visible summaries. The final gate covers full regression, Mini Program validation, exact scope, and all frozen retirement outputs.
- [x] **Placeholder scan:** This plan contains no unfinished-marker text, deferred implementation phrase, or cross-task shortcut. Every implementation task identifies files, interfaces, RED command/result, minimum code boundary, GREEN command/result, regression command, and commit scope.
- [x] **Interface/type consistency:** Task 1 defines the validation and summary interfaces used by Task 2 and Task 3. Task 2 produces schema-v3 state and Storage behavior consumed by Task 3. Task 3 handler names are the only bindings Task 4 may reference. Tasks 2 and the final gate explicitly preserve the existing canonical adapter and retirement model boundaries.
- [x] **Task 2 review findings:** V2 initialization remains distinct from malformed-v3 rejection; the shared validator, Chinese error, zero-write failed load/save, completion-true case, and unchanged original storage have explicit RED/GREEN requirements. Nested calculation/valuation and other known persisted snapshots follow the single-source policy without losing legal historical facts or confirmation booleans. No unconditional snapshot-preservation or invalid-v3-empty-fallback rule remains.
- [x] **Scope review:** The plan adds no broker/SDK/network/data assumptions, no new retirement or Drag formula, no liability completeness gate, no legacy-field migration, no Overview presentation, and no persistence of derived values.
