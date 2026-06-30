# Yinhe Wheelhouse Download Guide

## 1. 目标

本阶段只准备 yinhe SDK 所需第三方依赖 wheel 的下载方案。

该阶段只下载第三方依赖 wheel，不安装依赖、不执行 SDK 登录、不请求行情、不订阅、不交易，也不验证真实权限。

## 2. 为什么需要 wheelhouse

当前 `tgw` 和 `AmazingData` 的 SDK wheel 已保存在：

```text
sdks/yinhe/vendor/wheels/
```

但第三方依赖 wheel 尚未准备完整。现有 import smoke test 使用离线 `--no-index --no-deps` 策略安装本地 SDK wheel，结果因缺少 `pandas` 导致 `import tgw` 失败，`AmazingData` 也无法继续 import。

后续需要准备完整第三方依赖闭包，才能在不联网、不污染全局 Python 的前提下继续执行 import smoke test。

## 3. 下载目录

第三方依赖 wheel 下载到：

```text
sdks/yinhe/vendor/wheelhouse/
```

该目录下 `.whl` 已被 `.gitignore` 忽略，不提交 Git。Git 只应提交 README、docs、scripts 等文本文件，不提交 wheel、venv、runtime 输出或缓存。

## 4. 执行方式

必须从 TuiLM 根目录执行：

```powershell
sdks\yinhe\scripts\download_wheelhouse.ps1 -AllowNetwork
```

脚本默认不会下载。只有显式传入 `-AllowNetwork` 时，脚本才会创建隔离 venv 并执行 `python -m pip download`。

脚本使用 `--only-binary=:all:`，只允许下载 wheel 格式依赖。如果某个依赖没有当前平台可用 wheel，应让脚本失败，而不是下载 `.tar.gz` / `.zip` 源码包或在本地编译。

脚本默认下载以下依赖及其传递依赖：

```text
pandas
pydantic>=2.6.4
numba>=0.65.0
scipy>=1.15.1
statsmodels>=0.11.0
```

脚本使用的临时环境：

```text
.runtime/yinhe-wheelhouse/.venv
```

下载目标目录：

```text
sdks/yinhe/vendor/wheelhouse/
```

## 5. 网络边界

只有在用户明确允许联网时才运行：

```powershell
sdks\yinhe\scripts\download_wheelhouse.ps1 -AllowNetwork
```

如果未传入 `-AllowNetwork`，脚本会停止并提示：

```text
This script downloads packages from the network. Re-run with -AllowNetwork if you explicitly allow it.
```

如果当前环境不允许联网，应在另一台 Python 版本、操作系统、CPU 架构匹配的联网机器上下载完整 wheelhouse，然后拷贝回：

```text
sdks/yinhe/vendor/wheelhouse/
```

不要让 smoke test 或业务代码自动联网补依赖。

## 6. 平台兼容性

当前本机 import smoke test 使用 Windows / Python 3.12 / x64，因此优先准备兼容以下环境的 wheel：

```text
Windows
Python 3.12
x64 / AMD64
cp312 / win_amd64
```

如果后续更换 Python 版本、操作系统或 CPU 架构，需要重新准备对应平台的 wheelhouse。例如 Python 3.11、Linux x64、macOS arm64 都应分别准备并验证。

对于 `pandas`、`numpy`、`scipy`、`numba`、`llvmlite` 等包含二进制扩展或平台约束的包，必须特别确认 wheel 标签与目标环境兼容。

## 7. 下载后检查

下载完成后建议检查：

```powershell
dir sdks\yinhe\vendor\wheelhouse
git status --short
git status --ignored --short sdks/yinhe/vendor/wheelhouse
```

预期结果：

- `sdks/yinhe/vendor/wheelhouse/` 下出现第三方依赖 `.whl`。
- `git status --short` 不应显示这些 `.whl` 等待提交。
- `git status --ignored --short sdks/yinhe/vendor/wheelhouse` 应显示 `.whl` 被 `!!` 忽略。

不要将 `.whl`、`.venv`、`.runtime`、缓存或日志加入 Git。

## 8. 下一步

下载完成后，再修改或扩展：

```text
sdks/yinhe/scripts/run_import_smoke_test.ps1
```

目标是让 import smoke test 支持从 `vendor/wheelhouse/` 离线安装依赖，然后重跑 import smoke test。

后续仍需保持边界：

- 只做 import 和符号存在性检查。
- 不执行真实登录。
- 不执行真实行情请求。
- 不执行真实订阅。
- 不执行真实交易请求。
- 不把 SDK 或第三方依赖直接混入 `apps/wealth-freedom-demo`。
