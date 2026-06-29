# Phase 9 真实行情 API 选择报告

检查日期：2026-06-13

本报告用于为“退了吗”的每日资产估值系统选择真实行情 provider。结论只服务于资产记录和退休进度测算，不做买卖建议、产品推荐、收益承诺或自动交易。

## 结论

第一接入对象应是“基金 / ETF 日净值”，不是实时股票行情。

## Phase 12 更新：Tushare 权限不足后的路线调整

2026-06-13 已用本机 `TUSHARE_TOKEN` 探测 `fund_nav` 和 `fund_daily`，两个接口均返回 `permission_denied`。这说明 Tushare token 和后端请求链路有效，但当前账号没有基金净值 / ETF 日线权限。

因此当前不再继续围绕 Tushare 空转。phase 12 的新结论见 `docs/api-provider-selection-phase-12.md`：优先向恒生 LIGHT 云或聚宽 JQData 确认试用、价格、商用展示和缓存授权；Tushare 保留为“开通权限后可快速复测”的备用路径。

推荐路径：

1. 先做基金 / ETF 日净值 provider spike。
2. 再做黄金估值 provider spike。
3. 股票行情只做日终或延迟估值，等授权和展示边界清楚后再接。
4. 债券直连估值后置；短期把债券基金按基金净值处理，个券债券继续 manual fallback。

## 推荐 Provider 顺序

| 优先级 | 资产类型 | 推荐 provider | 用途 | 结论 |
| --- | --- | --- | --- | --- |
| 1 | 中国基金 / ETF | Tushare Pro | 工程验证、内测、低成本接入 spike | 先接，但上线前必须确认授权和展示边界 |
| 1B | 中国基金 / ETF | 恒生 LIGHT 云 / 聚源基金净值接口 | 更接近生产/商业化的数据源 | 作为正式商业版本候选，需要商务或平台开通 |
| 2 | 黄金 | GoldAPI.net | 国际现货金估值，如 XAU/USD 或 XAU/CNY | 可做第二个 provider，UI 必须标明“国际现货估值” |
| 3 | 全球股票 / ETF | Twelve Data / Tiingo / Alpha Vantage | 非中国市场的日终或延迟估值 | 暂不优先，需确认商业展示和交易所数据限制 |
| 4 | 债券 | Cbonds / Wind / Choice 类企业数据源 | 个券债券估值 | 暂不做 MVP，成本和授权复杂度高 |

不建议生产使用：

- 天天基金、东方财富未公开稳定 API、网页 JS 接口、爬虫。
- AKShare 直接作为生产 provider。它适合研究和验证字段，不适合作为小程序公开服务的正式授权数据源。
- 前端直连任何第三方行情 API。

## 候选评估

### 1. Tushare Pro：基金 / ETF 第一工程 spike

适合范围：

- 公募基金净值。
- 场内基金 / ETF 日线。
- 后续可扩展到 A 股日线、部分债券数据。

优点：

- 接口覆盖面广，技术接入成本低。
- 官方文档包含注册、获取 token、调取数据流程。
- 权限按积分和部分单独权限控制，便于先做小规模后端验证。

风险：

- 上线前必须确认当前小程序的展示、缓存、商业化使用是否符合 Tushare 授权。
- 免费或低积分额度不一定适合大规模用户。
- 不应把 Tushare 返回的数据称为实时行情；本项目只使用日净值或日终估值。

本地验证记录：

- 2026-06-13 已确认后端能读取本机 `TUSHARE_TOKEN` 并请求 Tushare。
- 当前账号返回 `fund_nav` 无访问权限，说明真实 API 链路已打通，但账号权限不足。
- 系统已把该错误归一为 `provider_permission_denied`，展示文案为“数据源权限不足，已保留上次估值”。
- 该失败不应清空持仓，不应把价格改成 0，不应阻断 mock/local Demo。

建议 env：

```text
QUOTE_PROVIDER_MODE=tushare
TUSHARE_TOKEN=<backend-only>
TUSHARE_BASE_URL=https://api.tushare.pro
QUOTE_CACHE_TTL_SECONDS=43200
```

建议输出 source：

```text
Tushare Pro fund_nav
Tushare Pro fund_daily
```

AI 下一步可做：

1. 新增 `quote-service/providers/tushare-provider.js`。
2. 使用 fixture 模拟 `fund_nav` / `fund_daily` 返回。
3. 把 `nav` 或 `close` 统一映射为 `quote.price`。
4. 缓存到交易日级别，不做盘中频繁刷新。
5. 增加 provider contract tests。

用户只需要做：

1. 注册或登录 Tushare。
2. 获取 token。
3. 确认授权条款允许当前用途。
4. 在后端环境变量配置 token，不把 token 发给小程序前端。

### 2. 恒生 LIGHT 云 / 聚源基金接口：生产候选

适合范围：

- 中国基金净值、基金指标、基金基本信息。
- 商业化或更严肃的数据合规场景。

优点：

- 官方 API 文档明确提供沙箱、生产网关和基金净值字段。
- 支持基金代码批量调取，字段包含单位净值、累计净值、日增长率等。
- 更适合作为正式小程序后台服务的数据源候选。

风险：

- 需要平台账号、服务开通和可能的商务流程。
- 价格、调用额度、展示授权需要进一步确认。
- 接入流程比 Tushare spike 重。

建议定位：

- 如果只是内测：先不用。
- 如果准备公开体验版或收费报告：优先和这类正式数据供应商确认授权。

### 3. GoldAPI.net：黄金第二阶段

适合范围：

- 国际现货黄金、白银、铂金、钯金。
- 用 XAU/USD 或 XAU/CNY 做“商品/黄金估值”。

优点：

- API 简单，支持金属代码和货币代码。
- 官方文档明确要求保护 API key，不暴露在客户端。
- 免费额度足够做每日估值验证。

风险：

- 它不是上海金、银行积存金或具体金店价格。
- UI 必须展示 source 和单位，例如“GoldAPI.net XAU/CNY，国际现货估值”。
- 如果用户记录的是国内黄金产品，需要增加单位换算和差异说明。

建议 env：

```text
QUOTE_PROVIDER_MODE=goldapi
GOLDAPI_KEY=<backend-only>
GOLDAPI_BASE_URL=https://app.goldapi.net
QUOTE_CACHE_TTL_SECONDS=3600
```

### 4. Twelve Data / Tiingo / Alpha Vantage：股票与海外 ETF 后置

适合范围：

- 美股、全球股票、全球 ETF、部分共同基金或商品数据。
- 日终或延迟估值。

不作为第一接入的原因：

- 当前用户最自然的资产记录入口是中国基金/ETF、现金和黄金。
- 股票行情授权、实时/延迟展示、交易所数据政策更复杂。
- 容易让产品被误解成交易工具。

备选策略：

- 海外 ETF / 美股：优先 Tiingo EOD 或 Twelve Data Business/Individual，按日终估值处理。
- Alpha Vantage：适合开发者验证，但免费额度和商业展示限制需要谨慎处理。
- 中国 A 股：如果后续接入，也优先做日终估值，不做实时盯盘。

### 5. 债券：MVP 暂缓

短期处理：

- 债券基金：按基金 / ETF 日净值处理。
- 手动录入的个券债券：保留 manual fallback。

原因：

- 个券债券估值来源、收益率曲线、估值口径、流动性和授权都更复杂。
- Cbonds 等数据源更偏企业/专业数据服务，适合后续付费商业化阶段评估。

## 真实接入前置条件

任何 provider 都必须满足：

1. key 只在后端环境变量或 secret manager 中配置。
2. 小程序只请求自己的 HTTPS quote-service。
3. 微信公众平台配置合法 request 域名。
4. provider 返回值统一映射为：

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

5. 失败时保留原持仓和旧价格，只更新 `quoteStatus` 与 `quoteMessage`。
6. UI 必须展示 source、priceTime、status。
7. 文案必须继续说明“仅用于资产记录和退休进度测算，不构成投资建议”。

## 下一阶段 AI 工作流

下一阶段建议命名：

```text
phase_10_fund_nav_provider_spike
```

AI 可直接执行的任务：

1. 新增 `quote-service/providers/tushare-provider.js`。
2. 新增 `quote-service/providers/provider-registry.js`。
3. 增加 Tushare fixture：
   - 成功基金净值。
   - 无效代码。
   - 缺字段。
   - provider 限频或错误。
4. 增加 tests：
   - provider contract。
   - valuation preview 使用真实 provider adapter stub。
   - 失败保留旧价。
   - 不泄露 token。
5. 更新 `quote-service/README.md` 和 `docs/quote-valuation-architecture.md`。

用户最少动作：

1. 确认选用 Tushare 作为工程 spike，或改选恒生 LIGHT 云。
2. 后端本地临时配置 token，例如：

```powershell
$env:QUOTE_PROVIDER_MODE = "tushare"
$env:TUSHARE_TOKEN = "<your-token>"
```

3. 启动本地 quote-service：

```powershell
node quote-service\server.js
```

4. 本地验证单条基金估值：

```powershell
Invoke-RestMethod "http://127.0.0.1:8010/api/quotes?type=fund&code=000300"
```

5. 不把 token 发给小程序前端，不提交 `.env`。

## 来源链接

- [Tushare Pro 公募基金净值 fund_nav](https://tushare.pro/document/2?doc_id=119)
- [Tushare Pro 积分与频次权限对应表](https://tushare.pro/document/1?doc_id=290)
- [Tushare Pro 入门：注册、获取 token、调取数据](https://tushare.pro/document/1?doc_id=37)
- [恒生 LIGHT 云：基金净值指标 performance/net_value](https://ufx.hs.net/wiki/api/1130_gildatafund_v1_performance_net_value.html)
- [恒生 LIGHT 云：基金净值查询 smartfaisfund/fund_netvalue_report](https://www.hs.net/wiki/api/1586_gildatafais_v1_smartfaisfund_fund_netvalue_report.html)
- [GoldAPI.net 文档](https://goldapi.net/docs)
- [GoldAPI.net 支持与额度说明](https://goldapi.net/support)
- [Twelve Data Business Pricing](https://twelvedata.com/pricing-business)
- [Tiingo End-of-Day Stock Price Data API](https://www.tiingo.com/documentation/end-of-day)
- [Alpha Vantage API Documentation](https://www.alphavantage.co/documentation/)
- [Cbonds API 目录](https://cbonds.hk/api/catalog/folders/)
- [微信小程序网络能力文档](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)
