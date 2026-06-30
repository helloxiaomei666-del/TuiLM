# AmazingData Interface Audit

## 1. 审计目标

本阶段只做 `AmazingData` SDK 的静态 / 半静态符号审计，目标是识别可 import 模块、公开函数、公开类、类公开方法、签名、docstring 第一行，以及潜在的查询、行情、下载、因子、组合优化、绩效和归因相关 API。

审计脚本：

```text
sdks/yinhe/scripts/audit_amazingdata_interface.py
```

审计 JSON 输出：

```text
.runtime/yinhe-smoke/amazingdata-interface-audit.json
```

## 2. 审计边界

- 不执行真实登录。
- 不执行真实行情请求。
- 不执行真实订阅。
- 不执行真实交易请求。
- 不执行真实下载请求。
- 不联网。
- 不修改 `apps/wealth-freedom-demo`。
- 不提交 Git。
- 不反编译 `.pyc`。
- 仅允许 `import AmazingData`、枚举模块、读取签名、docstring、常量、类名、方法名。

脚本在 import 审计期间临时阻断常见网络出口：

- `socket.socket.connect`
- `socket.create_connection`
- 如已安装 `requests`，阻断 `requests.sessions.Session.request`

这只能降低 import side effect 风险，不能证明 SDK 在真实业务调用时不会联网。本次结论只代表静态 / 半静态符号层面。

## 3. 执行环境

本次使用既有隔离环境：

```text
.runtime/yinhe-smoke/.venv
```

环境信息来自审计 JSON：

| 项 | 值 |
| --- | --- |
| Python executable | `.runtime/yinhe-smoke/.venv/Scripts/python.exe` |
| Python version | `3.12.6` |
| Platform | `Windows-11-10.0.26200-SP0` |
| Machine | `AMD64` |
| Package entry | `.runtime/yinhe-smoke/.venv/Lib/site-packages/AmazingData/__init__.pyc` |

运行命令：

```powershell
& '.runtime\yinhe-smoke\.venv\Scripts\python.exe' 'sdks\yinhe\scripts\audit_amazingdata_interface.py'
```

## 4. 总体结果

| 指标 | 数量 |
| --- | ---: |
| 发现模块 | 55 |
| 成功 import 模块 | 52 |
| import 失败模块 | 3 |
| `.pyc` 模块文件 | 49 |
| `.py` 模块文件 | 3 |

import 失败模块：

| 模块 | 失败原因 |
| --- | --- |
| `AmazingData.operator.generate_doc` | `ModuleNotFoundError: No module named 'docx'` |
| `AmazingData.performance_attribution` | `ModuleNotFoundError: No module named 'AmazingData.performance_attribution.barra_attribution'` |
| `AmazingData.portfolio_optimization.integration_test` | `FileNotFoundError: .../AmazingData/portfolio_optimization/optimization_constant.py` |

说明：

- `generate_doc` 依赖 `python-docx`，当前 venv 未安装。
- `performance_attribution` 包入口引用缺失的 `barra_attribution`，因此未能继续展开归因模块符号。
- `portfolio_optimization.integration_test` 访问缺失的 `optimization_constant.py` 源文件；当前包内可见的是 `.pyc` 形式的 `optimization_constant`。

## 5. 模块分类摘要

分类为脚本基于模块名、符号名、docstring 第一行做的启发式判断，不等同于已验证的运行能力。

| 分类 | 模块数 | 函数数 | 类数 | 说明 |
| --- | ---: | ---: | ---: | --- |
| 查询 / query | 8 | 48 | 80 | `query_api`、基础数据、信息数据、证券类型、HDF5/PKL 读取等 |
| 行情 / market data | 1 | 11 | 21 | K 线、快照、tick 转换、行情 SPI / Env 类 |
| 下载 / download | 3 | 3 | 137 | `download_data`、批量资料下载类和大量 SPI / Env 类 |
| 因子 / factor | 17 | 2 | 100 | 因子预处理、IC、回归、分层回测、拥挤度、多因子合成、风险模型部分组件 |
| 组合优化 / portfolio | 6 | 4 | 50 | 组合优化器、优化常量、报告、风险模型工具 |
| 绩效 / performance | 1 | 0 | 0 | `performance_attribution` 包入口存在但 import 失败，未展开有效符号 |
| 归因 / attribution | 0 | 0 | 0 | 当前未审计到可 import 的归因符号 |
| 工具 / utils | 10 | 33 | 16 | 配置、登录封装、格式转换、数据转置、常量等 |
| 其他 / 未分类 | 9 | 1 | 37 | 包入口、环境类、operator 部分模块、subscribe_api 包入口等 |

## 6. 查询与行情相关 API

### `AmazingData.query_api.base_data`

可见函数：

- `login(username, password, host, port, api_mode='kInternetMode', kColocationMode_para=None)`
- `get_market(_type: str) -> str`
- `get_code(_type: str, _code: str) -> str`
- `get_tgw_type_code(_code: str)`
- `get_data_from_hdf5(path, data_name)`
- `get_data_from_pkl(path, data_name)`
- `save_data_to_hdf5(path, data_name, input_data, is_append=False)`
- `date_to_datetime(date='20090101')`
- `datetime_to_int(date=...)`
- `is_security_type(stock_code, security_type)`
- `is_time_interval(start_time='084500000000', end_time='235959999999')`

关键类：

| 类 | 构造签名 | 公开方法 |
| --- | --- | --- |
| `BaseData` | `(self)` | `get_calendar`, `get_code_info`, `get_code_list`, `get_future_code_info`, `get_future_code_list`, `get_option_code_list`, `get_hist_code_list`, `get_adj_factor`, `get_backward_factor`, `get_etf_pcf` |

判断：

- `login` 是明确的登录入口，当前阶段只记录签名，不调用。
- `BaseData` 可能覆盖日历、代码表、期货 / 期权基础信息、复权因子、ETF PCF 等查询能力。

### `AmazingData.query_api.info_data`

关键类：

| 类 | 构造签名 | 公开方法方向 |
| --- | --- | --- |
| `InfoData` | `(self)` | 财务报表、股本结构、基金、指数成分、行业、两融、龙虎榜、期权、可转债、国债收益率等查询 |

`InfoData` 可见方法包括：

- 财务：`get_balance_sheet`, `get_income`, `get_cash_flow`
- 权益与股东：`get_equity_structure`, `get_share_holder`, `get_holder_num`
- 基金：`get_fund_iopv`, `get_fund_nav`, `get_fund_share`
- 指数 / 行业：`get_index_constituent`, `get_index_weight`, `get_industry_base_info`, `get_industry_constituent`, `get_industry_daily`, `get_industry_weight`
- 交易辅助信息：`get_margin_detail`, `get_margin_summary`, `get_long_hu_bang`, `get_block_trading`
- 期权 / 可转债：`get_option_basic_info`, `get_option_mon_ctr_specs`, `get_option_std_ctr_specs`, `get_kzz_*`

### `AmazingData.query_api.market_data`

可见函数：

- `login(username, password, host, port, api_mode='kInternetMode', kColocationMode_para=None)`
- `convert_history_kline(code, period, kline_df)`
- `convert_history_tick_stock(code, snapshot_df)`
- `convert_history_tick_stock_HKT(code, snapshot_df)`
- `convert_history_tick_index(code, snapshot_df)`
- `convert_history_tick_future(code, snapshot_df)`
- `convert_history_tick_option(code, snapshot_df)`
- `get_code(_type: str, _code: str) -> str`
- `get_tgw_type_code(_code: str)`
- `is_security_type(stock_code, security_type)`

关键类：

| 类 | 构造签名 | 公开方法 / 说明 |
| --- | --- | --- |
| `MarketData` | `(self, calendar)` | `query_kline`, `query_snapshot` |
| `KlineSpi` | `(self, req)` | docstring: 查询 K 线 SPI，同步查询回调中可取入参 |
| `SnapshotSpi` | `(self, req)` | docstring: 查询快照 SPI，同步查询回调中可取入参 |
| `EnvKline` | `(self, /, *args, **kwargs)` | 环境 / 上下文类，含公开方法 |
| `EnvSnapshot` | `(self, /, *args, **kwargs)` | 环境 / 上下文类，含公开方法 |

判断：

- `MarketData.query_kline` 和 `MarketData.query_snapshot` 是最明显的历史行情 / 快照查询候选入口。
- `KlineSpi` / `SnapshotSpi` 暗示底层仍依赖 TGW 同步查询回调模式。
- `login` 仍存在于行情模块中，当前阶段禁止调用。

## 7. 下载相关 API

### `AmazingData.download_data.download_info_data`

关键类：

| 类 | 构造签名 | 方法数 |
| --- | --- | ---: |
| `DownloadInfoData` | `(self, local_path)` | 46 |

`DownloadInfoData` 可见下载方法包括：

- 基础资料：`download_stock_basic`, `download_hist_code_list`, `download_hist_stock_status`
- 复权和行情辅助：`download_adj_factor`, `download_backward_factor`
- 财务：`download_balance_sheet`, `download_income`, `download_cash_flow`
- 基金：`download_fund_iopv`, `download_fund_nav`, `download_fund_share`
- 指数 / 行业：`download_index_constituent`, `download_index_weight`, `download_industry_base_info`, `download_industry_constituent`, `download_industry_daily`, `download_industry_weight`
- 两融和交易披露：`download_margin_detail`, `download_margin_summary`, `download_longhubang`, `download_block_trading`
- 期权 / 可转债：`download_option_basic_info`, `download_option_mon_ctr_specs_change`, `download_option_std_ctr_specs`, `download_kzz_*`
- 其他：`download_treasury_yield`, `download_share_holder`, `download_holder_num`, `download_profit_notice`, `download_profit_express`

风险边界：

- `DownloadInfoData` 的方法名均显示为真实下载入口，本次没有实例化或调用。
- 文档中只能把它们记为“潜在可用下载 API”，不能视为权限或网络可用性已验证。

## 8. 因子分析相关 API

关键类：

| 类 | 构造签名 | 公开方法 |
| --- | --- | --- |
| `FactorPreProcessing` | `(self, raw_data: pandas.DataFrame)` | `data_filter`, `extreme_processing`, `fill_nan_processing`, `neutralize_processing`, `scale_processing`, `run_pipeline`, `save`, `save_csv` |
| `IcAnalysis` | `(self, factor: pandas.DataFrame, factor_name: str, market_close_data: pandas.DataFrame, ic_decay: int = 20)` | `cal_ic_df`, `cal_ic_indicator`, `save` |
| `RegressionAnalysis` | `(self, factor: pandas.DataFrame, factor_name: str, market_close_data: pandas.DataFrame, benchmark_df: Optional[pandas.DataFrame] = None)` | `cal_acf`, `cal_factor_return`, `cal_net_analysis`, `cal_t_value_statistics`, `save` |
| `FactorCrowdingAnalysis` | `(self, factor: pandas.DataFrame, close_price: pandas.DataFrame, market_cap: Optional[pandas.DataFrame] = None, group_num: int = 5, ascending: bool = False)` | `calc_all`, `calc_composite_crowding`, `calc_factor_volatility`, `calc_pairwise_correlation`, `calc_return_reversal`, `calc_valuation_spread`, `crowding_summary`, `get_crowding_level` |
| `StockScorer` | `(self, factor_data: Dict[str, pandas.DataFrame])` | `score`, `select_top`, `get_selected_scores` |

可见枚举 / 常量类方向：

- `ExtremeMethod`
- `FillNanMethod`
- `NeutralizeMethod`
- `ScaleMethod`
- `GroupMethod`
- `OrthogonalMethod`

判断：

- 因子分析模块的 docstring 较完整，显示出预处理、IC、回归、分层、拥挤度、打分等完整链路。
- 这些类多以 `pandas.DataFrame` 为输入，偏离真实行情网络调用，更适合后续做离线单元测试。

## 9. 组合优化、风险和绩效相关 API

### 组合优化

关键类：

| 类 | 构造签名 | 公开方法 |
| --- | --- | --- |
| `PortfolioOptimizer` | `(self, alpha, risk_cov, specific_risk, factor_loadings, stock_list=None, style_loadings=None, industry_loadings=None)` | `optimize`, `summary` |
| `CovarianceAdjuster` | `(self, factor_return: pandas.DataFrame, freq_scale: float = 1.0)` | `cal_newey_west`, `cal_eigen_adjustment`, `cal_vol_regime_adjustment`, `cal_ewma_cov`, `bias_statistic`, `run_pipeline`, `summary` |
| `SpecificRiskAdjuster` | `(self, specific_return: pandas.DataFrame, factor_loadings: Dict[str, pandas.DataFrame], market_value: pandas.DataFrame, freq_scale: float = 1.0)` | `cal_bayesian_shrinkage`, `cal_newey_west`, `cal_structural_adjustment`, `cal_vol_regime_adjustment`, `run_pipeline`, `summary` |
| `FactorReturnSolver` | `(self, stock_return, factor_loadings, market_value, industry_dummies=None, use_country_factor=True)` | `cal_factor_return`, `cal_specific_return`, `summary` |

可见优化常量 / 枚举方向：

- `ConstraintType`
- `OptimizeObjective`
- `RiskModel`
- `SolverMethod`
- `CovAdjustMethod`
- `SpecificRiskAdjustMethod`
- `FactorReturnMethod`

### 绩效

`NetValueAnalyzer` 在 `AmazingData.factor_analysis.regression_analysis` 中可见：

| 类 | 构造签名 | 公开方法 |
| --- | --- | --- |
| `NetValueAnalyzer` | `(self, net_value: pandas.Series, benchmark: Optional[pandas.Series] = None)` | `analyze` |

判断：

- 当前可 inspect 的绩效能力主要表现为净值分析器和回归分析内的净值分析方法。
- `AmazingData.performance_attribution` 包入口 import 失败，未能确认归因 / Barra 相关 API。

## 10. 订阅与转换相关 API

`AmazingData.subscribe_api.on_data` 可成功 import，公开函数以实时数据转换为主，包括：

- `convert_realtime_kline(tgw_data, period)`
- `convert_realtime_snapshotL2(tgw_data)`
- `convert_realtime_snapshotHKT(tgw_data)`
- `convert_realtime_tick_index(tgw_data)`

判断：

- 当前只审计到实时数据结构转换函数和 Pydantic 风格数据类。
- 没有调用订阅入口，也没有触发推送注册。
- 若后续要审计真实订阅能力，应单独建任务并使用 mock SPI，不应混入本次静态符号审计。

## 11. 对后续 adapter 设计的启示

建议保持边界：

```text
apps/wealth-freedom-demo
  -> quote-service
    -> yinhe adapter
      -> AmazingData / TGW SDK
```

潜在映射方向：

- 基础数据：`BaseData.get_calendar`, `BaseData.get_code_list`, `BaseData.get_code_info`
- 历史行情：`MarketData.query_kline`
- 快照行情：`MarketData.query_snapshot`
- 财务 / 资料：`InfoData.get_balance_sheet`, `InfoData.get_income`, `InfoData.get_cash_flow`, `InfoData.get_stock_basic`
- 本地批量资料：`DownloadInfoData.download_*`
- 因子离线分析：`FactorPreProcessing`, `IcAnalysis`, `RegressionAnalysis`, `FactorCrowdingAnalysis`
- 组合优化离线分析：`PortfolioOptimizer`, `FactorReturnSolver`, `CovarianceAdjuster`, `SpecificRiskAdjuster`

当前阶段不应让 `apps/wealth-freedom-demo` 直接依赖 `AmazingData`。后续如要接入，也应由 adapter 隔离登录凭证、网络调用、缓存、错误映射和降级策略。

## 12. 下一步建议

1. 不做真实登录前，先基于 JSON 结果设计 adapter 的只读接口草案。
2. 为 `MarketData.query_kline` / `MarketData.query_snapshot` 设计 mock 测试，验证参数映射和返回模型转换。
3. 对因子与组合优化类优先做离线样例数据测试，因为它们的构造签名显示主要依赖 `pandas` / `numpy` 数据。
4. 若需要归因能力，先补齐或定位 `AmazingData.performance_attribution.barra_attribution`，但仍只做 import / inspect 审计。
5. 真实登录、行情权限、下载权限、订阅权限验证应作为单独任务处理，不能和本次静态审计混在一起。
