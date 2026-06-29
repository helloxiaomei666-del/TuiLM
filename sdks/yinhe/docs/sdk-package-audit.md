# Yinhe SDK Package Audit

本审计仅基于本地 wheel 包的 `METADATA`、`WHEEL`、`RECORD`、`top_level.txt`、包目录结构和少量 Python 包装层源码读取完成。未安装 wheel，未联网，未执行真实登录、真实行情请求或真实交易请求，也未将 wheel 解压到工作区。

## 1. 审计对象

| Wheel 文件 | 大小 | 推测用途 |
| --- | ---: | --- |
| `AmazingData-1.1.8-cp312-none-any.whl` | 379,176 bytes | 银河 / AmazingData 上层数据、因子分析、组合优化、绩效归因、行情查询封装包；从依赖声明看需要 `tgw>=1.0.8.7` 作为底层接口。 |
| `tgw-1.0.8.7-py3-none-any.whl` | 67,670,696 bytes | 中国银河证券 TGW Python SDK；包含 Python 包装层、Windows/Linux 多版本动态库、证书文件和行情查询/订阅接口封装。 |

## 2. 包元信息

### AmazingData

- Name: `AmazingData`
- Version: `1.1.8`
- Summary: `AmazingData`
- Author: `AmazingData`
- Requires-Python: 未声明
- Requires-Dist:
  - `pydantic>=2.6.4`
  - `numba>=0.65.0`
  - `scipy>=1.15.1`
  - `tgw>=1.0.8.7`
  - `statsmodels>=0.11.0`
- Wheel:
  - `Root-Is-Purelib: true`
  - `Tag: py3-none-any`
  - `Generator: setuptools (75.1.0)`
- Top-level modules:
  - `AmazingData`
- Entry points: 未发现 `entry_points.txt`

### tgw

- Name: `tgw`
- Version: `1.0.8.7`
- Summary: wheel 元数据中该字段存在编码异常，不能可靠解读；从包内容和主页字段推测为银河证券 TGW SDK Python 接口包。
- Home-page: `http://www.chinastock.com.cn/newsite/cgs-services/strategyTrade/geWuInstitution.html`
- Author: `China Galaxy Securities Co.,Ltd.`
- License: `chinastock_tgw_sdk_python`
- Requires-Python: 未声明
- Requires-Dist:
  - `pandas`
- Wheel:
  - `Root-Is-Purelib: true`
  - `Tag: py3-none-any`
  - `Generator: bdist_wheel (0.41.3)`
- Top-level modules:
  - `tgw`
  - `tgw\cert`
  - `tgw\common_linux_lib64`
  - `tgw\linux_py310_x64_package`
  - `tgw\linux_py311_x64_package`
  - `tgw\linux_py312_x64_package`
  - `tgw\linux_py313_x64_package`
  - `tgw\linux_py314_x64_package`
  - `tgw\linux_py36_x64_package`
  - `tgw\linux_py38_x64_package`
  - `tgw\linux_py39_x64_package`
  - `tgw\win_py310_x64_package`
  - `tgw\win_py311_x64_package`
  - `tgw\win_py312_x64_package`
  - `tgw\win_py313_x64_package`
  - `tgw\win_py314_x64_package`
  - `tgw\win_py36_x64_package`
  - `tgw\win_py38_x64_package`
  - `tgw\win_py39_x64_package`
- Entry points: 未发现 `entry_points.txt`

## 3. 目录结构摘要

### AmazingData

主要目录和关键文件：

- `AmazingData/__init__.pyc`
- `AmazingData/environment.pyc`
- `AmazingData/config/`
  - `local_data_folder.pyc`
  - `security_type_config.pyc`
- `AmazingData/login/`
  - `tgw_login.pyc`
- `AmazingData/query_api/`
  - `base_data.pyc`
  - `info_data.pyc`
  - `market_data.pyc`
- `AmazingData/subscribe_api/`
  - `on_data.pyc`
- `AmazingData/download_data/`
  - `download_info_data.pyc`
  - `info_spi.pyc`
  - `market_spi.pyc`
- `AmazingData/factor_analysis/`
  - `ic_analysis.pyc`
  - `regression_analysis.pyc`
  - `stratification_analysis.pyc`
  - `factor_preprocessing.pyc`
  - `factor_weighting.pyc`
  - `orthogonalization.pyc`
  - `factor_crowding_analysis.pyc`
  - `stock_scorer.pyc`
  - `vectorized_backtest.pyc`
- `AmazingData/portfolio_optimization/`
  - `portfolio_optimizer.pyc`
  - `factor_return_solver.pyc`
  - `covariance_adjuster.pyc`
  - `optimization_report.pyc`
  - `integration_test.pyc`
- `AmazingData/performance_attribution/`
  - `brinson_attribution.pyc`
  - `multi_factor_attribution.pyc`
  - `performance_metrics.pyc`
  - `performance_report.pyc`
  - `risk_decomposition.pyc`
- `AmazingData/operator/`
  - `base_cross_section.py`
  - `base_statistics.py`
  - `base_time_series.py`
  - `cross_section_function.pyc`
  - `statistics_function.pyc`
  - `time_series_function.pyc`
  - `math_function.pyc`
- `AmazingData/utils/`
  - `constant.pyc`
  - `convert.pyc`
  - `data_transfer.pyc`
  - `save_get_data.pyc`
  - `security_type.pyc`
- `AmazingData-1.1.8.dist-info/`
  - `METADATA`
  - `WHEEL`
  - `RECORD`
  - `top_level.txt`

结构特征：

- `RECORD` 共 66 行，其中 `.pyc` 59 个、`.py` 3 个。
- 大部分业务模块以 `.pyc` 形式分发，源码可读性有限。
- `operator/base_*.py` 是少量可读源码，主要是 `numba` 加速的截面、统计和时序计算函数。

### tgw

主要目录和关键文件：

- `tgw/__init__.py`
  - 根据操作系统、64 位环境和 Python 版本选择对应平台包。
  - 导出 `server_spi.py`、`interface.py`、`tmp_spi.py`、`error_code.py`、`base_struct.py` 中的公开符号。
  - 导入时会尝试执行证书复制逻辑 `CpCert()`，后续做 import smoke test 时需要注意该副作用。
- `tgw/interface.py`
  - 高层接口函数，包括 `Login`、`GetVersion`、`Subscribe`、`QueryKline`、`QuerySnapshot`、`QueryCodeTable`、`QuerySecuritiesInfo`、`QueryETFInfo`、`QueryFactor`、`ReplayKline`、`Close` 等。
- `tgw/base_struct.py`
  - 数据结构类，包括 `ReplayCfg`、`ReqFactorCfg`、`TGWSnapshotL2`、`TGWSnapshotL1`、`TGWTickOrder`、`TGWTickExecution`、`TGWOrderQueue`、`TGWIndexSnapshot`、`TGWKLine`、`TGWOptionSnapshot`、`TGWHKTSnapshot`、`TGWFutureSnapshot` 等。
- `tgw/server_spi.py`
  - 回调接口类，包括 `ILogSpi`、`IPushSpi`。
- `tgw/tmp_spi.py`
  - 查询和回放临时回调适配类，包括 `TmpQueryKlineSpi`、`TmpQuerySnapshotSpi`、`TmpReplaySpi` 等。
- `tgw/error_code.py`
  - `GetErrorMsg`。
- `tgw/cert_install.py`
  - 证书复制逻辑。
- `tgw/cert/.ca.crt`
- `tgw/common_linux_lib64/`
  - `.ca.crt`
  - `libaaf.so`
  - `libadk.so`
  - `libami.so`
  - `libamigrpc++.so`
  - `libamigrpc.so`
  - `libentry_wrapper.so`
  - `libfmdutil.so`
  - `libllmi.so`
  - `librmm.so`
  - `librum.so`
  - `libsample_engine.so`
  - `libtgw.so`
- `tgw/linux_py*_x64_package/`
  - `__init__.py`
  - `tgw.py`
  - `libtgw_python*.so`
- `tgw/win_py*_x64_package/`
  - `__init__.py`
  - `tgw.py`
  - `_tgw.pyd`
  - `.ca.crt`
  - `boost_random-vc140-mt-1_62.dll`
  - `boost_system-vc140-mt-1_62.dll`
  - `libcrypto-1_1-x64.dll`
  - `libssl-1_1-x64.dll`
  - `mimalloc.dll`
  - `tgw.dll`
  - `tgw.lib`
- `tgw-1.0.8.7.dist-info/`
  - `METADATA`
  - `WHEEL`
  - `RECORD`
  - `top_level.txt`

结构特征：

- `RECORD` 共 142 行，其中 `.dll` 48 个、`.py` 39 个、`.so` 20 个、`.crt` 10 个、`.lib` 8 个、`.pyd` 8 个。
- 同一个 wheel 同时包含 Windows 和 Linux 的多个 Python 版本二进制扩展。
- Windows 侧支持 Python 3.6、3.8、3.9、3.10、3.11、3.12、3.13、3.14 的 x64 包。
- Linux 侧支持 Python 3.6、3.8、3.9、3.10、3.11、3.12、3.13、3.14 的 x64 包。

## 4. 可能的 import 名称

以下仅根据 `top_level.txt`、目录结构和包装层源码推测，尚未安装验证，也未执行真实登录或请求。

### tgw

```python
import tgw

version = tgw.GetVersion()
```

```python
from tgw import Login, Close
from tgw import QueryKline, QuerySnapshot, QueryCodeTable, QuerySecuritiesInfo
from tgw import Subscribe, UnSubscribe
```

```python
from tgw.base_struct import ReplayCfg, ReqFactorCfg
from tgw.server_spi import ILogSpi, IPushSpi
```

注意：`tgw.__init__` 会根据系统和 Python 版本加载对应的动态库包装模块，并尝试复制证书文件。import smoke test 应放在本地隔离 venv 中执行，并观察是否产生本地文件副作用。

### AmazingData

```python
import AmazingData
```

```python
from AmazingData.query_api import market_data
from AmazingData.query_api import info_data
from AmazingData.login import tgw_login
from AmazingData.subscribe_api import on_data
```

```python
from AmazingData.operator import base_cross_section
from AmazingData.operator import base_statistics
from AmazingData.operator import base_time_series
```

```python
from AmazingData.factor_analysis import ic_analysis
from AmazingData.portfolio_optimization import portfolio_optimizer
from AmazingData.performance_attribution import performance_report
```

由于 `AmazingData` 多数模块是 `.pyc`，具体类名和函数名需要在安装到隔离 venv 后再做无登录、无请求的 import smoke test 和静态符号枚举。

## 5. 安装方式建议

建议只在工程根目录的本地虚拟环境中安装，不安装到全局 Python 环境：

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

两个包之间存在依赖关系：`AmazingData` 声明依赖 `tgw>=1.0.8.7`，因此建议先安装 `tgw`，再安装 `AmazingData`。

```powershell
pip install sdks/yinhe/vendor/wheels/tgw-1.0.8.7-py3-none-any.whl
pip install sdks/yinhe/vendor/wheels/AmazingData-1.1.8-cp312-none-any.whl
```

如果安装阶段仍要求完全不联网，应先准备包含全部依赖的本地 wheelhouse，然后使用 `--no-index` 和 `--find-links`：

```powershell
pip install --no-index --find-links sdks/yinhe/vendor/wheels sdks/yinhe/vendor/wheels/tgw-1.0.8.7-py3-none-any.whl
pip install --no-index --find-links sdks/yinhe/vendor/wheels sdks/yinhe/vendor/wheels/AmazingData-1.1.8-cp312-none-any.whl
```

当前 `sdks/yinhe/vendor/wheels/` 只发现 `tgw` 和 `AmazingData` 两个 wheel。若本地没有 `pandas`、`pydantic`、`numba`、`scipy`、`statsmodels` 等依赖 wheel，离线安装可能失败；不要让 `pip` 为补依赖而访问公网。

## 6. 风险与边界

- `vendor/wheels/*.whl` 是本地第三方二进制包，已被 `.gitignore` 忽略，不提交进 Git。
- 不应硬编码账号、token、cookie、证书、柜台地址、交易密码或其他敏感配置。
- 不应在 `apps/wealth-freedom-demo` 中直接调用 SDK。
- 后续应通过 `quote-service` 或独立 adapter 层间接接入，保持 demo 应用和券商 SDK 的边界。
- 真实行情权限、登录权限、交易权限需要单独验证，不能从 wheel 包存在本身推断已经具备权限。
- `tgw` 包含平台相关动态库、证书文件和导入时证书复制逻辑，import smoke test 要在隔离 venv 中执行并记录副作用。
- 本次审计没有执行 `Login`、`Subscribe`、`QueryKline`、`QuerySnapshot`、`ReplayKline` 或任何可能触发网络、登录、行情、交易的接口。

## 7. 下一步建议

1. 创建本地 venv。
2. 在不联网前提下准备完整依赖 wheelhouse，或明确允许的内网依赖源。
3. 按顺序安装 `tgw`、`AmazingData`。
4. 做 import smoke test，只验证 import 和版本/符号，不登录、不请求。
5. 识别行情 API：重点阅读 `tgw.interface` 中 `Subscribe`、`QuerySnapshot`、`QueryCodeTable`、`QuerySecuritiesInfo`、`QueryETFInfo` 等接口。
6. 识别历史行情 API：重点阅读 `QueryKline`、`ReplayKline`、`ReplayRequest`、`CancelTask` 及相关结构体。
7. 封装 provider adapter：将 SDK 调用隔离在 `sdks/yinhe` 或后续 `packages` 中的独立适配层。
8. 与 `quote-service` 设计对接边界：由 `quote-service` 面向应用提供稳定 HTTP/API 契约，adapter 只作为后端数据源实现之一。
9. 增加无网络、无凭证的测试：验证配置读取、adapter 接口形状、错误映射和 mock provider，不触发真实行情或交易。
