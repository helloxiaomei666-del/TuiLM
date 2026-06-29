# TuiLM

TuiLM 是《退了吗》统一工程。

## 当前模块

- `apps/wealth-freedom-demo`
- `sdks/yinhe`

## wealth-freedom-demo 内容

`apps/wealth-freedom-demo` 当前包含：

- Web 静态演示
- 微信小程序
- `quote-service` 行情实验服务
- `tests` 测试集
- `docs` 项目文档

## sdks/yinhe 内容

`sdks/yinhe` 用于存放银河证券 / Galaxy / yinhe SDK 相关研究、封装、示例和接入文档。

当前仅保存 SDK 接入说明与本地 wheel 依赖目录。

`vendor/wheels/*.whl` 属于本地第三方二进制包，已被 `.gitignore` 忽略，不提交进 Git。

## 当前基线

- commit: `347d427`
- tag: `baseline-wealth-demo-20260630`
- 迁移后测试：80/80 通过

## 后续规划

- 继续补充 SDK 安装说明、行情接口示例、历史行情封装、`quote-service` 对接方案。
- 不要把 SDK 代码直接混入 `apps/wealth-freedom-demo`。
