# TuiLM Phase 4A：负债事实与必要支出去重设计

**状态：** Task 2 存储契约修订记录；Phase 4A 已推进至 Task 4 提交后状态。

**日期：** 2026-08-22

**原始设计基线：** `272dca1 feat(miniapp): bridge security into retirement protection`

**Task 2 契约修订基线：** `6b5d3c881aed43f5eed0b5564b5032f5c06c4f0b feat(miniapp): add liability fact summary model`。本记录统一 malformed v3 拒绝与 snapshot 派生字段禁存契约，其他冻结设计不变。后续 Phase 4A Task 2、Task 3 与 Task 4 已依次推进；当前已提交 HEAD 为 `39d0fd2 feat(miniapp): add liability input page`。本修订保留其权威技术契约，不再将 Task 2 描述为未提交状态或施加已过期的后续任务授权限制。

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

原始设计基线中的小程序 state 的 `schemaVersion` 为 2。`demo-data.js` 保存原始
`userProfile`、`holdings`、`incomeStreams`、`manualDrags`、`securityAccounts` 与
`inputCompletion`；`storage.js` 已剥离若干 canonical 派生字段和
`protectionAccounts`，但尚未剥离 `dragItems`。

当前存在两类不应混为一谈的历史数据：

| 现有字段 | 当前真实角色 | Phase 4A 处理 |
| --- | --- | --- |
| `userProfile.mortgage`、`carLoan`、`otherDebt` | 旧退休时间模拟使用的月度支出输入；`calculation-core.simulate()` 将它们加入月度支出 | 原样保留、原样持久化、原样参与旧模拟；不自动产生任何 `liabilities` item。 |
| `manualDrags[]` | 遗留月度现金流事实；拖累页面以 `category`、`amount`、`title` 等字段维护，并传给旧退休时间模拟的 `manualDragOutflow` | 原样保留、原样持久化；不迁移为负债，不生成新 drag item，不更改现有拖累计算。 |
| `dragItems` | canonical retirement input 的派生/兼容输入，不应成为 storage 事实源 | v3 migration、load 与每次保存都剥离顶层及 persisted snapshot structures 中的 stale `dragItems` 派生载荷；不影响 `manualDrags` 或合法 completion 标记。 |

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

### 4.2 v2 初始化与 v3 校验必须区分

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

v2 原本没有正式 `liabilities` 字段，上述空数组与 false 是 schema 新增字段的初始化，
不是异常数据 fallback。合法 v2 缺少此字段必须仍可升级；v2 中即使夹带同名数据或
liability completion，也不把它们当作正式 v3 事实或确认。

当 `schemaVersion === 3` 时，`liabilities` 必须存在且为符合第 3 节 V1 contract 的数组：
`[]` 或完整的有效 liability facts 数组。`null`、object、string、number、boolean、
显式 `undefined`、missing 以及其他非数组均为 malformed v3，必须明确拒绝。
数组中的无效 item 或重复 id 同样使整个操作失败；不得过滤后部分接受、补默认事实、
强制转换类型或将异常列表替换为空数组。

v3 的 `saveState()`、`loadState()`、`migrateState()` / Storage canonicalization
必须复用 Task 1 的 `validateLiabilityFacts()` 唯一事实校验边界，使用相同的合法性标准。
成功时只保留七个 V1 raw 字段；失败时向调用方抛出带 validator 中文消息的 `Error`，
不得出现 save 拒绝而 load 静默接受的非对称行为。非数组的中文错误为 `负债列表格式无效`；
item 错误沿用 Task 1 的相应中文消息，不新增另一套校验规则。

只有 v3 事实校验成功后，才按原语义保留 completion：`inputCompletion.liabilities`
仅在 user mode 且原值严格为 `true` 时保留，其他情况为 `false`；既有 completion 字段
必须原样保留。合法 v3 再次 migrate/load 不得重置已确认状态或丢失合法负债。

### 4.2.1 validation failure 的零写入边界

```text
V2 缺少 liabilities → schema 初始化 → liabilities=[]，completion=false
V3 malformed liabilities → 中文 validation error → ZERO STORAGE WRITE
```

`loadState()` 发现 malformed v3 必须失败，不返回替代 state，不进入自动迁移写回，
不调用 `setStorageSync` / `removeStorageSync`，也不替换 Node memory fallback 的原 state。
原始存储必须保持不变，即使其中的 `inputCompletion.liabilities === true` 也一样；
不得构造或持久化 `[] + true` 形式的 confirmed-none，不得以重置 completion 为理由覆盖数据。
`saveState()` 校验失败也不得写入或部分保存；`migrateState()` / canonicalization
失败不得修改传入对象。即使同一 state 含有可清理的 stale derived fields，也必须先保证
v3 事实校验成功，才允许持久化清理结果。失败加载不得产生 destructive normalization。

本次只冻结此失败行为，不设计 recovery UI、自动恢复流程或额外存储系统。

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

这一清理删除顶层及第 4.4 节 persisted snapshot structures 中的 stale `dragItems`
派生载荷；不得删除、改写或转换 `manualDrags`，也不得删除 `inputCompletion.dragItems`
等合法确认标记。既有 Drag 兼容路径不变。

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

禁止范围明确包括 top-level persisted state、`calculationSnapshots`、
`valuationSnapshots` 以及 Phase 4A 已知其他 persisted snapshot container；容器内任意层级的
对象和数组均不得绕过 stripping。当前 Task 2 Storage 明确持有前述两类 snapshot 数组，
实施时须核对已有持久化入口；发现已有其他 snapshot container 时适用同一规则，
不因本契约新增容器或重构 snapshot schema。

统一的 single-source 分类为：

| 分类 | 字段 / 载荷 | Storage 规则 |
| --- | --- | --- |
| Persisted raw facts | `liabilities`、`manualDrags`、`securityAccounts` | 保留各自冻结的事实契约；负债只保存经 Task 1 校验的七字段。 |
| Non-persisted derived facts | `protectionAccounts`、`dragItems` 派生载荷，以及上述五项 liability summary | 顶层与 persisted snapshot structures 均须剥离；“历史快照”身份不赋予其正式事实地位。 |

只要进入 TuiLM persistence boundary，就不能通过嵌套结构保存这些派生副本。
该规则适用于 v2 → v3 migration、合法 v3 canonicalization、save、load/reload，
并覆盖 wx-backed 与 Node memory fallback。校验成功后的持久化结果及返回 state 均须满足；
malformed v3 的原始存储则按第 4.2.1 节保持不变，不以 stripping 为理由写回。

清理只移除禁止的派生载荷，保留合法历史 snapshot facts、容器、记录数量、顺序及其他
合法嵌套字段，不清空快照、不删除整条历史记录、不重算历史值、不改变业务含义。
例如既有估值快照的 `snapshotDate`、`totalValue`、`items[].currentValue` 等仍须保留；
不得把此规则扩大为“禁止所有历史计算字段”。`inputCompletion` 中合法的 boolean 确认标记
（包括同名的 `protectionAccounts`、`dragItems`）不是 derived payload，必须保留原有语义；
不得对所有对象无差别按同名键删除。此处不改变七字段 liability contract 或既有 raw facts。

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
5. migrate/save/reload 都剥离顶层及 snapshot structures 中的 stale `dragItems`、
   `protectionAccounts` 派生载荷，不伤及 `manualDrags`、`securityAccounts` 或合法 completion；
6. 在 `calculationSnapshots`、`valuationSnapshots` 的记录及嵌套对象/数组中分别注入
   五个负债派生值，验证 v2/v3 migration、save、load/reload、wx 和 memory 路径均剥离它们；
   其他合法历史字段、快照数量与顺序保持不变，不能用清空快照满足断言；
7. v3 `liabilities=null`、`{}`、`"invalid"`、number、boolean、`undefined` / missing
   的 load/save/migration 均拒绝且错误符合 Task 1 中文校验；特别验证 completion 为 true
   时仍拒绝、不返回 `[] + true`，load 发生零存储写入且原记录不变；无效数组 item 同样拒绝；
8. 保留独立控制例：合法 v2 缺少 `liabilities` 时升级到 v3、空数组和 false；同时验证
   合法 v3 空/非空数组、已有确认及重复 migration/load 的稳定性，避免混淆初始化与异常拒绝。

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
- malformed v3 在 save/load/migration 使用同一 validator 明确拒绝，中文错误且零存储写入；
- `liabilities[]` 是唯一负债 raw-fact source，V1 字段与五类 type 均按本文执行；
- 每项有效 current liability 的 `outstandingBalance` 均满足
  `Number.isFinite(value) && value > 0`；0 元已结清余额不得保存为 liability；
- completion 完全显式，明确无负债仅在空数组有效，事实变动立即失效；
- 去重标记和五个派生值严格按本文公式计算且全部不持久化；
- 顶层及 calculation/valuation 等 persisted snapshot structures 均执行统一 derived stripping，
  保留合法历史事实，不以清空快照替代清理；
- stale `dragItems` 在所有 storage 路径被剥离，`manualDrags` 不受影响；
- 独立“负债”页面只做中文事实管理、汇总与确认，且页面汇总仅展示“负债总额”“每月总还款”与
  “尚未计入必要支出的月供”；不得展示 `effectiveEssentialExpense`、`investableNetAssets`，也不得
  将二者接入 Overview；
- 当前退休率、资产进度、覆盖率、安全垫、Drag 分数和旧退休时间模拟没有行为变化；
- 未引入券商能力、网络或外部数据来源假设。

## 11. 自检

- [x] 本文只定义负债事实、去重与页面边界，没有实施代码、测试或迁移。
- [x] 已以原始设计基线的 schema v2、storage derived-field stripping、旧 profile 月供字段、
  `manualDrags`、canonical adapter 和退休模型的真实调用边界为依据。
- [x] 已将 v2 → v3 的空负债迁移、旧字段保留与显式 completion 写为确定规则。
- [x] 已区分 v2 初始化与 malformed v3 拒绝，统一 save/load/migration 校验及失败零写入。
- [x] 已明确两类已知快照和嵌套结构的派生载荷禁存，并保留合法历史事实及 completion 语义。
- [x] 已将 `dragItems` stale storage 清理与 `manualDrags` 保留分开，未把二者混为事实源。
- [x] 已固定五个派生值的唯一公式，且明确它们不接入任何当前退休指标或旧模拟。
- [x] 已冻结所有新增用户可见文案为中文，没有引入外部数据能力假设。
- [x] 本文不存在未完成占位或范围冲突。
