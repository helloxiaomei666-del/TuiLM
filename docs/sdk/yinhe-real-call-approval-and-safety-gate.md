# 银河真实接口调用审批与安全门禁设计

## 1. 当前结论

当前不建议马上运行真实 SDK。

当前允许的是：

- 静态资料研究。
- provider contract 设计。
- fake SDK 测试。
- no-real-call 安全测试。
- 私有配置模板设计。
- 真实调用审批流程设计。

当前不允许的是：

- 未审批真实登录。
- 未审批真实行情请求。
- 未审批订阅。
- 未审批下载。
- 未审批交易。
- 公开版接入真实接口。

已获得的真实接口权限只表示可以申请本地验证，不表示已获得展示、转发、缓存、二次加工或商业化授权。任何真实运行时都必须是独立、短时、只读、可审计的本地验证任务。

## 2. 场景边界

### 2.1 本地 demo 验证

本地 demo 可以在逐次审批后使用真实接口。运行范围必须限定在指定操作者、指定机器、指定时间窗、指定函数、指定标的和指定调用次数内。结果仅用于内部技术判断，不得自动进入公开产品数据源。

### 2.2 公开作品集展示

公开作品集不能暴露真实 SDK、凭证或原始响应。可以展示架构图、脱敏界面、Mock 数据和“待授权内部验证”的说明，但不得展示真实账号配置、连接信息、原始响应样例或暗示已提供真实实时行情。

### 2.3 公开试用版

公开试用版继续 Mock First。默认使用 Mock、用户自填数据或合规的延迟公开数据，不使用个人或内部 SDK 权限向真实用户提供银河行情。

### 2.4 商业化服务

商业化服务必须等券商书面授权明确后再评估。至少要确认授权主体、数据范围、展示权、转发权、缓存权、二次加工权、服务用户范围、费用、频率/额度、域名/IP/AppID 白名单、审计与合规责任。

## 3. 真实调用审批卡模板

每一次真实运行都必须有一张独立审批卡；审批卡不得保存账号、密码、token、IP、端口或证书路径。凭证只通过本地 secret store 或进程环境注入。

```yaml
task_id: "REQUIRED-UNIQUE-ID"
purpose: "单一、可验证的技术目的"
operator: "负责人批准的操作者标识"
approved_by: "负责人或指定审批人标识"
approval_time: "审批时间"
valid_time_window: "开始时间至结束时间"
allowed_mode: "mock | fake_sdk | inspect_only | real_runtime"
allowed_functions: []
allowed_symbols: []
max_call_count: 0
network_allowed: false
real_login_allowed: false
subscription_allowed: false
download_allowed: false
trading_allowed: false
credential_source: "local-secret-store-or-process-environment"
log_redaction_required: true
session_close_required: true
expected_output: "脱敏状态、内部模型或错误分类"
rollback_or_shutdown_plan: "超时、异常或越界时停止并关闭会话"
result_summary_required: true
```

默认值必须全部偏保守：

- `network_allowed` 默认为 `false`。
- `real_login_allowed` 默认为 `false`。
- `subscription_allowed` 默认为 `false`。
- `download_allowed` 默认为 `false`。
- `trading_allowed` 永远为 `false`，本路线不得通过审批卡打开。
- `allowed_functions`、`allowed_symbols` 为空时拒绝调用。
- `max_call_count` 默认为 `0`。
- `allowed_mode` 默认为 `mock` 或 `fake_sdk`，不得默认为 `real_runtime`。
- 缺少审批人、有效时间窗、日志脱敏确认或 session 关闭方案时拒绝调用。

审批卡必须能回答：谁在什么时间、出于什么目的、以什么模式、调用哪些函数、针对哪些标的、最多调用几次，以及异常时如何停止。运行结束后必须填写 `result_summary`，并记录是否完成 session close。

## 4. no-real-call 安全门禁

### 4.1 默认拒绝项

默认状态下必须禁止：

- SDK import 后自动登录。
- 真实网络连接。
- `query_snapshot`。
- `query_kline`。
- `SubscribeData.run`。
- 批量下载。
- 订阅和取消订阅以外的推送操作。
- 交易、委托、撤单或账户操作。
- 日志输出原始凭证或连接信息。

SDK import smoke test 只能检查包、版本、模块和符号存在性；import 成功不得触发 login、查询、下载、订阅或交易。

### 4.2 真实调用的合取条件

真实调用必须同时满足以下条件，任一条件不满足即 fail closed：

1. 显式启用 `real_runtime`，且该模式不能由公开前端或请求参数开启。
2. 存在完整审批卡，并且 `approved_by`、有效时间窗和 `task_id` 均有效。
3. 当前时间处于审批卡的 `valid_time_window` 内。
4. 目标函数存在于 `allowed_functions`，且不是订阅、下载或交易函数。
5. 目标标的存在于 `allowed_symbols`；空白或未识别标的直接拒绝。
6. 累计调用次数小于 `max_call_count`；并发数和重试次数也受硬限制。
7. 日志脱敏已开启，且原始响应不会写入公开目录、Git 或普通日志。
8. session close 方案已定义，异常路径也会执行清理。
9. 失败后有明确的停止、回滚或切回 Mock 方案。

### 4.3 门禁状态

| 状态 | 含义 | 允许动作 |
| --- | --- | --- |
| `mock` | 公开和默认本地模式 | Mock provider、产品联调 |
| `fake_sdk` | 无真实网络的 SDK 行为模拟 | 参数映射、模型转换、错误测试 |
| `inspect_only` | 只读资料审计模式 | 静态检查、import、符号审计 |
| `real_runtime` | 有审批卡的临时真实运行模式 | 仅审批卡列出的只读函数 |
| `blocked` | 缺少条件或发生越界 | 拒绝所有真实调用 |

任何配置缺失、审批过期、白名单不匹配、次数超限、脱敏关闭或关闭会话失败，都必须转为 `blocked`，不能静默降级为未经标记的真实调用。

## 5. provider contract 与 adapter 边界

推荐结构：

```text
公开前端 / 微信小程序 / H5
  -> quote-service
    -> provider contract
      -> mock provider
      -> fake SDK provider
      -> yinhe adapter
        -> AmazingData / tgw SDK
```

边界要求：

- 前端不得直接调用 SDK。
- 小程序不得直接调用 SDK。
- SDK 凭证不得进入前端、页面配置、请求参数或小程序包。
- SDK 原始响应不得透传给产品或前端。
- `quote-service` 只返回内部稳定模型，例如 `symbol`、`assetType`、`price`、`priceTime`、`source`、`status`、`message` 和内部 `errorCode`。
- SDK 字段名、原始枚举、DataFrame、SPI 对象和底层异常只允许存在于 adapter 内部。
- Mock 与真实来源必须通过 `source`、`status`、`priceTime` 等字段明确区分；不得让 Mock 看起来像实时真实数据。
- provider contract 应支持 fake provider 与 yinhe adapter 使用同一请求/响应形状，以便在无凭证、无网络环境中完成绝大多数测试。

## 6. 日志脱敏规则

### 6.1 禁止记录

日志、审批结果、测试报告和截图中禁止记录：

- 账号。
- 密码。
- token。
- IP。
- 端口。
- 证书路径。
- cookie。
- 原始 SDK 异常全文。
- 原始接口响应全文。

连接信息即使经过格式化，也不得以可还原形式出现在普通日志中。

### 6.2 允许记录

在确认脱敏开启后，可以记录：

- `task_id`。
- provider mode。
- 脱敏后的 symbol 或内部标的编号。
- 函数名。
- 开始时间和结束时间。
- 成功/失败状态。
- 内部错误码。
- 调用次数、重试次数和耗时区间。
- 是否完成 session close。

错误消息应转换为内部错误码，例如认证失败、权限不足、超时、限频、空结果、模式变化或 SDK 内部错误。必要时只保留 SDK 异常类型，不保留原始 message。

## 7. 函数白名单

函数白名单按阶段收紧，阶段之间不能自动升级权限。

### 阶段 0：资料与审计

- 不允许真实 SDK 调用。
- 允许静态资料阅读、接口符号审计和契约设计。

### 阶段 1：fake SDK

- 只允许 fake SDK。
- 允许成功、空结果、权限拒绝、超时、字段变化和关闭失败等 fixture 测试。
- 不允许真实网络或真实登录。

### 阶段 2：配置 preflight

- 只允许检查配置结构、默认模式、审批卡完整性、白名单和脱敏设置。
- 不允许真实登录。
- 不得通过 preflight 自动探测真实地址、凭证或服务状态。

### 阶段 3：真实 login smoke test

- 只允许真实 login + close。
- 不允许行情查询、`query_snapshot`、`query_kline`、订阅、下载、回放或交易。
- 结果只记录脱敏的会话建立/关闭状态。

### 阶段 4：单标的基础行情查询

- 只允许单标的、单次、只读基础行情查询。
- 必须在阶段 3 通过、审批卡更新、函数与标的重新白名单确认后执行。
- 不允许扩展为批量、全市场或自动重试任务。

以下能力在本路线中始终禁止：

- 订阅。
- 批量下载。
- 全市场扫描。
- 自动交易。
- 委托。
- 撤单。
- 账户资产查询。
- 持仓查询。

除非未来另立任务、重新定义风险范围并重新审批，否则不得打开上述能力。

## 8. 成功标准

本设计完成后，项目应具备：

- 明确的真实调用审批模板。
- 明确的默认拒绝策略。
- 明确的 Mock First 边界。
- 明确的 fake SDK 优先路线。
- 明确的真实调用阶段划分。
- 明确的日志脱敏要求。
- 明确的函数和标的白名单规则。
- 明确的 session close、停止和回滚要求。
- 明确的禁止事项，且不会因公开前端请求而绕过。

文档完成不表示真实 SDK 已运行，也不表示真实权限、行情权限、订阅权限或商业授权已经验证。

## 9. 下一步

下一步不是运行真实 SDK。

下一步是：

1. 设计 provider contract 扩展。
2. 实现 fake SDK provider。
3. 编写 no-real-call 安全测试。
4. 通过上述测试并完成负责人评审后，再评审是否进入真实 login smoke test。

在进入阶段 3 前，必须再次确认审批卡、私有配置隔离、日志脱敏、函数白名单、频率限制和 session 清理机制均已落地并可验证。
