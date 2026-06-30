# Yinhe Local Wheelhouse Plan

## 1. 背景

当前 yinhe SDK wheel 已在本地保存：

- `sdks/yinhe/vendor/wheels/tgw-1.0.8.7-py3-none-any.whl`
- `sdks/yinhe/vendor/wheels/AmazingData-1.1.8-cp312-none-any.whl`

但第三方依赖包尚未完整准备。当前 import smoke test 采用 `--no-index --no-deps` 安装策略，明确不联网、不自动补依赖，因此离线安装后 `import tgw` 失败，直接原因是缺少 `pandas`；`AmazingData` 依赖 `tgw` 和其他科学计算包，也无法继续 import。

后续需要在不污染全局 Python、不自动联网的前提下，补齐 SDK 运行所需的第三方依赖 wheel，并继续保持所有二进制依赖不进入 Git。

## 2. 当前已知依赖

根据 `sdks/yinhe/docs/sdk-package-audit.md`，当前已知的一层依赖如下。

### tgw

- `pandas`

### AmazingData

- `pydantic>=2.6.4`
- `numba>=0.65.0`
- `scipy>=1.15.1`
- `tgw>=1.0.8.7`
- `statsmodels>=0.11.0`

这些依赖还会引入二级或更多传递依赖，例如：

- `numpy`
- `python-dateutil`
- `pytz`
- `tzdata`
- `llvmlite`
- `packaging`
- `patsy`
- `typing-extensions`
- `annotated-types`
- `pydantic-core`

以上列表不要求穷尽。正式准备本地依赖时，应使用 `pip download` 或 `pip wheel` 生成完整依赖闭包，并在隔离环境中验证该 wheelhouse 是否能满足离线安装。

## 3. 推荐目录结构

```text
sdks/yinhe/vendor/wheels/
  AmazingData-1.1.8-cp312-none-any.whl
  tgw-1.0.8.7-py3-none-any.whl

sdks/yinhe/vendor/wheelhouse/
  pandas-...
  numpy-...
  pydantic-...
  numba-...
  scipy-...
  statsmodels-...
  ...
```

目录职责：

- `vendor/wheels/` 存放券商 SDK 原始 wheel。
- `vendor/wheelhouse/` 存放第三方依赖 wheel。
- 两个目录都应继续被 `.gitignore` 忽略。
- Git 只提交 README、docs、scripts，不提交 `.whl` 等二进制包。

建议后续补充 `.gitignore`：

```gitignore
sdks/yinhe/vendor/wheelhouse/*.whl
```

## 4. wheelhouse 获取方案

以下是推荐命令，仅作为方案记录，本阶段不执行：

```powershell
python -m venv .runtime/yinhe-wheelhouse/.venv
.runtime\yinhe-wheelhouse\.venv\Scripts\Activate.ps1
python -m pip download -d sdks/yinhe/vendor/wheelhouse pandas pydantic numba scipy statsmodels
```

执行原则：

- 如果允许联网，只在 `.runtime/yinhe-wheelhouse/.venv` 这个临时 venv 中下载，不使用全局 Python 环境。
- 如果不允许联网，应在另一台可联网且平台匹配的机器下载完整 wheelhouse 后，再拷贝到 `sdks/yinhe/vendor/wheelhouse/`。
- 下载时要匹配当前 Python 版本、操作系统和 CPU 架构。
- 当前本机 import smoke test 使用 Python 3.12，Windows AMD64，因此优先准备 `cp312` / `win_amd64` 兼容 wheel。
- 对纯 Python wheel，也要确认其 `Requires-Python` 与 Python 3.12 兼容。
- 下载完成后，应记录下载机器、Python 版本、平台、下载命令和生成时间，便于后续追踪依赖来源。

如果需要提前构建 wheel，可使用类似命令：

```powershell
python -m pip wheel -w sdks/yinhe/vendor/wheelhouse pandas pydantic numba scipy statsmodels
```

但 `scipy`、`numba`、`pandas` 等包通常应优先使用官方或可信源提供的预构建 wheel，避免在本地临时编译导致环境不可复现。

## 5. 离线安装方案

以下是推荐安装顺序，仅作为方案记录，本阶段不执行。

基础方案：

```powershell
python -m pip install --no-index --find-links sdks/yinhe/vendor/wheelhouse --no-deps sdks/yinhe/vendor/wheels/tgw-1.0.8.7-py3-none-any.whl
python -m pip install --no-index --find-links sdks/yinhe/vendor/wheelhouse pandas

python -m pip install --no-index --find-links sdks/yinhe/vendor/wheelhouse pydantic numba scipy statsmodels
python -m pip install --no-index --find-links sdks/yinhe/vendor/wheelhouse --no-deps sdks/yinhe/vendor/wheels/AmazingData-1.1.8-cp312-none-any.whl
```

更稳妥的顺序：

1. 先安装 `pandas`，确保 `tgw` 的直接依赖满足。
2. 再安装 `tgw` 原始 wheel。
3. 再安装 `AmazingData` 所需依赖：`pydantic`、`numba`、`scipy`、`statsmodels`。
4. 最后安装 `AmazingData` 原始 wheel。

建议命令：

```powershell
python -m pip install --no-index --find-links sdks/yinhe/vendor/wheelhouse pandas
python -m pip install --no-index --find-links sdks/yinhe/vendor/wheels --no-deps sdks/yinhe/vendor/wheels/tgw-1.0.8.7-py3-none-any.whl

python -m pip install --no-index --find-links sdks/yinhe/vendor/wheelhouse pydantic numba scipy statsmodels
python -m pip install --no-index --find-links sdks/yinhe/vendor/wheels --no-deps sdks/yinhe/vendor/wheels/AmazingData-1.1.8-cp312-none-any.whl
```

如果希望由 pip 在本地 wheelhouse 内解析依赖闭包，可以去掉第三方依赖安装命令中的 `--no-deps`，但必须保留：

```powershell
--no-index --find-links sdks/yinhe/vendor/wheelhouse
```

不要让 pip 回退到公网索引。

## 6. 验证流程

补齐 wheelhouse 后，再运行 import smoke test：

```powershell
sdks\yinhe\scripts\run_import_smoke_test.ps1
```

当前脚本仍按 `--no-index --no-deps` 安装两个 SDK wheel，不会自动安装 `vendor/wheelhouse/` 中的第三方依赖。后续可能需要调整 `run_import_smoke_test.ps1`，让它支持：

- 自动从 `sdks/yinhe/vendor/wheelhouse/` 安装依赖。
- 继续使用 `--no-index`，确保不联网。
- 继续将输出保存到 `.runtime/yinhe-smoke/import-smoke-output.txt`。
- 可选增加 `-WithDependencies` 或类似参数，在默认安全模式和依赖安装模式之间切换。
- 在输出中打印本次使用的 wheelhouse 路径和已安装包版本。

验证通过的最低标准：

- `import tgw` 成功。
- `tgw` 的 `GetVersion`、`Login`、`Close`、`QueryKline`、`QuerySnapshot`、`Subscribe` 等符号只做存在性检查。
- `import AmazingData` 成功，或在缺少非核心依赖时给出明确 WARN。
- smoke test 阶段仍不调用登录、行情、订阅或交易接口。

## 7. 风险与边界

- 不提交 `.whl`。
- 不提交 `.venv`。
- 不提交 `.runtime`。
- 不把 SDK 依赖装到全局 Python。
- 不在 smoke test 阶段调用 `Login`、`Subscribe`、`QueryKline`、`QuerySnapshot`。
- 不把账号、token、cookie、证书路径写死进代码。
- 不把 SDK 代码或 SDK 依赖直接混入 `apps/wealth-freedom-demo`。
- 真实行情权限验证必须单独阶段进行。
- wheelhouse 中的第三方包应记录来源、版本和平台兼容性，避免后续无法复现。
- 如果后续需要在 CI 或其他机器运行，应为不同 Python 版本和系统平台分别准备 wheelhouse。

## 8. 下一步任务

1. 更新 `.gitignore`，忽略 `sdks/yinhe/vendor/wheelhouse/*.whl`。
2. 准备本地 wheelhouse。
3. 修改 `run_import_smoke_test.ps1` 支持安装依赖。
4. 重跑 import smoke test。
5. 若通过，再做 `tgw.interface` 符号审计。
6. 最后再设计 quote-service adapter。
