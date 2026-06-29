# 资产估值行情架构

本项目的行情能力只用于个人资产记录和退休进度测算中的估值刷新，不提供买卖建议、产品推荐、收益承诺或自动交易能力。

## 当前架构

```text
wechat-miniapp/pages/assets/assets.js
  -> wechat-miniapp/utils/asset-model.js
  -> wechat-miniapp/utils/quote-client.js
  -> local mock adapter 或未来 wx.request 到自己的 quote-service
  -> quote-service/server.js
  -> 未来第三方行情 API
```

小程序前端不直接请求第三方行情 API，也不保存第三方 API key。正式环境应让小程序请求自己的 HTTPS 后端域名，由后端读取环境变量中的 provider key、处理缓存、限频、错误兜底和数据来源展示。

## Quote 数据结构

quote-service 和小程序 quote client 统一使用以下字段：

```json
{
  "code": "000300",
  "name": "沪深300指数基金",
  "assetType": "fund",
  "price": 1.2368,
  "priceTime": "2026-06-12T12:00:00.000Z",
  "source": "local mock quote-service",
  "status": "ok",
  "message": "本地 Demo 基金估值"
}
```

写入持仓的估值字段：

- `currentPrice`
- `currentValue`
- `todayPnl`
- `updatedAt`
- `source`
- `quoteStatus`
- `quoteMessage`

失败行情不会覆盖 `currentPrice`、`currentValue`、`todayPnl`、`updatedAt` 或 `source`，只更新 `quoteStatus` 和 `quoteMessage`，让用户知道刷新失败但保留了上次估值。

## 每日估值快照

小程序当前已经把“刷新估值”后的持仓聚合成每日估值快照。快照用于回答“今天资产总值和上一次记录相比变化了多少”，不是行情 K 线，也不是交易信号。

核心文件：

- `wechat-miniapp/utils/valuation-model.js`：构建每日快照、同日 upsert、上一快照对比和汇总文案。
- `wechat-miniapp/utils/asset-model.js`：在资产汇总中读取估值快照状态。
- `quote-service/valuation-engine.js`：后端模式下复用 provider quote，生成估值预览和快照。
- `quote-service/valuation-store.js`：本地开发时把快照写入 `.runtime/valuation-snapshots.json`。

快照核心字段：

```json
{
  "snapshotDate": "2026-06-13",
  "generatedAt": "2026-06-13T10:00:00.000Z",
  "totalValue": 332000,
  "dailyChange": 1200,
  "dailyChangeRate": 0.36,
  "hasPrevious": true,
  "quoteStatus": "ok",
  "quoteMessage": "估值已更新",
  "source": "local mock quote-service",
  "items": []
}
```

同一天多次刷新不会重复生成多条记录，而是用当天最新估值覆盖当天快照。没有上一快照时，页面显示“暂无昨日对比”，避免伪造日涨跌。

## 资产类型策略

- `cash`：不请求行情，保持手动金额，`quoteStatus="skipped"`。
- `fund` / stock-like：按代码请求估值。当前小程序 `stock` 分类默认映射为 `fund`，后续可按 `instrument` 区分基金和股票。
- `bond`：当前先走 manual fallback，保留手动价格；后续接入债券基金净值或债券估值服务。
- `commodity` / `gold`：当前 local mock 可刷新估值；后续优先接入黄金价格。

## 本地 quote-service

启动：

```powershell
node quote-service\server.js
```

默认服务：

```text
http://127.0.0.1:8010
```

单条 quote：

```text
GET /api/quotes?type=fund&code=000300
```

批量 quote：

```text
GET /api/quotes/batch?items=fund:000300,commodity:gold-demo
```

估值预览，不落盘：

```text
POST /api/valuations/preview
```

生成每日估值快照，写入本地 `.runtime/valuation-snapshots.json`：

```text
POST /api/valuations/snapshot
```

读取本地快照历史：

```text
GET /api/valuations/snapshots?userId=demo
```

当前服务只返回本地 mock quote，便于验证接口形状、错误响应、小程序刷新边界和每日估值快照流程。它不接真实第三方 API，也不包含任何真实 secret。

`.runtime/` 只用于本地开发和测试，已经被 `.gitignore` 忽略。正式环境应替换为数据库或托管存储，并按用户维度隔离快照。

## Provider 合约

真实行情 provider 只能在 `quote-service/providers/` 内实现，不能写到小程序前端。provider 输出必须统一为 quote 数据结构：

```js
{
  code,
  name,
  assetType,
  price,
  priceTime,
  source,
  status,
  message,
}
```

当前 provider 文件：

- `mock-provider.js`：本地 mock provider，默认使用。
- `real-provider-placeholder.js`：真实 provider 占位，只读取环境变量是否存在，不发真实请求，不返回 secret 值。
- `provider-contract.md`：真实 provider 的接口、失败语义和安全边界。

允许出现的环境变量名包括 `QUOTE_API_PROVIDER`、`QUOTE_API_BASE_URL`、`QUOTE_API_KEY`。实际值只能在后端运行环境或 secret manager 中配置，不能写入 git。

## 小程序端配置边界

当前 `quote-client.js` 默认使用 `local` adapter，游客模式和自动测试不依赖网络。未来切换到 `wx-request` adapter 时：

- 请求地址必须是自己的 quote-service 后端。
- 正式小程序必须在微信公众平台配置 HTTPS 合法 request 域名。
- 不要把第三方 provider URL、API key、token 或 secret 写入小程序前端。
- 网络失败时保留上次估值，并展示 `quoteStatus="error"` 与温和的 `quoteMessage`。

## 真实 API 接入 Checklist

- 确认行情 API 授权范围，避免把延迟行情误写成实时行情。
- 第三方 key 只存后端环境变量或 secret manager。
- 后端增加 provider adapter，不让小程序直连 provider。
- 增加请求频率限制和 provider 错误熔断。
- 增加缓存策略，例如基金净值按交易日缓存，黄金/股票按可接受延迟缓存。
- quote 响应必须包含 `source`、`priceTime`、`status`、`message`。
- 所有失败路径必须保留用户已有持仓和上次价格。
- 小程序端展示数据来源、更新时间和状态，不展示交易建议。
- 正式环境配置 HTTPS 合法 request 域名并完成微信开发者工具真机/体验版验收。
- 合规文案继续说明：估值只用于资产记录和退休测算，不构成投资建议，不承诺收益。

## 自动验证

当前预检脚本会自动发现 `tests/*.test.js`，并额外检查 `wechat-miniapp/` 与 `quote-service/` 下的 JS 语法：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\wechat-miniapp-preflight.ps1
```

估值相关重点测试：

```powershell
node --test tests\quote-service.test.js
node --test tests\quote-client.test.js
node --test tests\quote-provider.test.js
node --test tests\valuation-model.test.js
node --test tests\security-static.test.js
```

`tests/security-static.test.js` 允许出现 `QUOTE_API_KEY` 这类环境变量名和 redacted 占位值，但不允许真实 key、token、secret 或私钥形态的值进入源码、测试或文档。

## 后续优先接入顺序

1. 基金 / ETF 净值
2. 黄金价格
3. 股票行情
4. 债券估值
