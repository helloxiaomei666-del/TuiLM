# TuiLM Current Merge Status

## 1. 文档目的

本文档用于桥接早期迁移审计总结与当前 TuiLM Git 仓库的实际状态。

早期审计结论描述的是迁移前的风险判断和建议路线；当前 TuiLM 仓库已经形成新的 Git 基线，并且 `apps/wealth-freedom-demo`、`apps/retire-quiz`、`sdks/yinhe`、TGW 审计和 AmazingData 审计均已进入本仓库历史。因此后续判断应以当前 TuiLM Git 历史、标签和文档为准，同时保留早期审计中的边界提醒。

## 2. 早期迁移审计结论

早期迁移审计的主要结论如下：

- TuiLM 曾经为空，尚未形成统一工程基线。
- 原计划是先清理 `ios_app/wealth-freedom-demo` 的 dirty tree，再迁移到 TuiLM。
- `retirement-test` / `测一测` 可以迁移。
- `wealth-freedom-demo` 曾因 dirty tree 较复杂而不建议直接迁移。
- provider / quote-service 实验线不应混入主产品。

这些结论在当时用于控制迁移风险，尤其是避免把旧项目中的临时实验、未归档变更和真实 provider 尝试直接并入主产品线。

## 3. 当前实际状态

根据当前 Git 历史记录，TuiLM 的实际状态已经发生变化：

- TuiLM 已初始化 Git。
- `apps/wealth-freedom-demo` 已迁入。
- `baseline-wealth-demo-20260630` 已存在。
- 迁移后测试为 80/80 pass。
- `apps/retire-quiz` 已迁入。
- `56e2ffc` / `baseline-retire-quiz-h5-mvp-20260630` 已存在。
- retire-quiz / 《测一测》已迁入 apps/retire-quiz，并通过 71/71 测试。
- `sdks/yinhe` 已建立。
- yinhe SDK wheel 已作为本地依赖来源纳入目录规划，但 `.whl` 不进入 Git。
- wheelhouse 依赖已准备。
- `run_import_smoke_test.ps1 -WithDependencies` 已通过。
- `tgw.interface` 审计已完成。
- `AmazingData` 审计已完成。
- 当前最新 tag 为 `baseline-retire-quiz-h5-mvp-20260630`。

当前关键 Git 记录：

| Commit / Tag | 说明 |
| --- | --- |
| `347d427` / `baseline-wealth-demo-20260630` | `init-tuilm-wealth-demo`，迁入 `apps/wealth-freedom-demo` |
| `1fefaec` / `baseline-tuilm-workspace-20260630` | 更新 TuiLM 模块概览 |
| `a5e524e` / `baseline-yinhe-sdk-docs-20260630` | 忽略 yinhe wheelhouse 依赖 |
| `1f8be9f` / `baseline-yinhe-smoke-pass-20260630` | `run_import_smoke_test.ps1 -WithDependencies` 相关 smoke 基线 |
| `cb5794b` / `baseline-yinhe-tgw-interface-audit-20260630` | `tgw.interface` 审计基线 |
| `bd71f7e` / `baseline-yinhe-amazingdata-interface-audit-20260630` | `AmazingData` 审计基线 |
| `56e2ffc` / `baseline-retire-quiz-h5-mvp-20260630` | `feat-add-retire-quiz-h5-mvp`，迁入 `apps/retire-quiz`，迁移后测试 71/71 pass，当前最新基线 |

## 4. 路线差异说明

早期路线是：

```text
先清理旧项目 dirty tree
再迁移 TuiLM
```

当前实际路线已经变为：

```text
TuiLM 先形成独立 Git 基线
apps/wealth-freedom-demo 已作为应用模块迁入
apps/retire-quiz 已作为《测一测》H5 MVP 迁入
sdks/yinhe 作为 SDK 研究与接入模块单独建立
后续在 TuiLM 内继续补文档、审计和 adapter 设计
```

这不是简单执行了早期建议，而是用新的仓库基线替代了旧项目 dirty tree 的不确定状态。早期审计中的风险提醒仍然有效；当前应理解为 wealth demo 和 retire-quiz 均已迁入。

## 5. 当前边界

后续工作应遵守以下边界：

- `apps/wealth-freedom-demo` 是已迁入应用模块，不应在 SDK 审计或 adapter 设计阶段被随意改动。
- `apps/retire-quiz` 是已迁入的静态 H5 MVP，不应在 SDK 审计或 adapter 设计阶段被随意改动。
- provider / quote-service 实验线可以作为历史资料和边界参考，但不应直接混入主产品逻辑。
- `sdks/yinhe` 是 yinhe / Galaxy SDK 研究、依赖准备、接口审计和后续 adapter 设计的归属目录。
- `.runtime`、`.venv`、`.whl`、缓存和日志只作为本地运行材料，不应进入 Git。
- 真正登录、行情请求、订阅、下载和交易验证应单独立项，不能混在静态审计或文档补充任务中。

## 6. 后续工作定位

当前可继续推进的工作类型：

- 补充迁移状态、SDK 审计和 adapter 边界文档。
- 基于 `tgw.interface` 和 `AmazingData` 审计结果设计只读 adapter 边界。
- 使用 mock / fake 数据为 adapter 设计参数映射和返回模型测试。
- 将真实登录、真实行情、真实订阅和真实下载验证放入后续受控任务。

当前不应推进的工作类型：

- 直接在 `apps/wealth-freedom-demo` 内接入 yinhe SDK。
- 在文档任务中运行 smoke test 或真实 SDK 请求。
- 将 provider 实验代码提升为主产品依赖。
- 将本地 wheel、wheelhouse、venv、runtime JSON 或日志纳入 Git。
