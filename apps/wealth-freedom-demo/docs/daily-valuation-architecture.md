# 每日资产估值监控架构

本架构用于“退了吗”记录个人资产、刷新每日估值、测算退休进度。不做买卖建议、产品推荐、收益承诺或自动交易，也不把行情数据解释成交易信号。

## 当前可行性

可行性：高。主体工程已经具备本地闭环：

- 小程序资产页可以刷新估值并保留来源、时间、状态。
- 本地 quote client 支持 local/mock 和 backend adapter。
- quote-service 已提供 quote 接口、估值预览接口和每日快照接口。
- 每日快照可记录总估值、上一快照对比、quote 状态和每个持仓的估值痕迹。
- 所有测试不依赖真实网络，不需要真实 API key。

尚未完成的是“真实行情供应商接入”和“云端持久化”。这两项需要真实 API 授权、后端 HTTPS 域名、微信 request 合法域名和正式存储方案，不能在没有授权的情况下硬接。

## 本地数据流

```text
用户录入持仓
  -> 点击资产页“刷新估值 Demo”
  -> wechat-miniapp/utils/quote-client.js
  -> local mock adapter 或 backend adapter
  -> 更新 holdings 的 currentPrice/currentValue/todayPnl/source/quoteStatus
  -> wechat-miniapp/utils/valuation-model.js
  -> 生成或覆盖当天 valuation snapshot
  -> 资产页和总览页展示每日估值状态
```

本地小程序默认使用 local/mock adapter，保证微信开发者工具游客模式和自动测试可用。

## 后端数据流

```text
小程序 backend mode
  -> 自有 HTTPS quote-service
  -> quote-service/providers/*
  -> 标准 quote
  -> quote-service/valuation-engine.js
  -> POST /api/valuations/preview 或 POST /api/valuations/snapshot
  -> .runtime/valuation-snapshots.json（本地开发）
```

正式环境需要把 `.runtime/valuation-snapshots.json` 替换成数据库或托管存储，并按用户隔离数据。`.runtime/` 只适合本地测试，不能作为生产存储。

## 接口

单条估值：

```text
GET /api/quotes?type=fund&code=000300
```

批量估值：

```text
GET /api/quotes/batch?items=fund:000300,commodity:gold-demo
```

估值预览，不落盘：

```text
POST /api/valuations/preview
```

生成每日快照，落盘到本地 store：

```text
POST /api/valuations/snapshot
```

查询快照历史：

```text
GET /api/valuations/snapshots?userId=demo
```

## 数据结构

quote 结构：

```json
{
  "code": "000300",
  "name": "沪深300指数基金",
  "assetType": "fund",
  "price": 1.2368,
  "priceTime": "2026-06-13T10:00:00.000Z",
  "source": "local mock quote-service",
  "status": "ok",
  "message": "本地 Demo 基金估值"
}
```

每日快照结构：

```json
{
  "snapshotDate": "2026-06-13",
  "generatedAt": "2026-06-13T10:00:00.000Z",
  "totalValue": 332000,
  "cashValue": 120000,
  "investmentValue": 212000,
  "dailyChange": 1200,
  "dailyChangeRate": 0.36,
  "hasPrevious": true,
  "previousSnapshotDate": "2026-06-12",
  "quoteStatus": "ok",
  "quoteMessage": "估值已更新",
  "source": "local mock quote-service",
  "items": []
}
```

## 失败兜底

- `cash`：不请求行情，保持手动金额，状态为 `skipped`。
- 非现金资产请求失败：保留原 `currentPrice`、`currentValue`、`updatedAt`、`source`，只更新 `quoteStatus` 和 `quoteMessage`。
- 没有上一快照：不展示伪造涨跌，显示“暂无昨日对比”。
- 同一天多次刷新：覆盖当天快照，不重复堆积。
- provider 异常：后端返回标准 error quote，小程序仍保留旧估值。

## Provider 接入边界

真实 provider 只能放在 `quote-service/providers/` 内。小程序不得直接请求第三方 API，也不得保存第三方 API key、token 或 secret。

真实 provider 的 key 只能来自：

- 后端环境变量，例如 `QUOTE_API_KEY`。
- 部署平台 secret manager。

真实 provider 接入前必须确认：

- 授权范围和商用展示许可。
- 数据延迟和是否允许称为“实时”。
- 请求频率限制。
- 缓存和落库限制。
- 必须展示的数据来源文案。
- 微信小程序正式环境 HTTPS request 合法域名。

## AI 主体工作流

AI 可以独立完成：

1. 审查当前持仓、quote、valuation、provider 代码边界。
2. 补充 provider adapter stub 和 fixture tests。
3. 扩展 quote-service 接口、错误模型、缓存和 timeout。
4. 更新小程序 backend adapter 配置，但默认保留 local/mock。
5. 写入和维护文档、测试、预检、安全扫描。
6. 在用户提供 API 文档后，实现真实 provider 的解析、缓存、错误兜底和 contract tests。

用户需要做的事尽量压缩为：

1. 选择或注册行情 API 服务。
2. 确认授权条款允许当前产品展示和缓存。
3. 在后端环境配置 key，不把 key 发到小程序前端。
4. 配置正式 HTTPS 后端域名和微信小程序 request 合法域名。
5. 用微信开发者工具做体验版或真机验收。

## 下一阶段真实 API 选择

推荐顺序：

1. 基金 / ETF 净值：最适合资产记录，更新频率较低，缓存策略清楚。
2. 黄金价格：适合商品资产估值，但要明确单位、汇率和来源。
3. 股票行情：授权和延迟说明更敏感，必须避免被误解为交易工具。
4. 债券估值：数据源差异大，优先考虑债券基金净值或手动 fallback。

AI 下一步应先帮用户筛选 provider，而不是直接写接入代码。Phase 9 的筛选结论见 `docs/real-provider-selection.md`；Tushare 权限不足后的 Phase 12 更新见 `docs/api-provider-selection-phase-12.md`。当前推荐顺序是：先向恒生 LIGHT 云或聚宽 JQData 确认试用、商用展示和缓存授权；Tushare 保留为开通 `fund_nav` / `fund_daily` 后快速复测的备用路径；黄金估值再单独接 Metals-API 或 GoldAPI 类 provider。筛选完成后，再根据 provider 文档实现 `quote-service/providers/<asset>-provider.js`，并用 fixture 测试覆盖成功、失败、限频和字段缺失场景。

## 验证命令

```powershell
node --test tests\quote-service.test.js
node --test tests\quote-client.test.js
node --test tests\quote-provider.test.js
node --test tests\valuation-model.test.js
node --test tests\security-static.test.js
powershell -ExecutionPolicy Bypass -File scripts\wechat-miniapp-preflight.ps1
git status --short --ignored
```

验收标准：

- quote-service valuation preview、snapshot、snapshot query 测试通过。
- backend adapter 失败时保留旧价格。
- provider placeholder 不泄露环境变量值。
- 安全扫描允许环境变量名，但不允许真实 key、token、secret。
- `.runtime/`、`project.private.config.json`、本地 AppID 配置和头像不提交。
