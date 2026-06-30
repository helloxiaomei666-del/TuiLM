# Yinhe SDK Adapter Boundary

## 1. 文档目的

本文档定义 TuiLM 工程中 yinhe SDK adapter 的边界设计。它基于以下已完成材料：

- `sdks/yinhe/docs/sdk-package-audit.md`
- `sdks/yinhe/docs/sdk-import-smoke-test.md`
- `sdks/yinhe/docs/tgw-interface-audit.md`
- `sdks/yinhe/docs/amazingdata-interface-audit.md`

本文档只描述边界与设计约束，不实现业务代码，不执行真实登录，不请求行情，不订阅，不交易，不运行 smoke test。

## 2. 当前阶段结论

当前阶段已经确认：

- yinhe SDK 相关本地 wheel 和依赖准备流程已经建立。
- `run_import_smoke_test.ps1 -WithDependencies` 曾通过，说明隔离环境中基础 import 链路可用。
- `tgw.interface` 已完成静态符号审计。
- `AmazingData` 已完成静态 / 半静态符号审计。
- 审计阶段没有验证真实账号权限、真实行情权限、真实下载权限、真实订阅权限或交易能力。

因此 adapter 设计必须把“可 inspect 的符号能力”和“已验证可运行的业务能力”分开。

## 3. 总体边界

建议保持如下依赖方向：

```text
apps/wealth-freedom-demo
  -> quote-service or other backend service boundary
    -> yinhe adapter
      -> AmazingData / tgw SDK
```

禁止反向依赖：

```text
apps/wealth-freedom-demo
  -> AmazingData / tgw SDK
```

含义：

- `apps/wealth-freedom-demo` 不直接 import `AmazingData` 或 `tgw`。
- 前端、静态 demo、微信小程序不持有登录凭证、柜台地址、证书路径、token 或 SDK runtime 配置。
- adapter 只出现在服务端或 SDK 接入层，不泄漏到底层应用 UI。
- quote-service 或后端服务负责对外提供稳定 HTTP / service contract。
- yinhe adapter 负责把内部请求映射为 SDK 调用，并把 SDK 返回值转换为内部模型。

## 4. adapter 职责

yinhe adapter 应负责：

- 管理 SDK import 与运行环境探测。
- 封装登录前置条件，但不在静态审计阶段执行真实登录。
- 映射内部请求到 `tgw.interface` 或 `AmazingData` 的 SDK 参数。
- 把 SDK 返回结构转换为 TuiLM 内部稳定数据模型。
- 统一处理 SDK 错误、超时、权限不足、空结果和格式异常。
- 输出结构化日志，但不得记录敏感凭证。
- 将真实网络能力、缓存策略和降级策略隔离在服务端边界内。
- 为 mock / fake SDK 实现提供同一 adapter contract，便于无权限环境测试。

adapter 不应负责：

- 直接修改 `apps/wealth-freedom-demo` UI 或小程序页面。
- 在应用层散落 SDK 调用。
- 把 SDK 原始对象直接返回给前端。
- 在 Git 中保存账号、密码、token、证书、本地 runtime 文件或真实行情响应日志。
- 在静态审计任务中调用登录、行情、下载、订阅或交易接口。

## 5. 能力分层

### 5.1 SDK import 层

目标：

- 检查 `AmazingData`、`tgw` 等包是否可 import。
- 读取版本、路径、模块可见性和符号元数据。

允许：

- `import AmazingData`
- `import tgw`
- `inspect.signature`
- `pkgutil.walk_packages`
- 读取 docstring、类名、方法名、常量名

禁止：

- `Login`
- `Subscribe` / `UnSubscribe`
- `QueryKline` / `QuerySnapshot`
- `ReplayKline` / `ReplayRequest`
- `DownloadInfoData.download_*`
- `MarketData.query_*`
- 任何真实网络、行情、订阅、下载或交易调用

### 5.2 adapter contract 层

目标：

- 定义 TuiLM 内部稳定接口。
- 用 mock 数据验证参数映射、返回模型和错误模型。

候选只读接口：

| 内部能力 | 候选 SDK 映射 | 当前状态 |
| --- | --- | --- |
| 交易日历 | `AmazingData.BaseData.get_calendar` | 仅符号审计 |
| 证券列表 | `AmazingData.BaseData.get_code_list` / `get_code_info` | 仅符号审计 |
| 历史 K 线 | `AmazingData.MarketData.query_kline` 或 `tgw.interface.QueryKline` | 仅符号审计 |
| 快照行情 | `AmazingData.MarketData.query_snapshot` 或 `tgw.interface.QuerySnapshot` | 仅符号审计 |
| ETF / 基金资料 | `InfoData.get_fund_*`, `BaseData.get_etf_pcf` | 仅符号审计 |
| 财务资料 | `InfoData.get_balance_sheet`, `get_income`, `get_cash_flow` | 仅符号审计 |
| 本地批量资料 | `DownloadInfoData.download_*` | 仅符号审计，不调用 |

### 5.3 runtime SDK 层

目标：

- 在明确授权、明确凭证和明确测试窗口下验证真实 SDK 能力。

当前状态：

- 不启用。
- 不在文档补充或静态审计任务中执行。
- 后续应单独立项，配套凭证管理、网络访问、日志脱敏和回滚策略。

## 6. 数据模型边界

adapter 应对外输出 TuiLM 内部模型，而不是 SDK 原始对象。

建议核心模型方向：

| 模型 | 必要字段方向 | 说明 |
| --- | --- | --- |
| `SecurityRef` | `symbol`, `market`, `name`, `asset_type`, `currency` | 证券引用，不携带 SDK 原始枚举 |
| `QuoteSnapshot` | `symbol`, `timestamp`, `last`, `open`, `high`, `low`, `prev_close`, `volume`, `amount` | 快照行情，字段允许为空但结构稳定 |
| `KlineBar` | `symbol`, `period`, `timestamp`, `open`, `high`, `low`, `close`, `volume`, `amount` | 历史 K 线 / 分钟线 |
| `FundInfo` | `symbol`, `name`, `nav_date`, `nav`, `iopv`, `share` | 基金相关信息 |
| `FinancialStatementRef` | `symbol`, `period`, `statement_type`, `fields` | 财务报表保持宽表或字段字典 |
| `AdapterError` | `code`, `message`, `retryable`, `source`, `raw_type` | 错误统一映射 |

设计原则：

- SDK 字段名只在 adapter 内部出现。
- 前端或 quote-service consumer 只依赖内部模型。
- SDK 返回字段缺失时，adapter 负责填充 `null` 或返回结构化错误。
- 不把 pandas DataFrame、TGW SPI 对象、Pydantic SDK 对象直接透传到应用层。

## 7. 错误与权限边界

adapter 应至少区分：

- `SDK_NOT_INSTALLED`
- `SDK_IMPORT_FAILED`
- `SDK_LOGIN_REQUIRED`
- `SDK_PERMISSION_DENIED`
- `SDK_NETWORK_UNAVAILABLE`
- `SDK_TIMEOUT`
- `SDK_EMPTY_RESULT`
- `SDK_SCHEMA_CHANGED`
- `SDK_UNSUPPORTED_SYMBOL`
- `SDK_INTERNAL_ERROR`

错误处理要求：

- 不在错误消息中暴露账号、密码、token、证书路径或 host 细节。
- 可记录 SDK 原始异常类型，但 raw message 需要脱敏。
- quote-service 可以根据错误码选择降级到 mock 数据或展示“数据暂不可用”。
- 前端不应根据 SDK 原始异常分支。

## 8. 配置与凭证边界

允许的配置位置：

- 本地 `.env` 或机器级 secret store。
- 不进入 Git 的 `project.private.config.json` 类私有配置。
- CI / 部署环境的 secret 管理系统。

禁止：

- 将账号、密码、token、证书、柜台地址、真实请求样例响应写入 Git。
- 将 `.runtime`、`.venv`、`.whl`、缓存、日志提交。
- 在 `apps/wealth-freedom-demo` 内保存 SDK 私有配置。

adapter 配置应至少区分：

- SDK package availability。
- 是否允许真实登录。
- 是否允许真实行情。
- 是否允许真实下载。
- 是否允许订阅。
- 当前 provider 模式：`mock` / `inspect_only` / `paper_runtime` / `real_runtime`。

默认模式应为 `mock` 或 `inspect_only`，不能默认进入 `real_runtime`。

## 9. 测试边界

当前阶段推荐测试：

- adapter contract 单元测试。
- 参数映射测试。
- 返回模型转换测试。
- SDK import 失败时的错误映射测试。
- mock SDK / fake SDK 的行情、空结果、异常路径测试。

当前阶段禁止测试：

- 真实登录测试。
- 真实行情请求测试。
- 真实下载测试。
- 真实订阅测试。
- 真实交易测试。

后续如要做真实 SDK 验证，应新建明确任务，并在任务说明中写清：

- 凭证来源。
- 网络权限。
- 允许调用的 SDK 函数白名单。
- 日志脱敏规则。
- 是否允许产生本地数据文件。
- 如何确认不会影响真实交易或生产账户。

## 10. 与现有审计结果的关系

`tgw.interface` 审计显示了底层行情、查询、订阅、回放和工具函数的候选能力，例如：

- `Login`
- `QueryKline`
- `QuerySnapshot`
- `QuerySecuritiesInfo`
- `QueryETFInfo`
- `Subscribe`
- `ReplayKline`

这些函数在 adapter 设计中只能作为候选映射，不代表当前可直接调用。

`AmazingData` 审计显示了更高层的候选能力，例如：

- `BaseData`
- `InfoData`
- `MarketData`
- `DownloadInfoData`
- `FactorPreProcessing`
- `IcAnalysis`
- `RegressionAnalysis`
- `FactorCrowdingAnalysis`
- `PortfolioOptimizer`

其中 `MarketData.query_kline`、`MarketData.query_snapshot`、`DownloadInfoData.download_*` 具有明显真实请求或下载语义，当前阶段只记录，不调用。

## 11. 推荐推进顺序

1. 先定义 adapter contract 和内部数据模型。
2. 用 mock SDK 实现 contract，覆盖参数映射和错误模型。
3. 为 `QueryKline` / `query_kline`、`QuerySnapshot` / `query_snapshot` 建立 mock 转换样例。
4. 将 quote-service 只对接 adapter contract，不直接依赖 SDK。
5. 在独立任务中再评估真实登录和真实行情验证。
6. 真实验证通过后，再考虑是否把能力暴露给产品流程。

## 12. 当前明确不做

当前不做以下事项：

- 不改 `apps/wealth-freedom-demo`。
- 不改现有审计脚本。
- 不运行 smoke test。
- 不新增真实 SDK 调用代码。
- 不新增交易相关能力。
- 不把 provider 实验线提升为主产品依赖。
- 不承诺实时行情、历史行情、下载或订阅在当前环境可用。
