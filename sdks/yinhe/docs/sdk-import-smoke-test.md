# Yinhe SDK Import Smoke Test

## 1. 测试目标

本阶段目标是在本地隔离环境中验证 `sdks/yinhe/vendor/wheels/` 下的 yinhe SDK wheel 是否具备最低限度的 Python import 可用性。

测试范围包括：

- 创建工程内本地 venv：`.runtime/yinhe-smoke/.venv`
- 使用本地 wheel 安装 `tgw`
- 使用本地 wheel 安装 `AmazingData`
- 读取两个包的已安装元信息
- 执行 `import tgw`
- 执行 `import AmazingData`
- 检查 `tgw` 中关键符号是否存在
- 列出 `AmazingData` 顶层公开属性数量和部分属性名

## 2. 测试边界

本 smoke test 只做安全的本地检查：

- 不联网
- 不安装到全局 Python 环境
- 不升级 pip
- 不执行真实登录
- 不执行真实行情请求
- 不执行真实订阅
- 不执行真实交易请求
- 不调用 `Login`、`QueryKline`、`QuerySnapshot`、`Subscribe`、`Close` 等 SDK 函数
- 不把 `.venv`、wheel 解压产物、缓存、日志提交进 Git

所有临时环境和输出均放在 `.runtime/yinhe-smoke/` 下。该目录已由根目录 `.gitignore` 的 `.runtime/` 规则忽略。

## 3. 执行方式

在工程根目录执行：

```powershell
.\sdks\yinhe\scripts\run_import_smoke_test.ps1
```

脚本会执行以下步骤：

```powershell
python -m venv .runtime/yinhe-smoke/.venv
.runtime\yinhe-smoke\.venv\Scripts\Activate.ps1
python -m pip install --no-index --no-deps sdks/yinhe/vendor/wheels/tgw-1.0.8.7-py3-none-any.whl
python -m pip install --no-index --no-deps sdks/yinhe/vendor/wheels/AmazingData-1.1.8-cp312-none-any.whl
python sdks/yinhe/scripts/import_smoke_test.py
```

输出会同时写入：

```text
.runtime/yinhe-smoke/import-smoke-output.txt
```

## 4. 预期输出

预期输出应包含：

- Python executable
- Python version
- Platform
- Machine
- Current working directory
- `tgw` distribution metadata
- `AmazingData` distribution metadata
- `import tgw` 的 PASS / FAIL
- `import AmazingData` 的 PASS / WARN
- `tgw` 关键符号存在性：
  - `GetVersion`
  - `Login`
  - `Close`
  - `QueryKline`
  - `QuerySnapshot`
  - `Subscribe`
- `AmazingData` 顶层公开属性数量和部分属性名
- 最终 exit code

## 5. PASS / WARN / FAIL 判定标准

### PASS

- `tgw` 能够 import。
- `tgw` 关键符号通过 `hasattr` 检查存在。
- 脚本最终退出码为 `0`。

### WARN

- `AmazingData` 因缺少 `pydantic`、`numba`、`scipy`、`statsmodels` 或其传递依赖而 import 失败。
- `AmazingData` import 失败不直接视为致命失败，只要 `tgw` 能 import，脚本退出码仍为 `0`。
- 某些 `tgw` 符号缺失时标记 WARN，需要进入接口符号审计阶段确认。
- 在 `--no-deps` 环境中，如果未预置 `pandas`，`tgw` 也可能因缺少 `pandas` 而 import 失败；此时应补充本地 wheelhouse 后重跑。

### FAIL

- `tgw` 和 `AmazingData` 都无法 import。
- 脚本最终退出码为 `1`。
- 本地 wheel 文件缺失。
- venv 创建、离线安装或脚本执行失败。

## 6. 注意事项

- `tgw.__init__` 可能有证书复制副作用；本测试必须在 `.runtime/yinhe-smoke/.venv` 隔离环境中运行，并观察输出和 runtime 目录变化。
- `tgw` 声明依赖 `pandas`；本阶段使用 `--no-deps`，如果本地 venv 中没有 `pandas`，`import tgw` 可能失败。
- `AmazingData` 可能因为 `pydantic`、`numba`、`scipy`、`statsmodels` 未安装而 import 失败。本阶段使用 `--no-deps`，不会联网补依赖。
- 本阶段只验证 import 和符号存在，不验证行情权限、登录权限、订阅权限或交易权限。
- 不要将 `.runtime/yinhe-smoke/`、`.venv`、pip 缓存、日志或 wheel 解压产物提交进 Git。
- 不要在 `apps/wealth-freedom-demo` 中直接调用 SDK。

## 7. 下一步

1. 如果 import 通过，再做接口符号审计，整理 `tgw.interface`、`tgw.base_struct` 和 `AmazingData.query_api` 的可用 API。
2. 如果缺依赖，再单独建立本地 wheelhouse 方案，补齐 `pandas`、`pydantic`、`numba`、`scipy`、`statsmodels` 等依赖 wheel。
3. 不要直接进入真实行情对接。
4. 在完成接口符号审计后，再设计独立 provider adapter。
5. 通过 `quote-service` 或 adapter 层定义应用侧边界，避免 SDK 代码混入 `apps/wealth-freedom-demo`。
