# TuiLM Phase 3：Security `securityAccounts` → Canonical `protectionAccounts` Bridge

**状态：** Design only，等待用户评审

**日期：** 2026-08-17

**基线：** `8138af3 feat(miniapp): add passive income entry flow`

**本阶段只修订设计，不实施。** 本文是唯一 authoritative Phase 3 design spec。

## 1. Goal / Scope

Phase 3 的目标是把小程序 Security 页面维护的原始
`securityAccounts` 对象，在内存中纯函数转换为 canonical retirement input 的
`protectionAccounts` 数组，并为这组事实提供显式、可失效的确认状态。

Phase 3 必须包含：

1. `securityAccounts` → `protectionAccounts` bridge；
2. `inputCompletion.protectionAccounts` 的显式确认交互；
3. 用户明确选择“暂无保障账户”；
4. 任一受 Phase 3 管理的 Security 用户事实修改后，确认自动失效；
5. 所有新增用户可见按钮、状态、说明、Toast、Modal 和交互文案均为中文。

本阶段不包含生产代码、测试代码、bridge 实现、Drag、Web/H5、SDK、券商接入、
网络/真实行情、退休率公式或大规模 Security UI 重构。后续实现只允许在现有
Security 页面上添加最小确认区和状态展示。

以下不属于 Phase 3 的事实：

- `protectionAccounts` 不得写入 storage；`securityAccounts` 仍是唯一持久化事实；
- 不得从 demo 默认值、对象非空、余额、或一次字段输入自动推断确认；
- `estimatedMonthlyBenefit` 不得成为当前被动收入；
- 不得把公积金余额或冲还贷变成 `investableAssets` 或被动收入；
- 不得修改 `retirement-index-adapter.js`、`retirement-index-model.js` 的既有公式/契约，
  除非 TDD Red 证明现有 contract 本身阻断本设计且取得额外批准。

## 2. 当前工程核验

### 2.1 Security 原始结构

`wechat-miniapp/utils/storage.js` 持久化 schema v2 的 `securityAccounts` 嵌套对象；
`security-model.js` 和 `pages/security/security.js` 使用以下源 key：

| `sourceKey` | 用户事实字段 | 既有内部角色证据 |
| --- | --- | --- |
| `pension` | `balance`, `yearsPaid`, `personalMonthly`, `employerMonthly`, `estimatedMonthlyBenefit` | `retirement_cashflow` / `stable_retirement_cashflow` |
| `housingFund` | `balance`, `personalMonthly`, `employerMonthly`, `loanOffsetMonthly` | `welfare_asset` |
| `supplementalHousingFund` | 同 `housingFund` | `welfare_asset` |
| `enterpriseAnnuity` | `balance`, `personalMonthly`, `employerMonthly`, `estimatedMonthlyBenefit` | `retirement_cashflow` / `stable_retirement_cashflow` |
| `occupationalAnnuity` | 同 `enterpriseAnnuity` | `retirement_cashflow` / `stable_retirement_cashflow` |
| `commercialPensionInsurance` | 预留组，无持久化字段 | `reserved_retirement_cashflow`；不得产生 record |

当前 Security 页面已有“退休保障”“社会保障”“福利资产”等中文角色文案，后续只
增补确认状态和最小操作，不更换布局或重做分类 UI。

### 2.2 Canonical 结构与类型证据

核验文件：

- `wechat-miniapp/utils/retirement-index-adapter.js`：`protectionAccounts` 只被当作数组
  传递；adapter 没有元素 `type` 枚举校验。
- `wechat-miniapp/utils/retirement-index-model.js`：只消费
  `protectionAccountCompletion` 数值，不读取 protection record 的 `type`。
- `tests/fixtures/retirement-index-v1.fixture.js`：真实 canonical records 出现
  `medical_insurance`、`social_security`，并使用 `status`、`coverageLevel`、
  `actualMonthlyReceived`、`futureEstimatedMonthlyAmount`。
- `tests/retirement-index-contract.test.js`：验证上述 canonical fixture 以及未来养老金
  不进入 current passive income。
- `wechat-miniapp/utils/security-model.js`：`welfare_asset` 只作为 Security 内部的
  `retirementRole` / `calculationRole`，不是 canonical fixture 中已证明的 type。

因此，本设计不把内部 role 或源 key 伪装成既有 canonical enum。实际输出只使用下表
两种已经在工程中出现的字符串；未采用候选字符串不会出现在 canonical record 的
`type` 字段：

| 字符串 | 证据分类 | Phase 3 处理 |
| --- | --- | --- |
| `social_security` | `EXISTING_CANONICAL`：canonical fixture + contract test | 可用于养老金/企业年金/职业年金的 broad canonical category；用 `sourceKey` 区分来源。 |
| `medical_insurance` | `EXISTING_CANONICAL`：canonical fixture；Security 当前没有对应源组 | 不由本 bridge 生成。 |
| `welfare_asset` | `EXISTING_INTERNAL_ONLY`：仅 `security-model.js` role/calculationRole | 可作为当前数组中福利类记录的既有内部 role label；文档和实现不得声称它已经是 canonical enum，downstream 不得按新枚举分支。 |

未采用、不得输出的源/候选字符串为 `housing_fund`、
`supplemental_housing_fund`、`enterprise_annuity`、`occupational_annuity`。它们不是
本设计的 canonical type；后两者归入 `social_security`，前两者归入既有内部 role label
`welfare_asset`，全部用 `sourceKey` 区分。若将来 canonical contract 开始校验 type，
必须先另行扩展 contract，不能在本阶段偷偷发明替代字符串。实际 Mapping Table 不
包含任何新增或未验证的 canonical enum。

## 3. Completion Semantics

`inputCompletion.protectionAccounts` 是用户对“本节事实是否已完整回答”的显式声明，
不是 bridge 的推断结果。状态机如下：

| 状态 | `inputCompletion.protectionAccounts` | 用户可见中文状态 | 允许的来源 |
| --- | --- | --- | --- |
| 未确认 | `false` | `保障情况待确认` | 默认、legacy migration、或事实被修改后 |
| 已录入并确认 | `true` 且 bridge 有有效 records | `保障情况已确认` | 用户点击“确认以上是我当前完整的保障情况” |
| 明确暂无 | `true` 且 bridge 输出 `[]` | `我目前没有这些保障账户` | 用户点击“我目前没有这些保障账户” |

### 3.1 显式确认操作

Security 页面新增最小确认区，必须使用以下中文文案：

- 未确认状态：`保障情况待确认`；
- 完整确认按钮：`确认以上是我当前完整的保障情况`；
- 无账户确认按钮：`我目前没有这些保障账户`；
- 说明：`确认表示你已检查当前页面内容；不会把预计月领计入当前被动收入。`。

完整确认操作只能把 `inputCompletion.protectionAccounts` 设为 `true`，并保留
`securityAccounts` 原始事实。它不能写入 `protectionAccounts`，也不能改变收入或资产
字段。

“暂无”操作只有在 bridge 结果为空时可用；操作确认的是“当前没有可用保障事实”，
结果是 `securityAccounts` 无有效 Phase 3 保障事实并将 completion 设为 `true`。不得把
默认 demo 记录当作用户确认；若页面仍有有效事实，按钮必须不可用并显示中文提示
`请先清空或核对保障账户信息`。

### 3.2 Mutation invalidation

任何 Phase 3 管理字段发生用户修改，必须在同一状态更新中执行：

```text
securityAccounts := 更新后的原始事实
inputCompletion.protectionAccounts := false
```

覆盖字段：`balance`、`yearsPaid`、`personalMonthly`、`employerMonthly`、
`estimatedMonthlyBenefit`、`loanOffsetMonthly`，以及明确删除/清空一个保障组的操作。
修改后的页面状态立即显示 `保障情况待确认`。不能根据“对象仍非空”“金额为零”“默认
demo 数据”或任何启发式自动恢复 `true`。

## 4. Architecture

```text
Security 页面
  ├─ securityAccounts（原始事实，唯一持久化来源）
  └─ inputCompletion.protectionAccounts（显式确认布尔值）
          │
          ├─ 用户事实修改 → false
          ├─ 完整确认 → true
          └─ 明确暂无 → true + bridge 输出 []
          │
          ▼
security-protection-accounts-bridge.buildProtectionAccounts
          │  纯函数、无 storage/wx/网络副作用
          ▼
overview-model.buildCanonicalRetirementInput
          ▼
retirement-index-adapter.calculateCanonicalRetirement
          ▼
retirement-index-model（公式冻结）
```

### 4.1 Bridge API

后续实现新增：

```js
buildProtectionAccounts(securityAccounts = {}) => Array
```

函数必须：

- 不修改入参；
- 不访问 storage、`wx`、网络或 SDK；
- 只由原始 Security facts 派生 `protectionAccounts`；
- 不读取或修改 `inputCompletion`；
- 对未知源 key、预留 `commercialPensionInsurance`、以及没有任何有效有限非负事实的
  已知组不输出 record；
- 输出顺序固定为 `pension`、`housingFund`、`supplementalHousingFund`、
  `enterpriseAnnuity`、`occupationalAnnuity` 中实际存在的组。

`overview-model.buildCanonicalRetirementInput` 必须显式调用 bridge，把返回数组放入
`protectionAccounts`。canonical adapter 保持平台中立，不导入 Security 内部对象；其
既有数组别名兼容保持不变。`storage.js` 不新增派生字段。

## 5. Mapping Table

所有 record 都使用：

```js
{
  id: `security:${sourceKey}`,
  sourceKey,
  type,
  status,
  coverageLevel: "partial",
}
```

`coverageLevel` 固定为 `partial`，因为当前 Security 没有资格、归属、连续缴费或保单
完整性事实。不得生成 `complete`。`status` 表示保障事实时态，不是当前被动收入资格。

| `sourceKey` | canonical `type` | type 证据 | `status` | 特有 canonical 字段 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `pension` | `social_security` | `EXISTING_CANONICAL` | `future` | `balance`, `yearsPaid`, `personalMonthlyContribution`, `employerMonthlyContribution`, `actualMonthlyReceived: 0`, `futureEstimatedMonthlyAmount` ← `estimatedMonthlyBenefit` | broad canonical category；不生成 `pension` 新 type。 |
| `enterpriseAnnuity` | `social_security` | `EXISTING_CANONICAL` | `future` | 同 pension，但无 `yearsPaid` | 用 `sourceKey` 区分企业年金；不生成 `enterprise_annuity`。 |
| `occupationalAnnuity` | `social_security` | `EXISTING_CANONICAL` | `future` | 同 enterpriseAnnuity | 用 `sourceKey` 区分职业年金；不生成 `occupational_annuity`。 |
| `housingFund` | `welfare_asset` | `EXISTING_INTERNAL_ONLY`；仅有 Security role/calculationRole 证据 | `current` | `balance`, `personalMonthlyContribution`, `employerMonthlyContribution`, `currentLoanOffsetMonthly` ← `loanOffsetMonthly` | 仅承载既有福利 role label；不得把它宣称为 canonical enum或收入来源。 |
| `supplementalHousingFund` | `welfare_asset` | `EXISTING_INTERNAL_ONLY`；仅有 Security role/calculationRole 证据 | `current` | 同 housingFund | 用 `sourceKey` 区分补充公积金；不得把它宣称为 canonical enum。 |

预留 `commercialPensionInsurance` 没有 record。空 user state 产生 `[]`；已知源组只有
在至少一个用户事实通过有限非负校验时才产生 record。源组存在但所有已知事实均无效
时输出 `[]`，不得因此产生正向保障金额。

## 6. Numeric Sanitization

对以下用户事实字段：

```text
balance
yearsPaid
personalMonthly
employerMonthly
estimatedMonthlyBenefit
loanOffsetMonthly
```

只有 `Number.isFinite(value) && value >= 0` 才允许进入对应 canonical 数值字段。

非法或负数值必须直接省略该字段：

- `NaN` 不得变成 `0`；
- `Infinity` / `-Infinity` 不得变成 `0`；
- 负数不得取绝对值，不得转成正数；
- 缺失字段不得补业务默认值。

`actualMonthlyReceived: 0` 是唯一列出的特殊派生安全标记，适用于 `pension`、
`enterpriseAnnuity`、`occupationalAnnuity`。它不是用户报告的“0 元收入事实”，而是
在 Security 页面只有“预计退休后月领”、没有“当前实际领取”事实时，明确禁止
`futureEstimatedMonthlyAmount` 被解释为 current received income 的保护标记。

当前实际领取只能由 Income Phase 2 的 `pension_received` 或 `annuity_received`
income source 提供；本 bridge 不创建这两类 income source。

## 7. Income / Formula / Persistence Boundaries

- `estimatedMonthlyBenefit` 只映射到 `futureEstimatedMonthlyAmount`；不得改变
  `monthlyStablePassiveIncome` 或 `passiveIncomeCoverageRate`。
- bridge 不写 `incomeSources`，不写 `investableAssets`，不写 `targetRetirementAssets`。
- 公积金余额和 `loanOffsetMonthly` 只作为 protection facts，不改变可投资资产、稳定
  被动收入或退休率。
- canonical adapter 的既有完成度规则保持不变：有 completion 时，明确 `true` 的空
  数组是完整回答；`false` 仍是待确认。bridge 不自动升级 completion。
- `securityAccounts` 是唯一持久化事实；`protectionAccounts` 每次 overview 计算时在
  内存派生，禁止进入 `storage.js`、`schemaVersion`、local storage 或快照。
- retirement index weights、`composeRetirementIndex`、`computeDragPenalty`、任何退休率
  公式均不修改。

## 8. Implementation File Boundary（后续实施，不在本轮）

允许的最小范围：

| 文件 | 后续允许内容 |
| --- | --- |
| `wechat-miniapp/utils/security-protection-accounts-bridge.js` | 新增纯 bridge、映射、类型证据对应的字段投影和数值清洗。 |
| `wechat-miniapp/utils/overview-model.js` | 在 canonical input 单一入口调用 bridge。 |
| `wechat-miniapp/pages/security/security.js` | 增加中文 confirmation 状态、完整确认/明确暂无操作；事实修改时原子失效。 |
| `wechat-miniapp/pages/security/security.wxml` | 增加最小中文状态、按钮、说明、提示区域；不重做页面结构。 |
| 与上述行为直接相关的 tests | 新增 focused bridge、confirmation、overview E2E 测试；不得修改公式测试以迁就实现。 |

原则上不修改：`storage.js`、`retirement-index-model.js`、`retirement-index-adapter.js`、
`demo-data.js`。若 Red 测试证明 `security-model.updateSecurityField` 现有的非法输入
归一化会破坏“非法值直接省略”边界，只允许做最小安全修正，并在测试中证明不是为了
改变公式或持久化契约。

明确不实施：Drag、Web/H5、SDK、券商、网络、真实行情和大规模 Security UI 重构。

## 9. TDD Red Design

后续实施必须先建立失败测试，覆盖以下可观察行为：

### 9.1 Bridge Red

1. `securityAccounts` object 映射为 canonical `protectionAccounts` array：五个已知
   源 key 的 `sourceKey`、`id`、type、时态、来源字段和固定顺序正确；预留商业养老
   保险与未知 key 不生成 record。
2. 原始对象深度不可变；空对象返回 `[]`。
3. `pension`、企业年金、职业年金的预计月领只进入
   `futureEstimatedMonthlyAmount`，并强制 `actualMonthlyReceived === 0`。

### 9.2 Numeric Red

对六类用户事实字段分别测试有限非负数、缺失、`NaN`、`Infinity`、`-Infinity`、负数：
只有有限非负数出现于 canonical record，其余字段直接不存在，不得变为 `0` 或正数。

### 9.3 Confirmation Red

1. `empty + false` → 页面显示 `保障情况待确认`，canonical completeness 缺少
   `protectionAccount`。
2. `nonempty + false` → 仍显示 `保障情况待确认`，不得因有对象/余额自动确认。
3. `nonempty + explicit confirm` → `inputCompletion.protectionAccounts === true`，
   显示 `保障情况已确认`。
4. `empty + explicit confirmed-none` → `securityAccounts` 无有效事实、completion
   为 `true`，显示 `我目前没有这些保障账户`，遵守 canonical 的 confirmed-empty 语义。
5. 任何 Security 用户事实修改（含清空）→ `true` 原子变为 `false`，显示
   `保障情况待确认`；不能保留旧的 true。

### 9.4 Chinese UX Red

对新增按钮、状态、说明、Toast、Modal 和交互断言全部为中文，至少包含本 spec 规定的
四条文案；不得出现新增英文用户可见字符串。

### 9.5 Storage / E2E Red

1. 保存/重载后 `securityAccounts` 仍是唯一原始事实；state、storage 和快照中不存在
   `protectionAccounts`。
2. `securityAccounts → bridge → protectionAccounts → canonical adapter → retirement
   model → Overview` 端到端传递成功，原始对象未被改变。
3. 预计月领变化不改变 `monthlyStablePassiveIncome`、`passiveIncomeCoverageRate`；
   公式与 weights 的现有测试保持通过。

## 10. Success Criteria

Phase 3 只有同时满足以下条件才算完成：

- bridge 只读派生 canonical 数组，且所有映射都有 sourceKey 和证据等级；
- 未采用的候选字符串没有出现在实现输出；`welfare_asset` 不被宣称为已证明
  canonical enum，也没有下游新枚举分支；
- 完整确认、明确暂无、未确认、事实修改失效四种状态都可由中文 UI 明确表达；
- 默认 demo、对象非空、余额非零均不能自动设置 completion true；
- 六类事实字段的有限非负清洗规则和 `actualMonthlyReceived: 0` 特殊语义测试通过；
- future benefit 与 current income 完全隔离，Income Phase 2 仍是当前领取收入唯一来源；
- `securityAccounts` 是唯一持久化事实，不存在持久化 `protectionAccounts`；
- Overview E2E 和现有 canonical/storage/security 测试通过；
- Drag、SDK、Web/H5、网络和退休率公式均未触碰。

## 11. Self-review

- [x] 已将显式确认、明确暂无、事实修改自动失效纳入 Phase 3，而非后续阶段。
- [x] 已重新搜索 canonical adapter、model、fixture、tests、security-model 和产品文档。
- [x] 已区分 `EXISTING_CANONICAL` 与 `EXISTING_INTERNAL_ONLY`；实际 Mapping Table 没有新增或未验证 canonical type。
- [x] 没有把 `housing_fund`、`supplemental_housing_fund`、`enterprise_annuity` 或
  `occupational_annuity` 当成已存在 canonical enum。
- [x] 已冻结 NaN、Infinity、负数直接省略规则；未使用 `abs()` 或非法值补零。
- [x] 已明确 `actualMonthlyReceived: 0` 是安全标记，不是用户报告收入。
- [x] 已明确 `securityAccounts` 是唯一持久化事实，且未授权大规模 UI/公式改造。
- [x] 已检查无未完成占位；`TODO`、`TBD` 不属于本文需求或实现步骤。
