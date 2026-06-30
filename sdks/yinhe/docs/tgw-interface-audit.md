# TGW Interface Audit

## 1. 审计目标

本阶段只做 `tgw.interface` 的接口符号审计，目标是识别可用接口、函数签名、docstring 摘要、关键结构体和回调类，为后续 yinhe adapter 与 quote-service 边界设计提供依据。

本阶段不验证真实登录权限、行情权限、订阅权限或交易权限。

审计脚本输出：

```text
.runtime/yinhe-smoke/tgw-interface-audit.json
```

## 2. 审计边界

- 不登录。
- 不请求行情。
- 不订阅。
- 不交易。
- 不联网。
- 不修改 `apps/wealth-freedom-demo`。
- 不调用 `Login`、`Subscribe`、`UnSubscribe`、`QueryKline`、`QuerySnapshot`、`ReplayKline`、`ReplayRequest`、`Close` 等 SDK 运行时接口。
- 只在 `.runtime/yinhe-smoke/.venv` 隔离环境中 import 模块并读取符号信息。

## 3. 审计方法

通过 `inspect` 读取以下模块：

- `tgw`
- `tgw.interface`
- `tgw.base_struct`
- `tgw.server_spi`

读取内容包括：

- `tgw.interface` 的公开函数名、签名、docstring 第一行。
- `tgw.base_struct` 的公开类名、构造签名、docstring 第一行。
- `tgw.server_spi` 的公开类名和公开方法名。

执行环境：

- Python: `3.12.6`
- Platform: `Windows-11-10.0.26200-SP0`
- Machine: `AMD64`
- venv: `.runtime/yinhe-smoke/.venv`

本次审计结果：

- `tgw.interface` 公开函数数：28
- `tgw.base_struct` 公开类数：19
- `tgw.server_spi` 公开类数：2

## 4. 初步接口分类

### 连接 / 登录类

| 函数名 | 签名 | 简要说明 | 当前阶段是否调用 |
| --- | --- | --- | --- |
| `Close` | `()` | 未提供 docstring 摘要 | 不调用，仅审计 |
| `Login` | `(config, api_mode, path='')` | 功能描述: 登录接口 | 不调用，仅审计 |
| `SetThirdInfoParam` | `(task_id, key, value)` | 功能描述: 设置三方资讯查询请求接口 | 不调用，仅审计 |
| `UpdatePassWord` | `(update_password_req)` | 功能描述: 更新密码 | 不调用，仅审计 |

### 行情查询类

| 函数名 | 签名 | 简要说明 | 当前阶段是否调用 |
| --- | --- | --- | --- |
| `QueryCodeTable` | `(query_spi=None, return_df_format=True)` | 功能描述: 查询代码表 | 不调用，仅审计 |
| `QueryETFInfo` | `(req_etf_info_cfg, query_spi=None, return_df_format=True)` | 功能描述: 查询ETF信息 | 不调用，仅审计 |
| `QueryExFactorTable` | `(security_code, query_spi=None, return_df_format=True)` | 功能描述: 查询复权因子 | 不调用，仅审计 |
| `QueryFactor` | `(req_factor_cfg, query_spi=None)` | 功能描述: 查询因子, 托管机房和互联网模式适用 | 不调用，仅审计 |
| `QueryHQFactor` | `(req_factor_cfg, query_spi=None)` | 未提供 docstring 摘要 | 不调用，仅审计 |
| `QueryKline` | `(req_kline_cfg, query_spi=None, return_df_format=True)` | 功能描述: 查询k线 托管机房和互联网模式适用 | 不调用，仅审计 |
| `QueryOrderQueue` | `(req_order_queue_cfg, query_spi=None, return_df_format=True)` | 功能描述: 查询委托队列 | 不调用，仅审计 |
| `QuerySecuritiesInfo` | `(req_security_info_cfg, query_spi=None, return_df_format=True)` | 功能描述: 查询证券信息 | 不调用，仅审计 |
| `QuerySnapshot` | `(req_tick_cfg, query_spi=None, return_df_format=True)` | 功能描述: 查询快照 | 不调用，仅审计 |
| `QueryThirdInfo` | `(task_id, query_spi=None, return_df_format=True)` | 功能描述: 查询三方信息 | 不调用，仅审计 |
| `QueryTickExecution` | `(req_tick_exec_cfg, query_spi=None, return_df_format=True)` | 功能描述: 查询逐笔成交 | 不调用，仅审计 |
| `QueryTickOrder` | `(req_tick_order_cfg, query_spi=None, return_df_format=True)` | 功能描述: 查询逐笔委托 | 不调用，仅审计 |

### 订阅类

| 函数名 | 签名 | 简要说明 | 当前阶段是否调用 |
| --- | --- | --- | --- |
| `SubFactor` | `(sub_factor_item, push_spi=None)` | 功能描述: 因子订阅接口 | 不调用，仅审计 |
| `Subscribe` | `(sub_item, push_spi=None)` | 功能描述: 订阅接口 | 不调用，仅审计 |
| `SubscribeDerivedData` | `(subscribe_type, derived_data_type, derived_data_sub_item, push_spi=None)` | 功能描述: 订阅衍生数据 | 不调用，仅审计 |
| `UnSubFactor` | `(sub_factor_item, push_spi=None)` | 功能描述: 取消订阅因子 | 不调用，仅审计 |
| `UnSubscribe` | `(sub_item, push_spi=None)` | 功能描述: 取消订阅 | 不调用，仅审计 |

### 回放类

| 函数名 | 签名 | 简要说明 | 当前阶段是否调用 |
| --- | --- | --- | --- |
| `CancelTask` | `(task_id)` | 功能描述: 取消回放任务, 仅托管机房 | 不调用，仅审计 |
| `ReplayKline` | `(replay_cfg, replay_spi, return_df_format=True)` | 功能描述: k线回放。异步接口。 | 不调用，仅审计 |
| `ReplayRequest` | `(replay_cfg, replay_spi, return_df_format=True)` | 功能描述: 行情回放。异步接口。 | 不调用，仅审计 |

### 版本 / 工具类

| 函数名 | 签名 | 简要说明 | 当前阶段是否调用 |
| --- | --- | --- | --- |
| `GetTaskID` | `()` | 功能描述: 获取task id | 不调用，仅审计 |
| `GetVersion` | `()` | 功能描述: 获取api版本信息 | 不调用，仅审计 |
| `SetLogSpi` | `(log_spi)` | 功能描述: 设置 | 不调用，仅审计 |

### 其他 / 未分类

| 函数名 | 签名 | 简要说明 | 当前阶段是否调用 |
| --- | --- | --- | --- |
| `json_normalize` | `(data, record_path=None, meta=None, meta_prefix=None, record_prefix=None, errors='raise', sep='.', max_level=None)` | Normalize semi-structured JSON data into a flat table. | 不调用，仅审计 |

`json_normalize` 看起来来自 pandas 工具函数，不是 TGW 业务接口；后续 adapter 设计不应依赖它作为 SDK 能力边界。

## 5. 关键结构体

`tgw.base_struct` 中审计到的公开类如下。

| 类名 | 构造签名 | 说明 |
| --- | --- | --- |
| `ReplayCfg` | `(self) -> None` | 回放配置结构体，可能用于 `ReplayKline` / `ReplayRequest`。 |
| `ReqFactorCfg` | `(self) -> None` | 因子查询配置结构体，可能用于 `QueryFactor` / `QueryHQFactor`。 |
| `TGWSnapshotL2` | `(self, data=None, index=None)` | L2 快照结构体，包含 `covert` 方法。 |
| `TGWSnapshotL1` | `(self, data=None, index=None)` | L1 快照结构体，包含 `covert` 方法。 |
| `TGWKLine` | `(self, data=None, index=None)` | K 线结果结构体，包含 `covert` 方法。 |
| `TGWOrderQueue` | `(self, data=None, index=None)` | 委托队列结构体，包含 `covert` 方法。 |
| `TGWTickExecution` | `(self, data=None, index=None)` | 逐笔成交结构体，包含 `covert` 方法。 |
| `TGWTickOrder` | `(self, data=None, index=None)` | 逐笔委托结构体，包含 `covert` 方法。 |
| `TGWIndexSnapshot` | `(self, data=None, index=None)` | 指数快照结构体，包含 `covert` 方法。 |
| `TGWOptionSnapshot` | `(self, data=None, index=None)` | 期权快照结构体，包含 `covert` 方法。 |
| `TGWFutureSnapshot` | `(self, data=None, index=None)` | 期货快照结构体，包含 `covert` 方法。 |
| `TGWHKTSnapshot` | `(self, data=None, index=None)` | 港股通快照结构体，包含 `covert` 方法。 |
| `TGWHKTRealtimeLimit` | `(self, data=None, index=None)` | 港股通实时额度结构体，包含 `covert` 方法。 |
| `TGWHKTProductStatus` | `(self, data=None, index=None)` | 港股通产品状态结构体，包含 `covert` 方法。 |
| `TGWHKTVCM` | `(self, data=None, index=None)` | 港股通 VCM 结构体，包含 `covert` 方法。 |
| `TGWAfterHourFixedPriceSnapshot` | `(self, data=None, index=None)` | 盘后定价快照结构体，包含 `covert` 方法。 |
| `TGWCSIIndexSnapshot` | `(self, data=None, index=None)` | 中证指数快照结构体，包含 `covert` 方法。 |
| `TGWCnIndexSnapshot` | `(self, data=None, index=None)` | 国内指数快照结构体，包含 `covert` 方法。 |
| `TGWBaseClass` | `(self, /, *args, **kwargs)` | 基础类。 |

初步判断：

- `QuerySnapshot` 相关 adapter 需要重点关注 `TGWSnapshotL1`、`TGWSnapshotL2`、`TGWIndexSnapshot`、`TGWOptionSnapshot`、`TGWFutureSnapshot` 等结构体。
- `QueryKline` / `ReplayKline` 相关 adapter 需要重点关注 `TGWKLine`。
- `QueryTickExecution` / `QueryTickOrder` 相关 adapter 需要重点关注 `TGWTickExecution`、`TGWTickOrder`。
- 回放接口需要重点关注 `ReplayCfg`。

## 6. 回调接口

`tgw.server_spi` 中审计到两个主要回调类。

### `ILogSpi`

构造签名：

```python
ILogSpi(self) -> None
```

公开方法：

- `OnEvent`
- `OnIndicator`
- `OnLog`
- `OnLogon`

用途判断：

- 可能用于登录、连接、日志和状态事件回调。
- 当前阶段不实例化、不注册、不调用，仅审计。

### `IPushSpi`

构造签名：

```python
IPushSpi(self, return_df_format=True) -> None
```

公开方法：

- `OnFactor`
- `OnKLine`
- `OnMDAfterHourFixedPriceSnapshot`
- `OnMDCSIIndexSnapshot`
- `OnMDCnIndexSnapshot`
- `OnMDFutureSnapshot`
- `OnMDHKTProductStatus`
- `OnMDHKTRealtimeLimit`
- `OnMDHKTSnapshot`
- `OnMDHKTVCM`
- `OnMDIndexSnapshot`
- `OnMDOptionSnapshot`
- `OnMDOrderBook`
- `OnMDOrderBookSnapshot`
- `OnMDOrderQueue`
- `OnMDSnapshot`
- `OnMDTickExecution`
- `OnMDTickOrder`
- `OnSnapshotDerive`
- `SetDfFormat`

用途判断：

- 可能用于订阅推送、快照推送、K 线推送、逐笔推送和衍生数据推送。
- 后续如设计订阅 adapter，需要单独 mock 回调类行为。
- 当前阶段不实例化、不注册、不调用，仅审计。

## 7. 对 quote-service 的启示

后续不应让 `apps/wealth-freedom-demo` 直接调用 TGW SDK。建议保持如下边界：

```text
apps/wealth-freedom-demo
  -> quote-service
    -> yinhe adapter
      -> tgw SDK
```

设计含义：

- `apps/wealth-freedom-demo` 只依赖 quote-service 的稳定 HTTP/API 契约。
- `quote-service` 负责应用侧数据模型、缓存、错误映射和降级策略。
- `yinhe adapter` 负责把 quote-service 的内部请求转换为 TGW SDK 配置结构体和调用。
- `tgw SDK` 只出现在 adapter 层，不直接泄漏到前端、静态 demo 或小程序代码。
- 登录凭证、token、证书路径、柜台地址等敏感配置不进入应用层和 Git。

潜在接口映射方向：

- 实时快照：`quote-service` -> `yinhe adapter` -> `QuerySnapshot`
- K 线 / 历史行情：`quote-service` -> `yinhe adapter` -> `QueryKline`
- 证券基础信息：`quote-service` -> `yinhe adapter` -> `QuerySecuritiesInfo`
- ETF 信息：`quote-service` -> `yinhe adapter` -> `QueryETFInfo`
- 订阅推送：后续单独设计，不应混入当前 import / symbol audit 阶段。

## 8. 下一步建议

1. 继续审计 `AmazingData` 的 `query_api`。
2. 设计 yinhe adapter 接口草案，先覆盖 `QuerySnapshot`、`QueryKline`、`QuerySecuritiesInfo` 等只读行情能力。
3. 为 `QuerySnapshot`、`QueryKline` 等接口设计 mock 测试，先验证参数映射、返回结构转换和错误映射。
4. 真实登录 / 真实行情权限验证单独立项，不能混入当前阶段。
