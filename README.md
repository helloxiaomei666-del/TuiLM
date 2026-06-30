# TuiLM

TuiLM 是《退了吗》统一工程，用于集中管理当前已迁入的产品演示、SDK 研究材料、迁移状态文档和后续服务端接入设计。

## 当前目录

```text
apps/wealth-freedom-demo
apps/retire-quiz
sdks/yinhe
docs/migration
```

## 当前真实状态

当前 TuiLM 第一阶段合并工程已经形成 Git 基线：

- TuiLM Git 仓库已初始化。
- `apps/wealth-freedom-demo` 已迁入。
- wealth demo 迁移后测试为 80/80 pass。
- `apps/retire-quiz` 已迁入。
- retire-quiz / 《测一测》已迁入 apps/retire-quiz，并通过 71/71 测试。
- `sdks/yinhe` 已建立。
- yinhe SDK wheel 已本地纳入，但 `.whl` 不进入 Git。
- wheelhouse 本地依赖准备完成。
- `run_import_smoke_test.ps1 -WithDependencies` 已通过。
- `tgw.interface` 静态符号审计已完成。
- `AmazingData` 静态 / 半静态符号审计已完成。
- 已补充迁移状态桥接文档。
- 已补充 yinhe SDK adapter 边界设计文档。

当前最新基线：

```text
baseline-retire-quiz-h5-mvp-20260630
```

## 模块说明

### `apps/wealth-freedom-demo`

`apps/wealth-freedom-demo` 是已迁入的《退了吗》主产品 / 财富自由演示项目快照，迁移后测试 80/80 pass。

当前包含：

- Web 静态演示。
- 微信小程序。
- `quote-service` 行情实验服务。
- 测试集。
- 项目文档。

当前状态：

- 已迁入 TuiLM。
- 迁移后测试 80/80 pass。
- 当前阶段不在 SDK 审计或 adapter 边界设计任务中修改该目录。

### `apps/retire-quiz`

`apps/retire-quiz` 是已迁入的《测一测》H5 MVP，静态 H5，零依赖，迁移后测试 71/71 pass。

当前包含：

- 静态 H5 MVP。
- 零依赖前端实现。
- 迁移后测试集。

当前状态：

- 已迁入 TuiLM。
- 迁移后测试 71/71 pass。
- 当前阶段不在 SDK 审计或 adapter 边界设计任务中修改该目录。

### `sdks/yinhe`

`sdks/yinhe` 是银河证券 / AmazingData / tgw SDK 研究、审计、smoke test 与未来 adapter 设计目录。

当前包含：

- SDK package audit。
- 本地 wheel / wheelhouse 准备说明。
- import smoke test 脚本与文档。
- `tgw.interface` 接口审计。
- `AmazingData` 接口审计。
- yinhe SDK adapter 边界设计文档。

重要边界：

- `vendor/wheels/*.whl` 和 `vendor/wheelhouse/*.whl` 属于本地第三方二进制依赖，不提交 Git。
- `.runtime`、`.venv`、缓存、日志不提交 Git。
- 当前审计只确认 import、符号、签名、docstring 和模块结构，不代表真实账号、行情、下载、订阅或交易权限已经验证。

### `docs/migration`

`docs/migration` 用于保存迁移状态、桥接记录、阶段性合并说明。

当前包含：

- `tuilm-current-merge-status.md`：桥接早期迁移审计结论与当前 TuiLM Git 实际状态。

## 关键文档

```text
docs/migration/tuilm-current-merge-status.md
sdks/yinhe/docs/yinhe-adapter-boundary.md
sdks/yinhe/docs/tgw-interface-audit.md
sdks/yinhe/docs/amazingdata-interface-audit.md
sdks/yinhe/docs/sdk-import-smoke-test.md
sdks/yinhe/docs/local-wheelhouse-plan.md
sdks/yinhe/docs/wheelhouse-download-guide.md
```

## 当前边界

TuiLM 当前阶段的边界是：

- 不让 `apps/wealth-freedom-demo` 直接依赖 `AmazingData` 或 `tgw` SDK。
- SDK 接入应通过后续 yinhe adapter 和服务端边界隔离。
- provider / quote-service 实验线可以作为历史资料和边界参考，但不应直接混入主产品逻辑。
- 真实登录、真实行情请求、真实下载、真实订阅和真实交易验证需要单独立项。
- 文档、审计和 adapter 设计任务不应触发真实 SDK 业务调用。

推荐依赖方向：

```text
apps/wealth-freedom-demo
  -> quote-service or other backend service boundary
    -> yinhe adapter
      -> AmazingData / tgw SDK
```

禁止的方向：

```text
apps/wealth-freedom-demo
  -> AmazingData / tgw SDK
```

## 后续工作

建议按以下顺序推进：

1. 基于 `tgw.interface` 和 `AmazingData` 审计结果定义只读 adapter contract。
2. 使用 mock / fake SDK 数据验证参数映射、返回模型和错误模型。
3. 保持 `apps/wealth-freedom-demo` 只依赖稳定服务边界，不直接接触 SDK。
4. 在独立任务中再评估真实登录、真实行情、真实下载和真实订阅验证。
5. 真实 SDK 能力验证通过前，不对产品流程承诺实时行情、历史行情、下载或订阅能力。
