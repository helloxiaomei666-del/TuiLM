# TuiLM Phase 4A：负债事实与必要支出去重设计

**状态：** Design only，等待用户评审

**日期：** 2026-08-22

**基线：** `272dca1 feat(miniapp): bridge security into retirement protection`

**权威性：** 本文是 Phase 4A「负债事实与必要支出去重」的唯一正式设计文档。后续实施、测试与评审必须以本文为准；本阶段不得以代码或测试实现替代本文的边界。

## 1. 目标与冻结范围

Phase 4A 建立独立、可持久化的原始负债事实源 `liabilities[]`，使用户能够录入、编辑、删除并明确确认当前负债情况。它同时定义月供与既有必要生活支出之间的去重语义，并在内存中产生面向后续阶段的负债汇总值。

本阶段已经冻结的目标是：

1. `liabilities[]` 是唯一新增的正式负债原始事实源；
2. 新增 schema v3，并将 v2 state 安全迁移到 v3；
3. 新增独立中文“负债”页面，负责负债事实操作、汇总和显式确认；
4. 定义可复用但仅内存存在的去重与净额派生值；
5. 清理 storage 中的 stale canonical `dragItems`；
6. 保持现有退休率、核心指标、Drag 分数和旧退休时间模拟的行为不变。

本阶段不实施以下内容：

- 不修改 `retirementIndex`；
- 不修改 `totalAssetProgress`；
- 不修改 `passiveIncomeCoverageRate`；
- 不修改 `cashSafetyRunwayMonths`；
- 不修改 `computeDragPenalty`、Drag 类型、Drag 分数或其 completeness gate；
- 不修改现有 `calculation-core.simulate()` 的旧退休时间模拟；
- 不将旧 `mortgage`、`carLoan`、`otherDebt` 或 `manualDrags` 自动转换为 `liabilities`；
- 不接入 SDK、券商、网络、真实行情、导入能力或自动同步。

## 2. 当前工程事实与问题边界

当前小程序 state 的 `schemaVersion` 为 2。`demo-data.js` 保存原始
`userProfile`、`holdings`、`incomeStreams`、`manualDrags`、`securityAccounts` 与
`inputCompletion`；`storage.js` 已剥离若干 canonical 派生字段和
`protectionAccounts`，但尚未剥离 `dragItems`。

当前存在两类不应混为一谈的历史数据：

| 现有字段 | 当前真实角色 | Phase 4A 处理 |
| --- | --- | --- |
| `userProfile.mortgage`、`carLoan`、`otherDebt` | 旧退休时间模拟使用的月度支出输入；`calculation-core.simulate()` 将它们加入月度支出 | 原样保留、原样持久化、原样参与旧模拟；不自动产生任何 `liabilities` item。 |
| `manualDrags[]` | 遗留月度现金流事实；拖累页面以 `category`、`amount`、`title` 等字段维护，并传给旧退休时间模拟的 `manualDragOutflow` | 原样保留、原样持久化；不迁移为负债，不生成新 drag item，不更改现有拖累计算。 |
| `dragItems` | canonical retirement input 的派生/兼容输入，不应成为 storage 事实源 | v3 migration 与每次保存都剥离顶层 stale `dragItems`；不影响 `manualDrags`。 |

现有 `overview-model.js` 仍有 `manualDrags → dragItems` 的历史 canonical-input fallback。
Phase 4A 不修改这个既有 Drag 兼容路径，以避免改变 Drag 分数或 retirement model；但它不构成
`manualDrags` 到 `liabilities` 的映射，也不授权新增任何对 `manualDrags` 的负债、资产、
收入或 completion 用途。本文中“`manualDrags` 继续只作为 legacy cashflow fact”仅允许该
已存在且不变的兼容路径，不得扩展为新的正式负债事实源。

当前 canonical retirement input 的 `monthlyEssentialExpense` 取既有
`targetMonthlyLivingCost`、`targetMonthlyCost`、`livingCost` 等别名的当前优先级；
它没有从新 `liabilities` 读取事实。Phase 4A 不改变这一优先级，也不把新派生的
`effectiveEssentialExpense` 传入 canonical adapter。

因此，本设计只解决“将来需要使用负债月供时如何避免重复相加”的事实和派生边界，
不在本阶段改变任何已显示的退休率、覆盖率、安全垫、资产进度或退休时间结果。

## 3. 正式原始事实：`liabilities[]`

### 3.1 State 位置与单一事实源

schema v3 的顶层 state 新增：

```js
{
  schemaVersion: 3,
  liabilities: [],
  inputCompletion: {
    // 既有字段保留
    liabilities: false,
  },
}
```

`liabilities[]` 是负债余额、月供与去重选择的唯一持久化原始事实源。页面、汇总函数、
未来 canonical bridge 或未来指标只能从它派生，不得另存总负债、未覆盖月供、净资产或
任何负债评分副本。

每个 item 的 V1 contract 固定如下：

```js
{
  id: "<non-empty-stable-id>",
  type: "mortgage" | "car_loan" | "consumer_loan" | "credit_card_debt" | "other",
  outstandingBalance: 120000,
  monthlyPayment: 0,
  includedInEssentialExpense: false,
  source: "manual",
  note: "",
}
```

| 字段 | 类型与持久化语义 | V1 规则 |
| --- | --- | --- |
| `id` | 非空 string，持久化 | 必须在 `liabilities[]` 内唯一；创建后稳定，编辑保留原 id，删除仅按 id 删除，用户不可编辑。它不承载业务编号或用户可见身份。具体生成方式由 implementation plan 按现有工程模式确定。 |
| `type` | enum string，持久化 | 只能为 `mortgage`、`car_loan`、`consumer_loan`、`credit_card_debt`、`other`。未知值拒绝保存，不回退为其他类型。 |
| `outstandingBalance` | finite number，持久化 | 当前未偿余额，单位人民币元；仅当 `Number.isFinite(value) && value > 0` 时有效。0 元视为已结清，不允许作为有效 current liability 保存；非法、无限、0 或负数输入拒绝保存，不取绝对值，不默认为 0。 |
| `monthlyPayment` | finite number，持久化 | 当前每月固定偿付，单位人民币元/月；必须有限且大于或等于 0。0 是有效事实。非法、无限或负数输入拒绝保存。 |
| `includedInEssentialExpense` | boolean，持久化 | 用户对“该项月供是否已经包含在当前必要生活支出中”的显式声明；必须为 boolean，不能根据类型、旧字段或金额推断。 |
| `source` | string，持久化 | V1 仅允许系统写入 `manual`；不在页面中伪装任何导入或券商来源。未来新增来源值必须有独立设计。 |
| `note` | string，持久化 | 可选本地备注；空字符串有效。它不参与数字、类型、确认、退休率或任何模型载荷。 |

创建时必须形成非空且在 `liabilities[]` 内唯一的 id；具体生成方式由 implementation plan 根据现有工程模式确定。重复 id 必须拒绝而不能覆盖已有负债。ID 的具体显示形式不是用户契约，且不得显示给用户。

### 3.2 类型的用户可见中文

内部 enum 只在存储与代码中出现。页面只显示下列中文：

| 内部 `type` | 用户可见标签 |
| --- | --- |
| `mortgage` | 房贷 |
| `car_loan` | 车贷 |
| `consumer_loan` | 消费贷 |
| `credit_card_debt` | 信用卡债务 |
| `other` | 其他负债 |

任何新增按钮、字段名、摘要、确认状态、空状态、Toast、Modal、错误提示与拒绝提示必须为中文。
不得向用户显示 `liabilities`、`includedInEssentialExpense`、`manual`、enum 值、
raw boolean 或 schemaVersion。

## 4. schema v2 → v3 与 Storage 边界

### 4.1 v3 默认 state

`demo-data.js` 的 demo state 与 empty user state 都升级为 schema v3，并都拥有：

```js
liabilities: []
inputCompletion: {
  ...existingInputCompletion,
  liabilities: false,
}
```

demo 示例不得因现有 `mortgage`、`carLoan`、`otherDebt`、`manualDrags` 或任何默认值而
生成 liability record 或自动确认负债。

### 4.2 v2 → v3 迁移规则

对任意 schema v2 state，`migrateState()` 必须：

```text
schemaVersion := 3
liabilities := []
inputCompletion.liabilities := false
保留 userProfile.mortgage / carLoan / otherDebt 的原值
保留 manualDrags 的原值
```

迁移不从旧字段推断余额、月供类型或“已包含必要支出”标记；也不得把旧字段、标题或
备注复制成新的 liability。原因是旧字段的业务语义只有“旧模拟月度支出”，不足以可靠
确定余额、债务类型、去重选择或用户确认。

对 schema v3 state，`liabilities` 仅在其为数组时保留；异常值回退为 `[]`。每个 item
在保存边界执行 V1 contract 校验：无效 item 必须使调用方得到明确的本地中文校验失败，
而不是被静默转换、部分保存或自动补事实。`inputCompletion.liabilities` 仅在 user mode
且原值严格为 `true` 时保留；其他情况为 `false`。既有 completion 字段必须原样保留。

### 4.3 stale `dragItems` 清理

v3 的 `storage.js` 必须把顶层 `dragItems` 加入与
`monthlyEssentialExpense`、`liquidCash`、`investableAssets`、`targetRetirementAssets`、
`protectionAccounts` 相同的 canonical-derived-field stripping 边界。

因此，以下路径都不能保留 `dragItems`：

```text
v2 load → migrateState → persisted v3 state
v3 saveState → persisted state
wx storage reload
Node memory fallback reload
```

这一清理只删除 stale top-level `dragItems`；不得删除、改写或转换 `manualDrags`。

### 4.4 派生值绝不持久化

以下字段只能由当前内存中的 raw facts 计算，禁止作为顶层 state、liability item、
storage snapshot、demo data 或其他第二事实源保存：

```text
totalLiabilities
totalMonthlyPayment
uncoveredMonthlyPayment
effectiveEssentialExpense
investableNetAssets
```

同样不得持久化任何由这些值进一步计算出的分数、状态或推荐。

## 5. 显式确认：`inputCompletion.liabilities`

`inputCompletion.liabilities` 表示用户已检查“当前完整负债情况”，不是余额、月供、
数组非空、旧 `userProfile` 字段、`manualDrags` 或 demo 数据的推断结果。

| 状态 | `liabilities` | `inputCompletion.liabilities` | 用户可见中文 |
| --- | --- | --- | --- |
| 待确认 | 任意 | `false` | `负债情况待确认` |
| 已确认 | 有效 item 至少一项 | `true` | `负债情况已确认` |
| 明确无负债 | `[]` | `true` | `我目前没有负债` |

页面必须提供以下显式操作：

1. `确认以上是我当前完整的负债情况`：只允许在存在至少一项有效 liability 时把
   `inputCompletion.liabilities` 设为 `true`；不修改负债事实或其他 completion 字段。
2. `我目前没有负债`：只允许在 `liabilities.length === 0` 时把该 completion 设为 `true`。
   若有记录，拒绝且以中文提示 `请先清空或核对负债信息`；拒绝路径不得修改 state。
3. 新增、编辑或删除任何 liability：与负债事实同一次 `saveState()` 原子写入
   `inputCompletion.liabilities := false`，并保留其他 completion 字段。

在 Phase 4A 中，`inputCompletion.liabilities` **不进入** canonical retirement completeness gate；
它不会影响 `COMPLETE`、`PARTIAL` 或 `INSUFFICIENT`，也不会因确认状态改变任何现有退休率。

## 6. 月供与必要支出的去重及派生契约

### 6.1 去重规则

每项 liability 都由用户明确标记 `includedInEssentialExpense`：

| 标记 | 去重语义 |
| --- | --- |
| `true` | 该项 `monthlyPayment` 已包含在当前 `monthlyEssentialExpense` 的事实口径中；它不得再次加入 `effectiveEssentialExpense`。 |
| `false` | 该项 `monthlyPayment` 尚未包含在当前 `monthlyEssentialExpense` 中；它计入 `uncoveredMonthlyPayment`，且仅通过该值加入 `effectiveEssentialExpense`。 |

系统不得按 `type`、旧 `mortgage/carLoan/otherDebt`、`manualDrags`、备注、金额相等或名称相似性
猜测这个标记。旧字段与新负债可同时存在；Phase 4A 只使用用户对每项新 liability 的显式标记
避免新路径自身的重复相加，不宣称已经消除了旧模拟与新页面之间的历史数据重复。

### 6.2 数值输入与固定派生公式

`calculateLiabilitySummary(liabilities, context)` 是后续实现的纯函数边界：不读 storage、
不写 state、不访问 `wx`、网络、SDK 或退休模型。它只接受 V1 已校验的 raw liability
facts，以及当前已有的内存 `monthlyEssentialExpense` 和 `investableAssets.total`。

设 `L` 为有效 liability 数组，`B` 为当前已有口径的 `monthlyEssentialExpense`，`A` 为当前
已有口径的 `investableAssets.total`。Phase 4A 固定以下唯一公式：

```text
totalLiabilities = Σ item.outstandingBalance, item ∈ L
totalMonthlyPayment = Σ item.monthlyPayment, item ∈ L
uncoveredMonthlyPayment = Σ item.monthlyPayment, item ∈ L 且 item.includedInEssentialExpense === false
effectiveEssentialExpense = B + uncoveredMonthlyPayment
investableNetAssets = A - totalLiabilities
```

边界规则固定如下：

- `totalLiabilities`、`totalMonthlyPayment` 和 `uncoveredMonthlyPayment` 在 `L=[]` 时为 `0`；
- `effectiveEssentialExpense` 仅当 `B` 是有效现有必要支出值时产生；否则为 `null`，不得以
  `0` 虚构基数；
- `investableNetAssets` 仅当 `A` 是有效已有可投资资产总额时产生；否则为 `null`；结果可以为
  负数，不能为美化展示而 clamp 为 0；
- 本节五个公式是 Phase 4A 唯一新增的派生公式。`totalLiabilities`、`totalMonthlyPayment` 与
  `uncoveredMonthlyPayment` 可用于负债页面的汇总；`effectiveEssentialExpense` 与
  `investableNetAssets` 仅允许内存派生与测试，Phase 4A 不在页面展示。五项均仅为未来单独批准
  的接入准备，不能被悄然接入现有退休指标或 Overview。

`B` 的读取口径必须与当前 canonical adapter 的既有必要支出优先级一致；Phase 4A 不改变该
优先级，也不将 `effectiveEssentialExpense` 回写到 `monthlyEssentialExpense`。

## 7. 退休模型与旧模拟的硬边界

Phase 4A 后，数据流仅到内存汇总为止：

```text
负债页面
  → liabilities[]（持久化 raw facts）
  → calculateLiabilitySummary(...)（仅内存）
  → 负债页面中文汇总
```

它不得接入以下任何调用链：

```text
liabilities[] → buildCanonicalRetirementInput → retirement-index-adapter
liabilities[] → retirement-index-model
liabilities[] → passive income coverage / cash runway / asset progress
liabilities[] → computeDragPenalty
liabilities[] → calculation-core.simulate
```

所以本阶段必须保持不变的可观察结果包括：

- `retirementIndex`；
- `passiveIncomeCoverageRate`；
- `cashSafetyRunwayMonths`；
- `totalAssetProgress`；
- Drag score / `dragPenalty`；
- 旧退休时间模拟的 `monthlyInvestable`、路线和自由时间。

`investableNetAssets` 是仅内存与测试可用的单独派生事实，不是当前 `investableAssets`，更不是
当前 `totalAssetProgress` 的分子；Phase 4A 不在负债页面或 Overview 展示，也不得将它写回
holdings、assets、overview 或 canonical input。

## 8. 独立中文“负债”页面

后续实现新增非 tab 页面 `pages/liabilities/liabilities`，页面标题为 `负债`。当前 tabBar
已有五个入口，Phase 4A 保持其现有 tab 结构；负债页面通过总览中的普通导航入口打开，
使用 `wx.navigateTo`，而不是增加或替换 tabBar 项。

页面职责仅限：

1. 显示已录入负债的中文类型、余额、月供、是否已包含在必要生活支出中与本地备注；
2. 新增、编辑、删除 V1 liability；
3. 只显示 `totalLiabilities`、`totalMonthlyPayment`、`uncoveredMonthlyPayment` 的中文汇总，即
   “负债总额”“每月总还款”“尚未计入必要支出的月供”；不得展示
   `effectiveEssentialExpense` 或 `investableNetAssets`；
4. 显示待确认/已确认状态，并提供完整确认与明确无负债操作；
5. 对字段校验、重复 id、确认前置条件和保存失败提供中文提示。

页面不得：

- 编辑旧 `userProfile.mortgage`、`carLoan`、`otherDebt`；
- 编辑或迁移 `manualDrags`；
- 显示或修改 `dragItems`；
- 计算或显示新的退休率、资产进度、覆盖率、安全垫或 Drag 分数；
- 暗示余额、月供、去重标记来自券商、银行或任何外部接口。

建议的固定中文文案包括：

```text
负债情况待确认
负债情况已确认
确认以上是我当前完整的负债情况
我目前没有负债
该月供已包含在必要生活支出中
请先清空或核对负债信息
```

## 9. 后续实施边界与测试契约

本轮不创建任何代码或测试。后续实施必须先写 RED，再写最小 Green，并至少覆盖以下可观察契约：

### 9.1 Storage 与 migration

1. v3 default/demo/user state 都有空 `liabilities` 与 `inputCompletion.liabilities=false`；
2. v2 → v3 保留旧 `mortgage`、`carLoan`、`otherDebt`、`manualDrags`，但强制
   `liabilities=[]` 且 completion 为 false；
3. v2 旧字段不自动转换为 liability；
4. v3 保存/重载在 wx-backed 与 Node memory fallback 两条路径都保留合法
   `liabilities` raw facts 和 completion；
5. migrate/save/reload 都剥离 stale top-level `dragItems`，不伤及 `manualDrags`；
6. 五个负债派生值不出现在 persisted state 或 snapshot。

### 9.2 事实与去重

1. 五个且仅五个 `type` 可保存；`id` 必须非空且在 `liabilities[]` 内唯一，编辑保留原 id；
   未知类型、非法数值、非 boolean 标记、非 manual source 与重复 id 都拒绝；
2. `outstandingBalance` 仅当 `Number.isFinite(value) && value > 0` 时可保存；0 余额视为已结清
   并拒绝保存。`monthlyPayment=0` 仍可保存；负数、`NaN`、`Infinity`、`-Infinity` 不能进入
   raw facts；
3. `includedInEssentialExpense=true` 的月供不进入 `uncoveredMonthlyPayment`；
4. `false` 的月供恰好一次加入 `uncoveredMonthlyPayment` 和
   `effectiveEssentialExpense`；
5. `investableNetAssets` 为现有可投资资产总额减去总负债，且允许真实负值；
6. 所有五个派生值仅由真实 production summary 函数返回，而不是源码字符串断言。

### 9.3 确认与中文页面

1. 负债事实存在并不自动确认；
2. 有有效 record 时完整确认可成功，空数组时“我目前没有负债”可成功；
3. 有 record 时明确无负债拒绝且 state 不变；
4. 新增、编辑、删除均与 completion 失效原子持久化，并保留其他 completion 字段；
5. 负债 completion 不改变 retirement completeness 或任何 Phase 4A 冻结指标；
6. 新增用户可见文案为中文，且不泄露内部 enum、boolean、schema 或 source。

### 9.4 回归边界

现有 Security bridge、Income、Assets、旧退休时间模拟、canonical adapter、
retirement-index model 和 Drag 契约必须保持原断言。后续实现不得通过修改这些公式测试
来使负债功能通过。

## 10. 验收标准

Phase 4A 仅当以下条件同时满足时才可完成：

- state 已稳定在 schema v3，且 v2 migration 无自动负债推断；
- `liabilities[]` 是唯一负债 raw-fact source，V1 字段与五类 type 均按本文执行；
- 每项有效 current liability 的 `outstandingBalance` 均满足
  `Number.isFinite(value) && value > 0`；0 元已结清余额不得保存为 liability；
- completion 完全显式，明确无负债仅在空数组有效，事实变动立即失效；
- 去重标记和五个派生值严格按本文公式计算且全部不持久化；
- stale `dragItems` 在所有 storage 路径被剥离，`manualDrags` 不受影响；
- 独立“负债”页面只做中文事实管理、汇总与确认，且页面汇总仅展示“负债总额”“每月总还款”与
  “尚未计入必要支出的月供”；不得展示 `effectiveEssentialExpense`、`investableNetAssets`，也不得
  将二者接入 Overview；
- 当前退休率、资产进度、覆盖率、安全垫、Drag 分数和旧退休时间模拟没有行为变化；
- 未引入券商能力、网络或外部数据来源假设。

## 11. 自检

- [x] 本文只定义负债事实、去重与页面边界，没有实施代码、测试或迁移。
- [x] 已以当前 schema v2、storage derived-field stripping、旧 profile 月供字段、
  `manualDrags`、canonical adapter 和退休模型的真实调用边界为依据。
- [x] 已将 v2 → v3 的空负债迁移、旧字段保留与显式 completion 写为确定规则。
- [x] 已将 `dragItems` stale storage 清理与 `manualDrags` 保留分开，未把二者混为事实源。
- [x] 已固定五个派生值的唯一公式，且明确它们不接入任何当前退休指标或旧模拟。
- [x] 已冻结所有新增用户可见文案为中文，没有引入外部数据能力假设。
- [x] 本文不存在未完成占位或范围冲突。
