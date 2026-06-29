# Retirement Security Taxonomy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reclassify the WeChat miniapp security module from product-name categories to retirement-role categories.

**Architecture:** Keep the current `security-model` boundary. Update category/group metadata, page copy, and tests while leaving existing persistence keys and calculation APIs stable.

**Tech Stack:** WeChat Mini Program WXML/WXSS/JS, CommonJS model utilities, Node built-in test runner.

---

### Task 1: Lock the desired taxonomy with failing tests

**Files:**
- Modify: `tests/wechat-miniapp.test.js`
- Modify: `tests/wechat-miniapp-page-smoke.test.js`

- [ ] Update model tests to expect categories `socialSecurity` and `welfareAsset`.
- [ ] Assert social security contains basic pension, enterprise annuity, occupational annuity, and reserved commercial pension insurance.
- [ ] Assert welfare assets contain housing fund and supplemental housing fund.
- [ ] Assert page copy says `退休保障`, `社会保障`, `福利资产`, and does not show old `保险` / `金` category wording.
- [ ] Run the targeted tests and verify they fail for the old category model.

### Task 2: Update security taxonomy model

**Files:**
- Modify: `wechat-miniapp/utils/security-model.js`

- [ ] Rename category keys to role-based keys while preserving persisted account keys.
- [ ] Move enterprise annuity and occupational annuity into `socialSecurity`.
- [ ] Move housing fund and supplemental housing fund into `welfareAsset`.
- [ ] Add reserved `commercialPensionInsurance` group with no persisted fields and disabled/reserved copy.
- [ ] Add role metadata (`retirementRole`, `calculationRole`, `isReserved`) for future retirement-rate, passive-income, and AI prediction integration.
- [ ] Keep fallback category/group behavior stable for old selections.

### Task 3: Update page copy without visual redesign

**Files:**
- Modify: `wechat-miniapp/pages/security/security.js`
- Modify: `wechat-miniapp/pages/security/security.wxml`
- Modify: `wechat-miniapp/pages/security/security.json`

- [ ] Change module naming from `保障账户`/`保障` to `退休保障` where visible.
- [ ] Replace form note with role-based explanation.
- [ ] Show selected category note so users understand whether the group is future cashflow or welfare asset.
- [ ] Preserve existing tab/chip/list layout and input behavior.

### Task 4: Verify broadly

**Commands:**
- `node --check wechat-miniapp/utils/security-model.js`
- `node --check wechat-miniapp/pages/security/security.js`
- `node scripts/validate-miniapp.js`
- Run all `tests/**/*.test.js` with Node test runner.
- `powershell -ExecutionPolicy Bypass -File scripts/wechat-miniapp-preflight.ps1`

**Expected:** syntax checks, miniapp validator, all tests, and preflight pass.
