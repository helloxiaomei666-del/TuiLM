# TuiLM

TuiLM 是《退了吗》统一工程，用于集中管理当前已迁入的产品演示、SDK 研究材料、迁移状态文档、飞书项目中控台和后续服务端接入设计。

## 当前阶段

公开试用版 / 求职作品集版上线前的项目治理与 SDK 接入前准备阶段。

当前不是马上真实 SDK 接入阶段。当前不是商业化真实行情服务阶段。当前重点是公开试用版、文档中控台、Mock First、SDK 预研、quote-service contract 准备和风险门禁建设。

## 当前目录

- `apps/wealth-freedom-demo`
- `apps/retire-quiz`
- `sdks/yinhe`
- `docs/migration`

## 当前真实状态

当前 TuiLM 第一阶段合并工程已经形成 Git 基线：

- TuiLM Git 仓库已初始化。
- `apps/wealth-freedom-demo` 已迁入。
- wealth demo 迁移后测试为 80/80 pass。
- `apps/retire-quiz` 已迁入。
- retire-quiz / 《测一测》已迁入 `apps/retire-quiz`，并通过 71/71 测试。
- `sdks/yinhe` 已建立。
- yinhe SDK wheel 已本地纳入，但 `.whl` 不进入 Git。
- wheelhouse 本地依赖准备完成。
- `run_import_smoke_test.ps1 -WithDependencies` 已通过。
- `tgw.interface` 静态符号审计已完成。
- `AmazingData` 静态 / 半静态符号审计已完成。
- 已补充迁移状态桥接文档。
- 已补充 yinhe SDK adapter 边界设计文档。
- 已建立飞书项目中控台的主要文档结构。

当前关键基线参考：

- `baseline-tuilm-with-retire-quiz-20260630`

说明：如当前 Git tag 与飞书项目管理口径不一致，以实际 Git tag、README、docs/migration 和最新测试结果为准。上述名称作为当前项目管理关键基线参考，不在未核验 Git tag 前写成已确认 tag。

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
- 当前不应直接接 SDK。
- 当前不应直接接真实行情。
- 当前不应让前端或小程序直接依赖 `AmazingData` / `tgw` SDK。

### `apps/retire-quiz`

`apps/retire-quiz` 是已迁入的《测一测你还有多久退休》H5 MVP，静态 H5，零依赖，迁移后测试 71/71 pass。

当前包含：

- 静态 H5 MVP。
- 零依赖前端实现。
- 迁移后测试集。

当前状态：

- 已迁入 TuiLM。
- 迁移后测试 71/71 pass。
- 当前不接 SDK。
- 当前不接真实行情。
- 当前不应随意重构。
- 当前不应随意修改 LocalStorage key。
- 当前不应随意修改脚本加载顺序。

### `sdks/yinhe`

`sdks/yinhe` 是银河证券 / 星耀数智 / AmazingData / tgw SDK 研究、审计、smoke test 与未来 adapter 设计目录。

当前包含：

- SDK package audit。
- 本地 wheel / wheelhouse 准备说明。
- import smoke test 脚本与文档。
- `tgw.interface` 接口审计。
- `AmazingData` 接口审计。
- yinhe SDK adapter 边界设计文档。

当前已知 AmazingData 信息：

- 已获得《中国银河证券星耀数智 AmazingData 开发手册》信息。
- 文档版本：V1.0.24。
- Python SDK 版本：V1.0.24。
- Python SDK 是当前第一阶段主线。
- C++ SDK 仅记录，不作为第一阶段主线。
- 登录需要 `username`、`password`、`host`、`port`。
- 账号、密码、IP、端口需通过开户营业部申请。
- 当前客服反馈：自用可以，不支持商用。
- 试用账号最大订阅数 100。
- 正式账号默认最大订阅数 8000。
- 订阅额度不等于商业授权。

当前 SDK 资料仅用于：

- 本地研究。
- SDK 能力审计。
- quote-service adapter 预研。
- Mock provider 对齐。
- 字段映射。
- 错误模型整理。
- 日志脱敏方案设计。
- no-real-call safety test 设计。

不得用于：

- 公开试用版真实行情。
- 商业化服务。
- 对真实用户展示银河行情。
- 转售或分发行情数据。
- 宣传《退了吗》已接入真实行情。

重要边界：

- `vendor/wheels/*.whl` 和 `vendor/wheelhouse/*.whl` 属于本地第三方二进制依赖，不提交 Git。
- `.runtime`、`.venv`、缓存、日志不提交 Git。
- 账号、密码、IP、端口、token、cookie、证书、私有配置不提交 Git。
- 当前审计只确认 import、符号、签名、docstring 和模块结构，不代表真实账号、行情、下载、订阅或交易权限已经验证。
- SDK import 成功不等于真实 SDK 权限验证成功。
- 静态审计完成不等于真实行情接入完成。

### `docs/migration`

`docs/migration` 用于保存迁移状态、桥接记录、阶段性合并说明。

当前包含：

- `tuilm-current-merge-status.md`：桥接早期迁移审计结论与当前 TuiLM Git 实际状态。

## 公开试用版与内部测试版边界

### 公开试用版允许

- 手动资产输入。
- 退休进度测算。
- 被动收入覆盖率。
- Mock 数据。
- 延迟公开数据。
- 用户自填收益。
- 非投资建议提示。

### 公开试用版禁止

- 银河真实 SDK。
- 真实实时行情。
- 个人 SDK 权限。
- 真实订阅。
- 真实交易。
- 商业化行情服务。
- 对真实用户展示银河真实行情。
- 宣传已接入真实行情。

### 内部测试版允许

- SDK 本地验证。
- quote-service adapter 实验。
- Mock provider 对齐。
- 字段映射。
- 错误模型整理。
- 日志脱敏验证。
- no-real-call safety test 设计。
- 真实权限到位后的最小验证路线设计。

### 内部测试版禁止

- 对外开放。
- 商业化。
- 给真实用户使用。
- 宣传已接入真实行情。
- 使用个人 SDK 权限服务外部用户。

## 飞书项目中控台

当前飞书项目中控台已建立或正在沉淀：

- 01｜项目总览
- 02｜当前路线图
- 03｜需求池与任务看板
- 04｜银河星耀数智沟通记录
- 05｜风险与待确认问题
- 06｜AI团队组织架构
- 07｜阶段复盘与周报

飞书用于项目中控台、管理沉淀和阶段复盘。GitHub Docs 用于工程事实、架构边界和作品集展示。二者需要保持事实一致。

如果飞书和 GitHub Docs 出现不一致，应以当前 Git 状态、README、docs/migration、实际测试结果和最新项目总控裁决为准。

## AI 团队协作机制

当前 TuiLM AI 团队包括：

- 01｜总经理AI｜项目总控
- 02｜PRD经理AI｜产品需求
- 03｜CTO AI｜技术架构
- 04｜前端AI｜Web与小程序
- 05｜后端AI｜quote-service
- 06｜SDK组AI｜银河行情接口
- 07｜测试QA AI｜测试与验收
- 08｜文档AI｜知识库与SOP
- 09｜内容增长AI｜散户经济学与传播
- 10｜提示词工程师AI｜任务转译与分发
- 11｜AAA架构设计师AI｜AI组织架构与Agent协作

核心原则：

- 新任务先经总经理 AI 判断。
- 再分派给专业 AI。
- Codex 只执行明确、低风险、边界清楚的任务。
- 真实 SDK、真实行情、提交 Git、打 tag、删除文件、大规模迁移等高风险操作必须先经 CEO 确认。

计划同步文档：

- `docs/team/ai-team-framework.md`

## 关键文档

当前已有关键文档：

- `docs/migration/tuilm-current-merge-status.md`
- `sdks/yinhe/docs/yinhe-adapter-boundary.md`
- `sdks/yinhe/docs/tgw-interface-audit.md`
- `sdks/yinhe/docs/amazingdata-interface-audit.md`
- `sdks/yinhe/docs/sdk-import-smoke-test.md`
- `sdks/yinhe/docs/local-wheelhouse-plan.md`
- `sdks/yinhe/docs/wheelhouse-download-guide.md`

计划新增或待同步文档：

- `docs/team/ai-team-framework.md`
- `sdks/yinhe/docs/amazingdata-dev-manual-audit.md`
- `docs/product/public-demo-vs-internal-sdk-test-boundary.md`
- `docs/architecture/quote-provider-contract.md`
- `docs/testing/no-real-call-safety-test.md`
- `docs/sop/git-and-sensitive-files-sop.md`
- `docs/adr/adr-mock-first-market-data.md`

说明：以上计划新增文档在实际创建前，不应写成已完成。

## 当前边界

TuiLM 当前阶段的边界是：

- 不让 `apps/wealth-freedom-demo` 直接依赖 `AmazingData` 或 `tgw` SDK。
- 不让 `apps/retire-quiz` 接入 SDK。
- 不让前端、小程序、H5 直接调用 SDK。
- SDK 接入应通过后续 yinhe adapter 和服务端边界隔离。
- provider / quote-service 实验线可以作为历史资料和边界参考，但不应直接混入主产品逻辑。
- 真实登录、真实行情请求、真实下载、真实订阅和真实交易验证需要单独立项。
- 文档、审计和 adapter 设计任务不应触发真实 SDK 业务调用。

继续禁止：

- 真实 SDK 登录。
- 真实 `query_snapshot`。
- 真实 `query_kline`。
- 真实 `SubscribeData.run`。
- 真实全市场订阅。
- 真实历史数据抓取。
- 真实交易。
- 前端直连 SDK。
- 小程序直连 SDK。
- `apps/retire-quiz` 接 SDK。
- `apps/wealth-freedom-demo` 直接依赖 `AmazingData` / `tgw`。
- 公开试用版使用个人 SDK 权限。
- 商业化使用个人 SDK 权限。
- 宣传已接入银河真实行情。
- 把 Mock 写成真实行情。
- 把 SDK import 成功写成真实权限验证成功。
- 提交 `.whl`、`.runtime`、`.venv`、`node_modules`、账号、密码、IP、端口、token、cookie、证书、私有配置。

推荐依赖方向：

```text
apps/wealth-freedom-demo
  -> quote-service or other backend service boundary
    -> provider adapter
      -> yinhe adapter
        -> AmazingData / tgw SDK
```

禁止的方向：

```text
apps/wealth-freedom-demo
  -> AmazingData / tgw SDK

apps/retire-quiz
  -> AmazingData / tgw SDK

wechat-miniapp
  -> AmazingData / tgw SDK
```

## 后续工作

建议按以下顺序推进：

1. 同步飞书 06｜AI团队组织架构 为 `docs/team/ai-team-framework.md`。
2. 同步飞书 04｜银河星耀数智沟通记录 为 `sdks/yinhe/docs/amazingdata-dev-manual-audit.md`。
3. 创建公开试用版 / 内部测试版边界文档。
4. 创建 quote-provider contract 文档。
5. 创建 no-real-call safety test 文档。
6. 梳理《测一测》公开试用版优化清单。
7. 一个月内准备公开试用版 / 求职作品集版上线。
8. 真实 SDK 权限到位后，再单独立项最小验证路线。

真实 SDK 能力验证通过前，不对产品流程承诺实时行情、历史行情、下载、订阅或商业化行情能力。

## 当前结论

TuiLM 当前已经完成第一阶段统一工程迁移与 SDK 接入前准备的基础建设。

当前最重要的不是立刻接入真实 SDK，而是：

- 保持公开试用版与内部测试版分离。
- 保持 Mock First。
- 保持前端、小程序、H5 不直连 SDK。
- 保持飞书中控台与 GitHub Docs 一致。
- 保持 SDK 预研、商业授权、风险门禁和作品集表述准确。
- 继续准备公开试用版 / 求职作品集版上线。

《退了吗 / TuiLM》当前不是金融行情商业服务，也不是投资建议工具，而是一个围绕退休进度、现金流覆盖、被动收入理解和个人财务认知建立的长期产品项目。