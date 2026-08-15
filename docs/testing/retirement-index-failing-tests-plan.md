# TuiLM 综合退休率失败测试设计方案

> 文档状态：测试契约设计稿；本文件不新增或修改任何可执行测试。
>
> 对应产品基线：`baseline-tuilm-retirement-index-prd-20260815`
>
> 对应 PRD：`docs/product/passive-income-coverage-prd.md`

## 1. 测试设计目标

本方案将“总退休率 / 退了吗指数”拆解为先失败、后实现的可验证契约。目标不是证明现有代码已经符合 PRD，而是先固定未来实现不得突破的产品边界。

核心对象分为两层：

1. **核心退休率 / 被动收入覆盖率**：`monthly_stable_passive_income / monthly_essential_expense`。它是独立、可追溯的现金流事实，也是综合指数中权重最高的二级指标。
2. **总退休率 / 退了吗指数**：由被动收入覆盖率、现金安全垫、生息资产质量、总资产进度、保障账户完成度和拖累项目惩罚共同解释的 0 至 100 分准备度指数。

所有新增可执行测试应先以红灯状态加入：当前实现尚未提供统一的综合指数核心、集中权重配置、完整收入资产录入契约或三端适配层。实现阶段不得通过放宽断言、把资产进度改名为退休率，或在页面中复制计算逻辑来使测试变绿。

### 1.1 V1 总退休率组合契约

在二级指标都已规范化为 0 至 100 分后，V1 总退休率应满足：

```text
retirement_index = clamp(
  0.40 * passive_income_coverage_score
  + 0.15 * cash_safety_runway_score
  + 0.15 * income_asset_quality_score
  + 0.15 * total_asset_progress_score
  + 0.15 * protection_account_score
  - drag_penalty_score,
  0,
  100
)
```

`drag_penalty_score` 的总上限为 20 分。二级指标的分档阈值、缺失数据策略和各拖累项扣分表不应散落在测试或页面中；应由未来单一 V1 配置对象提供。组合测试仅验证配置、计算和解释的一致性，不提前把尚未冻结的阈值硬编码为产品事实。

## 2. 当前已知测试基础

| 现有位置 | 已覆盖的事实 | 新方案中的缺口 |
| --- | --- | --- |
| `apps/wealth-freedom-demo/tests/passive-income-model.test.js` | 月/季/年换算、半被动排除、未来/劳动依赖收入排除、重复来源排除、覆盖率、缺口和状态边界。 | 没有月必要支出的强制契约、收入资产细分、综合指数、保障得分、拖累扣分或集中权重验证。 |
| `apps/wealth-freedom-demo/tests/wechat-miniapp.test.js` | 小程序状态迁移、`incomeStreams` 默认值和总览模型的部分消费。 | 未覆盖用户可录入的生息资产、指数分层和与 Web/H5 的同 fixture 一致性。 |
| `apps/wealth-freedom-demo/tests/wechat-miniapp-page-smoke.test.js` | 小程序概览、资产、保障、路线和拖累页的交互冒烟。 | 未验证首页把总退休率、覆盖率、安全垫和最大拖累项分开解释。 |
| `apps/retire-quiz/tests/calculator.test.js` | H5 的 `cashflowRetirementRate`、资产进度、安全垫、被动收入频率和退休时间估算。 | 仍使用旧输入结构；没有稳定性/到账状态/来源去重、保障完成度、拖累扣分或综合指数。 |
| `apps/retire-quiz/tests/app.test.js` 与 `structure.test.js` | H5 表单、摘要、页面结构和展示文案。 | 没有统一核心模型适配，也没有禁止资产进度被称为退休率的跨端断言。 |

这些现有测试是回归保护，不应被删除或改写为迎合新模型。新增红灯测试应先与其并存，直至适配迁移完成。

## 3. 建议新增测试文件

以下路径是后续实现阶段的建议，不在本次任务创建：

| 建议文件 | 类型 | 责任边界 |
| --- | --- | --- |
| `apps/wealth-freedom-demo/tests/retirement-index-core.test.js` | 纯核心单元测试 | 覆盖率、安全垫、资产进度、保障、拖累、权重校验和总指数组合。 |
| `apps/wealth-freedom-demo/tests/retirement-index-income-sources.test.js` | 纯核心单元测试 | 覆盖纳入/排除收入、生息资产净额和来源去重。 |
| `apps/wealth-freedom-demo/tests/retirement-index-config.test.js` | 配置契约测试 | 验证权重集中配置、总和、边界、未知键、负数和扣分上限。 |
| `apps/wealth-freedom-demo/tests/retirement-index-cross-platform.test.js` | 跨端契约测试 | 将同一 canonical fixture 送入 Web、小程序与 H5 适配器，比对核心结果。 |
| `apps/wealth-freedom-demo/tests/retirement-index-ui-static.test.js` | 静态页面契约测试 | 验证 Web/小程序不再把资产进度直接标为退休率，并展示四项首页解释。 |
| `apps/retire-quiz/tests/retirement-index-adapter.test.js` | H5 适配器测试 | 验证旧 `cashflowRetirementRate` 与新核心覆盖率的映射，以及 H5 的轻量输入边界。 |

建议未来核心模块只暴露平台无关的输入/输出契约；Web、小程序、H5 只承担字段归一化与展示格式化。不得让三个页面各自实现权重、扣分或收入资格判定。

## 4. 建议新增 fixture

建议在 `apps/wealth-freedom-demo/tests/fixtures/retirement-index/` 建立版本化、纯静态的 fixture。每份 fixture 包含：输入、使用的 V1 配置、预期原始指标、预期得分/扣分、预期解释码；不得包含真实账号、行情、证券账户或外部接口数据。

| Fixture | 最小场景与关键断言 |
| --- | --- |
| `coverage-eligible-sources-v1` | 九类可纳入来源各自独立出现，均满足当前、净额、稳定、无需劳动、非一次性、非出售本金。 |
| `coverage-exclusions-v1` | 工资、兼职、奖金、浮盈、卖出资产、未来收入等同时存在，核心稳定被动收入仍只统计合格来源。 |
| `coverage-no-essential-expense-v1` | 月必要支出缺失、零、负数和非数值；结果必须不可计算，不得回退。 |
| `rental-net-income-v1` | 租金、空置准备、税费、维护、持续性房贷并存；只计月净租金。 |
| `income-source-dedup-v1` | 同一出租房或同一分红同时作为 holding 与 income stream 传入；只计算一次并输出排除原因。 |
| `over-100-coverage-v1` | 覆盖率原始值大于 1；原始值保留，展示进度值为 1。 |
| `cash-safety-runway-v1` | 可快速动用现金、自住房、锁定资产、不可快速变现资产并存；只以前者计算月数。 |
| `asset-progress-isolation-v1` | 高净资产、零合格被动收入；资产进度高但覆盖率为零。 |
| `protection-complete-v1` | 社保、医保、商业保险、公积金、已领养老金/年金的保障明细完整。 |
| `protection-missing-v1` | 保障信息缺失；指数降低并输出 `protection_information_missing`，但总分不得被强制归零。 |
| `drag-penalty-cap-v1` | 多项负债、固定支出、赡养压力、高风险暴露和低流动性资产；扣分合计被限制在 20。 |
| `index-composition-v1` | 直接给定五项标准化得分 `60/80/40/50/30` 与拖累扣分 `10`；期望指数为 `44`。 |
| `index-invalid-config-v1` | 权重缺失、负数、非有限数、正向权重和不为 1、扣分上限为负或大于允许值。 |
| `cross-platform-canonical-v1` | 使用三端都能表达的最小统一输入；输出覆盖率、安全垫、资产进度、保障状态、拖累和总指数。 |

`index-composition-v1` 的计算为 `0.40*60 + 0.15*80 + 0.15*40 + 0.15*50 + 0.15*30 - 10 = 44`，用于锁定组合逻辑，不用于锁定尚未定义的子指标分档。

## 5. 各模块失败测试清单

### 5.1 核心退休率公式

| 红灯测试 | 输入 | 预期契约 |
| --- | --- | --- |
| `calculates_coverage_from_stable_monthly_income_and_essential_expense` | 合格收入 3,000，月必要支出 10,000。 | 覆盖率为 `0.3`，缺口为 7,000。 |
| `does_not_fallback_when_essential_expense_is_missing` | 提供资产目标、工资结余和总支出，但不提供有效月必要支出。 | 覆盖率为不可计算；不得选择任何替代分母。 |
| `keeps_raw_coverage_above_one_but_caps_display_progress` | 合格收入 15,000，月必要支出 10,000。 | 原始覆盖率 `1.5`；进度条值 `1`。 |
| `does_not_replace_coverage_with_asset_progress` | 资产进度 100%，合格收入为 0。 | 覆盖率为 0；二者保留不同字段与解释。 |

### 5.2 可纳入稳定被动收入

每项都应有独立正例，不应只用一个“大杂烩”fixture 掩盖分类错误：

| 红灯测试 | 最小合格来源 | 预期 |
| --- | --- | --- |
| `includes_net_rental_income` | 当前出租房净租金。 | 月净租金进入 `monthly_stable_passive_income`。 |
| `includes_actual_stock_dividend` | 已到账股息/分红。 | 换算后的月净额进入。 |
| `includes_actual_dividend_etf_distribution` | 已到账红利 ETF 分红。 | 换算后的月净额进入。 |
| `includes_bond_coupon_cashflow` | 实际或已确定的当前票息现金流。 | 换算后的月净额进入。 |
| `includes_deposit_interest` | 可用的存款利息。 | 换算后的月净额进入。 |
| `includes_money_market_fund_income` | 可用的货币基金收益。 | 换算后的月净额进入。 |
| `includes_current_pension_or_annuity_only` | `receiving_status=current` 且实际到账。 | 只有实际领取金额进入。 |
| `includes_stable_royalty_or_license_income` | 当前合同、稳定且无需持续劳动的版税/授权收入。 | 月净额进入。 |
| `includes_qualifying_passive_business_cashflow` | 无持续劳动依赖的经营性净现金流。 | 月净额进入。 |

每个正例都必须同时断言：来源状态为当前、稳定性合格、`requires_labor=false`、`is_one_off=false`、`is_principal_sale=false`，并带有唯一 `origin_key`。

### 5.3 必须排除的项目

下列测试必须向核心计算传入一个合格来源作为对照，再逐项加入被排除项，断言核心稳定被动收入和覆盖率不变化，并返回可解释的排除码：

| 红灯测试 | 排除项 | 建议排除码 |
| --- | --- | --- |
| `excludes_salary` | 工资。 | `active_salary` |
| `excludes_part_time_income` | 兼职收入。 | `active_part_time_income` |
| `excludes_one_off_bonus` | 一次性奖金。 | `one_off_income` |
| `excludes_stock_unrealized_gain` | 股票浮盈。 | `unrealized_stock_gain` |
| `excludes_fund_unrealized_gain` | 基金浮盈。 | `unrealized_fund_gain` |
| `excludes_property_appreciation` | 房产涨价。 | `property_appreciation` |
| `excludes_short_term_trading_gain` | 短线交易收益。 | `trading_gain` |
| `excludes_principal_sale_proceeds` | 卖出资产所得。 | `principal_sale` |
| `excludes_unpaid_expected_dividend` | 尚未到账的预期分红。 | `expected_not_received` |
| `excludes_future_pension` | 未来预计养老金。 | `future_benefit` |
| `excludes_temporary_subsidy_or_red_packet` | 临时补贴或红包。 | `temporary_income` |

### 5.4 生息资产与去重

| 红灯测试 | 预期契约 |
| --- | --- |
| `calculates_rental_from_net_income_not_property_value` | 房产估值变化不改变租金现金流；净租金应扣空置、税费、维护和持续性房贷。 |
| `does_not_infer_dividend_from_stock_or_etf_market_value` | 高股息股票或红利 ETF 的市值、预期股息率单独变化时，核心收入不自动变化。 |
| `uses_actual_or_deterministic_bond_coupon_cashflow` | 债券本金不进入收入；已确认票息按周期换算。 |
| `uses_available_deposit_or_money_market_income` | 受流动性限制或不可用收益不进入当前可用收入。 |
| `deduplicates_holding_and_income_stream_by_origin_key` | 同一来源仅计算一次，重复记录在明细中标记 `duplicate_origin`。 |

### 5.5 现金安全垫

| 红灯测试 | 预期契约 |
| --- | --- |
| `calculates_cash_safety_runway_in_months` | `quickly_available_cash / monthly_essential_expense`，输出月数。 |
| `excludes_owner_occupied_and_locked_assets_from_runway` | 自住房、锁定资产和不可快速变现资产不得计入可动用现金。 |
| `keeps_safety_runway_separate_from_coverage` | 改变现金金额只改变安全垫及其得分，不改变核心被动收入金额或覆盖率。 |

### 5.6 总资产进度

| 红灯测试 | 预期契约 |
| --- | --- |
| `calculates_total_asset_progress_from_net_assets_and_target` | `current_net_assets / target_retirement_assets`，作为独立辅助指标。 |
| `does_not_use_asset_progress_as_passive_income_coverage` | 资产进度变化不能替代、覆盖或抬高核心覆盖率。 |
| `does_not_count_unrealized_gain_as_passive_income` | 浮盈可以影响资产进度，但不影响核心被动收入。 |

### 5.7 保障账户完成度

| 红灯测试 | 预期契约 |
| --- | --- |
| `scores_protection_accounts_from_declared_categories` | 社保、医保、商业保险、公积金、养老金、年金分别进入保障完成度的可解释明细。 |
| `reduces_index_but_does_not_zero_it_when_protection_is_missing` | 保障缺失产生统一保守降分和缺失提示；其他有效二级指标仍保留。 |
| `keeps_future_pension_out_of_current_coverage` | 未来养老金只进入保障/辅助层；实际领取后才可同时进入核心现金流。 |

### 5.8 拖累项目惩罚

| 红灯测试 | 预期契约 |
| --- | --- |
| `penalizes_declared_drag_categories` | 房贷、车贷、消费贷、信用卡债务、高固定支出、赡养压力、高风险暴露和低流动性资产占比可产生可追溯扣分。 |
| `caps_total_drag_penalty_at_twenty_points` | 多项拖累的合计扣分最多为 20。 |
| `applies_drag_to_index_not_raw_passive_income` | 拖累变化仅改变总指数/拖累明细，不篡改原始稳定月被动收入或核心覆盖率。 |

### 5.9 权重配置与总指数

| 红灯测试 | 预期契约 |
| --- | --- |
| `uses_single_v1_weight_configuration` | 核心模型从单一配置读取 40/15/15/15/15；页面适配器没有权重常量。 |
| `calculates_index_from_weighted_components_and_penalty` | 使用 `index-composition-v1` 得到 44。 |
| `explains_index_change_when_one_weight_changes` | 在其他值不变时改变某一权重，结果与分项贡献同步变化并可追溯。 |
| `rejects_invalid_weight_configuration` | 缺失键、负数、非有限值、正向权重和不为 1、扣分上限无效均返回配置错误。 |
| `clamps_index_to_zero_and_one_hundred` | 过高正向得分或过大扣分后，总指数仍在 0 至 100。 |

## 6. 跨端一致性测试设计

### 6.1 单一 canonical fixture 与适配器

未来应选择 `cross-platform-canonical-v1` 作为唯一产品事实。测试流程为：

1. 把 canonical fixture 送入平台无关核心模型，得到预期原始指标、得分、扣分、总指数和解释码。
2. Web 适配器将其 Web 表单/持仓结构归一化后调用同一核心。
3. 小程序适配器将 `userProfile`、`holdings`、`incomeStreams`、`securityAccounts`、`manualDrags` 归一化后调用同一核心。
4. H5 适配器将现有 `assets`、`debts`、`passiveIncome` 及新字段归一化后调用同一核心。
5. 三端断言以下原始值与解释码完全一致；仅货币格式、百分比格式和页面布局可以不同。

```text
monthly_stable_passive_income
monthly_essential_expense
passive_income_coverage_rate
asset_safety_runway_months
total_asset_progress
protection_account_status / protection_account_score
drag_penalty_score
retirement_index
included_sources / excluded_sources
```

### 6.2 旧模型迁移断言

- H5 的旧 `cashflowRetirementRate` 在输入已满足新核心字段时，必须等于新 `passive_income_coverage_rate`；旧 `targetMonthlyCost` 只能通过显式迁移映射成为 `monthly_essential_expense`。
- 小程序 `passive-income-model` 只负责收入资格和覆盖率，不得暗中自行计算或覆盖综合指数；综合指数由上层统一核心组合。
- Web Demo 的资产进度必须保留为 `total_asset_progress`，静态页面测试应拒绝以“退休率”作为该资产指标的主标签。
- 任一端缺少新字段时，应返回统一的不可计算/信息不足状态，而不是以工资、资产目标、总支出或预期收益作静默补齐。

### 6.3 UI 契约检查

页面级或静态检查至少验证首页能分别表达：总退休率/退了吗指数、被动收入覆盖率、现金安全垫、最大拖累项和一句话解释。总指数卡片必须能定位到二级指标得分、扣分和原因；被动收入覆盖率必须能定位到分子、分母、纳入来源和排除来源。

## 7. 不应测试或暂不测试的内容

- 不测试真实 SDK 登录、真实行情、真实账户、券商权限、分红下载或任何外部接口。
- 不测试个股推荐、收益预测、投资建议、收益承诺或自动交易策略。
- 不以真实用户资产、税务、房产、医疗、保险或家庭数据作为 fixture。
- 在负责人冻结各二级指标分档前，不把任意“几个月安全垫得多少分”“某类保险必得几分”等阈值写成不可变产品事实；此阶段只测试阈值从集中配置读取、可验证且可解释。
- 不把页面像素、视觉风格或营销文案当作核心模型通过条件；它们应在模型契约稳定后另行验收。
- 不通过删除既有 Web、小程序或 H5 回归测试来降低改造难度。

## 8. 推荐实施顺序

1. **冻结数据与配置契约。** 确认 canonical 输入、输出、解释码、V1 权重、分档配置接口和缺失数据规则。
2. **先写纯核心红灯测试与 fixture。** 依次覆盖核心覆盖率、纳入/排除、去重、安全垫、资产进度、保障、拖累和配置校验。
3. **实现最小平台无关核心。** 仅让第二步红灯测试变绿，不接 UI、不接行情、不改现有路线模拟。
4. **写并实现三端适配器契约。** 先以 canonical fixture 对齐 H5、小程序和 Web 的原始核心输出。
5. **最后写页面静态/冒烟测试。** 验证正确命名、首页解释、下钻信息和旧文案迁移。
6. **执行全量既有回归。** 新旧测试必须共同通过，避免覆盖率模型回归为资产型退休进度。

## 9. 下一步前三个任务

1. 由项目负责人冻结二级指标的分档、保障缺失策略与拖累扣分表，并形成可版本化的 V1 配置契约。
2. 新建 canonical fixture 与 `retirement-index-core.test.js` 红灯测试，优先锁定覆盖率、纳入/排除和 `index-composition-v1=44`。
3. 在纯核心通过前，不改任何页面；之后再新增跨端适配器测试，以同一 fixture 对齐 Web、小程序和 H5。
