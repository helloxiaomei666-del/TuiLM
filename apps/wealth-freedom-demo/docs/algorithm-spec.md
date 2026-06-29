# 《退了吗》统一算法口径

> 文档状态：当前实现口径与后续开发约束  
> 适用范围：`wealth-freedom-demo` 主项目的小程序算法、聚合层与测试  
> 最后更新：2026-06-29

## 1. 项目算法边界

《退了吗》是面向普通人的退休进度解释工具，不是投资建议工具，也不是官方养老金计算器。算法只基于用户输入和本地记录生成解释性估算，不能输出“是否应该退休”“是否应该辞职”“是否应该买卖资产”等建议。

项目明确不做：

- 官方养老金待遇测算。
- 金融产品推荐。
- 收益承诺或市场预测。
- 辞职、退休、消费或资产买卖建议。
- 把未到账、未领取或未实现的数据包装成当前现金流。

所有结果必须被解释为：

> 基于用户输入的估算与解释，不构成任何投资、理财、保险或人生决策建议。

## 2. 两层退休模型

主项目采用两层模型，而不是单一“退休率”公式。

### 2.1 第一层：现金流退休率

首页第一核心指标是现金流退休率。它回答：

```text
现在已经有多少生活成本由真正的当前完全被动现金流覆盖？
```

现金流退休率只统计当前、实际到账、可用于生活、无需持续劳动、并明确标记为可计入的完全被动收入。它决定首页主状态分级。

### 2.2 第二层：资产目标与退休时间模拟

原资产目标模型继续保留，回答：

```text
按当前资产、收入、支出和历史回测假设，大约什么时候能达到目标退休资产？
```

它用于解释本金积累进度、预计退休时间、拖累项影响和保障账户未来支持，但不再作为首页唯一核心指标。

## 3. 核心指标定义与公式

### 3.1 资产退休率

代码入口：

```text
wechat-miniapp/utils/calculation-core.js
progressFromAssets(currentAssets, target)
```

公式：

```text
currentAssets = cash + investments
资产退休率 = currentAssets / target
```

实现规则：

- 原始资产与目标资产继续用于 `simulate()`。
- `progressFromAssets()` 返回展示百分比，最高为 100。
- 当前实现里的 `currentAssets` 是纳入退休测算的现金类资产与投资类资产，不包含保障账户余额。
- 资产退休率是辅助指标，不决定现金流退休状态。

### 3.2 预计退休时间

代码入口：

```text
wechat-miniapp/utils/calculation-core.js
simulate(values, overrides)
```

每月净投入：

```text
monthlyInvestable =
  salary
  + sideIncome
  - livingCost
  - mortgage
  - carLoan
  - otherDebt
  - manualDragOutflow
```

模拟规则：

- 用历史工资推导工资增长率。
- 用历史资产变动推导投资回报率。
- 按月复利滚动。
- 最多模拟 720 个月。
- `reached` 表示是否达到目标资产。
- `months` 表示达到目标资产的月份；不可达时为 720。

该模型保留作为第二层解释，不替代现金流退休率。

### 3.3 现金流退休率

代码入口：

```text
wechat-miniapp/utils/passive-income-model.js
getCashflowRetirementRate(monthlyPassiveIncome, monthlyLivingCost)
getRetirementStatus(profile, holdings, incomeStreams, options)
```

公式：

```text
现金流退休率 = 当前月完全被动收入 / 目标月生活成本
```

分母选择：

```text
denominatorMonthlyLivingCost =
  targetMonthlyLivingCost > 0
    ? targetMonthlyLivingCost
    : monthlyLivingCost > 0
      ? monthlyLivingCost
      : unavailable
```

规则：

- 原始比率允许超过 100%。
- UI 进度条使用 `displayProgress = min(rawRate, 1)`。
- 数值文本保留真实比例。
- 目标月生活成本缺失时回退当前月生活成本。
- 两个生活成本都无效时，现金流退休率不可用，不返回伪造的 0%、100%、`Infinity` 或 `NaN`。

### 3.4 劳动依赖率

代码入口：

```text
wechat-miniapp/utils/passive-income-model.js
getLaborDependenceRate(cashflowRetirementRate)
```

公式：

```text
劳动依赖率 = max(0, 1 - 现金流退休率)
```

规则：

- 现金流退休率超过 100% 时，劳动依赖率显示为 0%。
- 不显示负数。
- 半被动收入不降低主劳动依赖率。

### 3.5 安全垫月数

代码入口：

```text
wechat-miniapp/utils/passive-income-model.js
getRunwayMonths(liquidAssets, monthlyLivingCost)
wechat-miniapp/utils/overview-model.js
getOverviewModel(state)
```

公式：

```text
安全垫月数 = 可动用流动资产 / 当前必要月支出
```

首页聚合层当前传入：

```text
可动用流动资产 = 现金类资产

当前必要月支出 =
  livingCost
  + mortgage
  + carLoan
  + otherDebt
  + manualDragOutflow
```

规则：

- 分母小于等于 0 时不可用。
- 不自动计入保障账户、锁定资产、未来养老金或低流动性资产。
- 安全垫解释短期韧性，不决定现金流退休状态。

### 3.6 被动收入缺口与盈余

代码入口：

```text
wechat-miniapp/utils/passive-income-model.js
getPassiveIncomeGap(monthlyPassiveIncome, monthlyLivingCost)
```

公式：

```text
被动收入缺口 = max(0, denominator - monthlyPassiveIncome)
现金流盈余 = max(0, monthlyPassiveIncome - denominator)
```

## 4. 输入字段

### 4.1 用户目标与主动现金流

| 字段 | 来源 | 用途 |
| --- | --- | --- |
| `target` | `userProfile.target` | 资产退休率与资产目标模拟分母 |
| `targetMonthlyLivingCost` | `userProfile.targetMonthlyLivingCost` | 现金流退休率优先分母 |
| `livingCost` | `userProfile.livingCost` | 现金流退休率回退分母、必要支出组成 |
| `salary` | `userProfile.salary` | 资产目标模拟中的主动收入 |
| `sideIncome` | `userProfile.sideIncome` | 资产目标模拟中的主动收入；默认不等于半被动收入 |
| `mortgage` | `userProfile.mortgage` | 必要支出与退休时间模拟 |
| `carLoan` | `userProfile.carLoan` | 必要支出与退休时间模拟 |
| `otherDebt` | `userProfile.otherDebt` | 必要支出与退休时间模拟 |

### 4.2 资产持仓

| 字段 | 用途 |
| --- | --- |
| `type` | 资产归类，决定现金或投资类别 |
| `currentValue` / `value` | 当前资产价值 |
| `quantity`、`currentPrice` | 可推导当前价值 |
| `producesCashflow` | 是否产生当前现金流 |
| `cashflowAmount` | 当前实际到账金额 |
| `cashflowFrequency` | `monthly`、`quarterly`、`annual`、`irregular` |
| `cashflowStatus` | `current` 才可能进入当前被动收入 |
| `requiresLabor` | 为 `true` 时不进入严格被动收入 |
| `includeInPassiveIncome` | 通过模型校验后才进入主被动收入 |

### 4.3 独立收入流

| 字段 | 用途 |
| --- | --- |
| `type` | `passive`、`semi_passive`、`active`、`one_off` |
| `amount` | 对应频率下的当前金额 |
| `frequency` | 月化规则 |
| `monthlyHistory` | 不固定收入的历史观察期 |
| `status` | `current` 才可能进入当前收入 |
| `requiresLabor` | 持续劳动依赖标记 |
| `includeInPassiveIncome` | 严格被动收入纳入标记 |
| `includeInSemiPassiveIncome` | 半被动收入纳入标记 |
| `originKey` | 防重复计算来源键 |

### 4.4 保障账户

| 字段 | 用途 |
| --- | --- |
| `pension.balance` | 未来支持解释，不进入当前可投资资产 |
| `pension.estimatedMonthlyBenefit` | 预计退休后月领，不进入当前现金流退休率 |
| `housingFund.balance` | 福利资产展示和未来支持解释，不进入当前现金流退休率 |
| `housingFund.loanOffsetMonthly` | 当前房贷抵扣解释，不作为被动收入 |
| `enterpriseAnnuity.*` | 未来退休支持解释 |
| `occupationalAnnuity.*` | 未来退休支持解释 |

## 5. 输出字段

`getRetirementStatus()` 的核心输出：

| 字段 | 含义 |
| --- | --- |
| `cashflowRetirementRate` | 原始现金流退休率，可超过 1 |
| `cashflowRetirementRateDisplay` | UI 进度值，最高为 1 |
| `assetRetirementRate` | 资产退休率，由聚合层传入 |
| `runwayMonths` | 安全垫月数 |
| `laborDependenceRate` | 劳动依赖率 |
| `passiveIncomeGap` | 当前严格被动收入缺口 |
| `passiveIncomeSurplus` | 当前严格被动收入盈余 |
| `monthlyPassiveIncome` | 当前月完全被动收入 |
| `monthlySemiPassiveIncome` | 当前月半被动收入 |
| `combinedCoverageRate` | 含半被动覆盖率，仅作补充观察 |
| `status.code` | 现金流退休状态码 |
| `denominator.amount` | 本次采用的生活成本分母 |
| `denominator.source` | `targetMonthlyLivingCost` 或 `monthlyLivingCost` |
| `warnings` | 月化、重复来源等警告 |
| `provenance` | 被纳入收入的来源明细 |

`getOverviewModel()` 继续输出旧资产模拟结果，并新增首页四率所需展示字段。

## 6. 纳入与排除规则

### 6.1 可计入主现金流退休率

一笔收入只有同时满足以下条件，才进入主现金流退休率：

1. 当前已经实际到账或正在按合同稳定到账。
2. 可用于日常生活成本。
3. 无需持续劳动才能获得。
4. `type === "passive"`。
5. `status === "current"`。
6. `requiresLabor === false`。
7. `includeInPassiveIncome === true`。
8. 未与其他来源重复。

示例包括当前净房租、已到账股息、已到账债券利息、已到账存款利息、已经开始领取且可用于生活的养老金或年金、稳定版权收入等。

### 6.2 不计入主现金流退休率

以下内容不得进入当前现金流退休率：

- 半被动收入。
- 工资、兼职、接单和需要持续劳动的副业收入。
- 未来养老金。
- 尚未领取的企业年金或职业年金。
- 预计投资收益。
- 未实现涨幅。
- 预计分红。
- 尚未到账租金。
- 公积金余额。
- 房贷冲还贷金额。
- 一次性奖金、红包、卖资产回款。

### 6.3 半被动收入

半被动收入可进入：

```text
monthlySemiPassiveIncome
combinedCoverageRate
```

但不得影响：

- 主现金流退休率。
- 劳动依赖率。
- 当前退休状态分级。
- 首页第一核心解释指标。

## 7. 状态分级规则

状态只由严格现金流退休率决定。

| 区间 | 状态码 | 状态名称 |
| --- | --- | --- |
| `< 0.1` | `survival_dependent` | 生存依赖期 |
| `>= 0.1` 且 `< 0.3` | `cashflow_seed` | 现金流萌芽期 |
| `>= 0.3` 且 `< 0.6` | `semi_free` | 半自由期 |
| `>= 0.6` 且 `< 0.9` | `near_retirement` | 准退休期 |
| `>= 0.9` | `cashflow_retirement` | 现金流退休期 |

测试必须覆盖：

```text
0.099, 0.1, 0.299, 0.3, 0.599, 0.6, 0.899, 0.9, 1.2
```

超过 100% 仍属于 `cashflow_retirement`，但不代表可以辞职或永久安全。

## 8. 保障账户处理原则

养老金、公积金、企业年金、职业年金等保障账户不进入当前可投资资产总额，也不自动进入当前现金流退休率。

### 8.1 养老金

未开始领取时：

- 不进入当前现金流退休率。
- 不进入当前完全被动收入。
- 只作为未来退休支持解释。

已开始领取且实际到账时，未来可以通过独立收入流或明确状态字段进入严格被动收入，但必须满足当前到账、可用于生活、无需持续劳动等规则。

### 8.2 企业年金与职业年金

未开始领取时：

- 不进入当前现金流退休率。
- 可进入未来退休缺口解释。

### 8.3 公积金与补充公积金

原则：

- 不进入当前现金流退休率。
- 不进入当前可投资资产总额。
- 可作为福利资产展示。
- 可用于解释房贷冲还贷对当前支出的影响。
- 后续如要专项处理，必须单独设计字段、状态和测试。

### 8.4 `getSecuritySupport()`

代码入口：

```text
wechat-miniapp/utils/calculation-core.js
getSecuritySupport(values, baseResult, securityAccounts)
```

用途：

- 解释未来退休支持。
- 解释可能缩短多少资产目标达成月份。
- 展示保障账户余额、预计退休后月领和房贷抵扣对旧资产模拟的影响。

重要边界：

```text
future support !== 当前现金流退休率
```

`estimatedMonthlyBenefit` 当前表示预计退休后月领，不等于正在领取，不能直接进入当前现金流退休率。页面文案应使用“未来支持”等表述，避免与首页主现金流退休率混淆。

## 9. UI 与算法一致性要求

- 首页第一核心指标必须是现金流退休率。
- 资产退休率保留为辅助指标。
- 现金流退休率文本显示真实比例，进度条封顶 100%。
- 劳动依赖率不显示负数。
- 半被动收入必须单独标注。
- 保障账户展示必须说明不计入当前可投资资产，也不代表官方待遇测算。
- 未来支持不得被文案描述为当前现金流退休率的收入来源。
- 所有关键结果附近必须有非建议、非承诺提示。

## 10. 主项目与 `retirement-test` 的差异

`retirement-test` 是与《退了吗》主项目隔离的一次性测算 MVP。当前 `retirement-test` 主目录主要保存规格和计划；H5 MVP 实际实现位于 `retirement-test/.worktrees/implement-mvp`，不是《退了吗》主项目源码。

主项目：

- 保留历史工资增长与投资回报回测。
- 保留按月复利的 `simulate()`。
- 保留资产目标模拟。
- 以现金流退休率作为首页第一解释指标。
- 长期记录资产、保障、路线、拖累项和现金流。

`retirement-test`：

- 使用更保守的零收益模型。
- 目标资产公式为：

```text
目标资产 = 目标月生活成本 * 12 / 4%
```

- 不假设投资回报。
- 不假设通胀。
- 不假设收入增长。
- 提供 100 / 500 / 1000 元月被动收入的退休推进器。
- 与主项目代码和存储隔离。

两个项目的共同边界是：不做投资建议，不推荐金融产品，不承诺收益，不输出退休决策建议。

## 11. 测试口径

必须保留或补充以下测试：

- 现金流退休率超过 100%：原始值可超过 1，显示进度封顶，劳动依赖率为 0。
- 目标月生活成本缺失时，回退当前月生活成本。
- 半被动收入只进入补充覆盖率，不影响主现金流退休率和状态。
- 未来养老金与未来年金不进入当前现金流退休率。
- 公积金不进入当前可投资资产或当前现金流退休率。
- 状态分级边界无空档、无重叠。
- 保障账户文案不能把未来支持表达为当前现金流退休率收入。

## 12. 风险提示与免责声明

产品和页面必须持续表达：

- 本工具仅用于个人财务状态记录、估算和自我观察。
- 结果基于用户输入和简化假设生成。
- 不构成投资建议、理财建议、保险建议或退休决策建议。
- 不推荐任何金融产品。
- 不承诺任何收益。
- 不预测市场走势。
- 不建议用户买入、卖出或持有任何资产。
- 养老金、公积金、年金等只按用户输入展示和估算，不代表官方待遇测算。
- 半被动收入仍需维护，不能等同完全被动收入。
- 达到 90% 或超过 100% 只表示当前录入现金流覆盖情况，不表示可以辞职或永久安全。

## 13. 当前代码审查结论

截至本文档更新时，当前主项目实现与统一口径的关系如下：

- `progressFromAssets()` 与 `simulate()` 保留为资产目标层，符合“双层模型”要求。
- `passive-income-model.js` 已将严格被动收入、半被动收入、状态分级和展示进度分开。
- `overview-model.js` 已将现金流退休率置于首页聚合结果中，并保留资产退休率、安全垫月数和劳动依赖率。
- 保障账户没有进入 `currentAssets`，公积金也没有进入当前现金流退休率。
- 未来养老金和年金只通过 `getSecuritySupport()` 参与未来支持解释，没有进入 `getRetirementStatus()` 的主被动收入。
- 已修正保障账户展示文案，避免把未来支持称为当前“现金流支持”。
