# TuiLM

TuiLM 是《退了吗》统一工程。

## 当前模块

- `apps/wealth-freedom-demo`

## wealth-freedom-demo 内容

`apps/wealth-freedom-demo` 当前包含：

- Web 静态演示
- 微信小程序
- `quote-service` 行情实验服务
- `tests` 测试集
- `docs` 项目文档

## 当前基线

- commit: `347d427`
- tag: `baseline-wealth-demo-20260630`
- 迁移后测试：80/80 通过

## 后续规划

- 将 Galaxy / yinhe SDK 独立迁入 `SDK` 或 `packages` 目录。
- 不要把 SDK 代码直接混入 `apps/wealth-freedom-demo`。
