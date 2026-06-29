# Phase 12 真实估值 API 供应商选择

检查日期：2026-06-13

本阶段的目标不是立刻接入某个行情源，而是在 Tushare 权限不足后，重新选择一条可执行的数据源路线。系统仍只服务于个人资产记录、每日估值和退休进度测算，不做买卖建议、产品推荐、收益承诺或自动交易。

## 当前结论

Tushare 已验证为“链路可通、账号权限不足”：

- `fund_nav` 返回 `permission_denied`。
- `fund_daily` 返回 `permission_denied`。
- 当前代码已经能把权限不足归一为 `provider_permission_denied`，并保留上次估值。

所以 phase 12 不应继续围绕 Tushare 空转。下一步应转为“申请或试用可用数据源，然后让 AI 实现对应 provider adapter”。

## 推荐路线

| 优先级 | 路线 | 适合阶段 | AI 可做 | 用户最少动作 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 1 | 恒生 LIGHT 云 / 聚源基金净值接口 | 公开体验版、商业化前验证 | 按官方字段实现 `hs-light-provider.js` fixture、缓存和错误兜底 | 注册/申请服务，确认价格和展示授权 | 最适合作为正式候选，但需要商务或平台开通 |
| 2 | 聚宽 JQData / HTTP-JQData | 工程试用、数据字段验证 | 实现 `jqdata-provider.js` 或后端桥接层，准备 fixture tests | 申请试用或购买，确认可否用于小程序展示 | 技术可行，但试用数据可能不含最近 3 个月，不一定能验证“每日估值” |
| 3 | 东财掘金量化 / Choice 类接口 | 正式金融数据候选 | 研究 API 认证和字段映射，做 adapter stub | 申请账号，确认授权、价格、展示限制 | 覆盖基金实时/历史数据，但偏专业数据服务 |
| 4 | Tushare Pro | 已有代码骨架，等待权限 | 保持 provider、权限探测和兜底 | 开通 `fund_nav` 或 `fund_daily` 权限 | 权限开通后最快继续 |
| 5 | iTick Fund API | 海外/港美/ETF 试验候选 | 做独立 adapter spike，限制为估值用途 | 注册试用，确认中国基金覆盖和商用展示 | 文档偏实时交易行情，不作为首选 |
| 6 | 聚合数据基金净值 | 低优先级候选 | 暂不实现，只保留观察 | 确认接口是否恢复维护 | 官方页面显示维护中，不适合作为当前首选 |
| 7 | Metals-API / GoldAPI | 黄金估值第二阶段 | 做 `gold-provider.js`，单位换算和异常值校验 | 申请 key，确认价格、额度、展示授权 | 适合黄金资产，不能替代基金/ETF |

## 第一选择：恒生 LIGHT 云

适合原因：

- 官方文档提供基金净值指标接口，字段包含 `unit_nv`、`trading_date`、日增长率和复权单位净值。
- 支持 `.OF`、`.SH`、`.SZ` 代码，并支持多个基金代码用逗号批量调取。
- 官方文档列出沙箱和生产网关，适合做后端 provider。

AI 下一步可做：

1. 新增 `quote-service/providers/hs-light-provider.js`。
2. 先不连真实网络，只根据官方返回示例写 fixture tests。
3. 将 `unit_nv` 映射为 `quote.price`，`trading_date` 映射为 `priceTime`。
4. 增加 `QUOTE_PROVIDER_MODE=hs-light`、`HS_LIGHT_APP_KEY`、`HS_LIGHT_APP_SECRET` 等后端环境变量占位。
5. 加入权限不足、认证失败、限频、空数据、缺字段测试。

用户只需要做：

1. 申请恒生 LIGHT 云账号或服务。
2. 问清楚“是否允许在微信小程序里展示给用户做个人资产估值”。
3. 问清楚“是否允许后端缓存每日净值，缓存多久”。
4. 拿到沙箱或正式调用方式后，只在本机或云端后端配置密钥，不发给前端。

## 第二选择：聚宽 JQData / HTTP-JQData

适合原因：

- 官方数据字典明确包含场内基金数据和场外基金数据。
- 场内基金覆盖 ETF、LOF、分级基金、货币基金等；场外基金提供单位净值、复权净值、投资组合等。
- 有试用和正式授权路径。

限制：

- 试用账号可能只能取距今 15 个月前到距今 3 个月前的数据，不能验证“今天/昨天”的每日估值。
- 标准 JQData 更偏 Python SDK 或本地量化数据服务；如果要接 Node quote-service，优先确认 HTTP-JQData 是否可用。
- 必须确认授权范围是否允许对小程序用户展示。

AI 下一步可做：

1. 先写 `jqdata-provider.js` 的接口合约和 fixture tests。
2. 如果只有 Python SDK，则做后端桥接方案，不让小程序直接接 JQData。
3. 如果有 HTTP-JQData，则直接在 Node quote-service 内实现 adapter。
4. 默认只按日终净值刷新，不做实时行情。

用户只需要做：

1. 申请试用或正式授权。
2. 问清楚是否有 HTTP API。
3. 问清楚最近净值、商用展示和缓存限制。

## 不推荐当前硬接的路线

- 天天基金、东方财富网页接口、非官方 JS 接口：不适合做小程序公开服务的数据源。
- AKShare：适合研究字段和验证思路，不适合作为生产授权数据源。
- 聚合数据基金净值：官方页面当前显示维护中，接口参数、计费、更新频率信息不完整。
- 实时股票行情：授权、交易所规则和产品误解风险更高，当前产品不做交易工具，应后置。
- 个券债券估值：数据口径复杂，先保留 manual fallback 或把债券基金当基金净值处理。

## AI 主体工作流

下一阶段建议命名：

```text
phase_13_provider_trial_application_and_adapter_spike
```

AI 直接执行：

1. 根据本文件为恒生 LIGHT 云、JQData、东财掘金分别生成“申请/咨询问题清单”。
2. 为第一候选 provider 写 adapter stub 和 fixture tests。
3. 更新 `provider-registry.js`，但默认仍为 `mock`。
4. 增加 provider 专属错误码映射：
   - `provider_auth_error`
   - `provider_permission_denied`
   - `provider_rate_limited`
   - `quote_not_found`
   - `provider_unavailable`
5. 扩展 `scripts/*probe*.js`，只输出权限状态，不输出密钥。
6. 成功拿到真实响应后，基于响应 JSON 补 contract tests，再接真实 adapter。

用户只做：

1. 选择先申请哪家，建议先问恒生 LIGHT 云，再问 JQData。
2. 在服务商后台完成账号/实名认证/试用申请。
3. 把服务商文档链接或脱敏响应结构发给 AI。
4. 只在本地 PowerShell 或云端环境变量里配置密钥，不截图、不粘贴到聊天、不提交 git。

## 供应商咨询问题模板

复制给服务商即可：

```text
我们在开发一个微信小程序，用于个人资产记录、每日估值和退休进度测算。
产品不提供交易下单、买卖建议、收益承诺或自动交易。

想确认贵方基金/ETF 净值或日终估值接口是否支持：
1. 微信小程序后端服务调用。
2. 向用户展示基金名称、代码、单位净值、更新时间、数据来源。
3. 后端按交易日缓存净值数据。
4. 商业化小程序或付费报告中的数据展示。
5. 沙箱或测试环境。
6. 频率限制、每日调用上限和价格。
7. 必须展示的版权/来源文案。

我们不会在小程序前端保存 API key，只会由自有 HTTPS 后端调用。
```

## 验收标准

- 不再继续尝试无权限的 Tushare 接口，除非用户开通权限。
- 至少确定一个“可申请/可试用”的正式数据源候选。
- 真实 provider 接入前只写 adapter stub、fixture tests 和文档。
- 任何 key、token、secret 都只存在后端环境变量或 secret manager。
- 小程序仍默认 local/mock，可继续演示和测试。

## 官方资料

- [Tushare Pro 公募基金净值 fund_nav](https://tushare.pro/document/2?doc_id=119)
- [Tushare Pro ETF 日线 fund_daily](https://tushare.pro/document/2?doc_id=127)
- [Tushare Pro 权限说明](https://tushare.pro/document/1?doc_id=108)
- [Tushare Pro 积分与频次权限表](https://tushare.pro/document/1?doc_id=290)
- [恒生 LIGHT 云：基金净值指标 performance/net_value](https://ufx.hs.net/wiki/api/1130_gildatafund_v1_performance_net_value.html)
- [恒生 LIGHT 云：基金净值查询 fund_netvalue_report](https://www.hs.net/wiki/api/1586_gildatafais_v1_smartfaisfund_fund_netvalue_report.html)
- [聚宽数据字典](https://www.joinquant.com/data)
- [聚宽 JQData 试用](https://www.joinquant.com/help/api/doc?id=9830&name=logon)
- [聚宽用户协议](https://www.joinquant.com/help/api/doc?id=9825&name=logon)
- [东财掘金量化基金数据文档](https://emquant.18.cn/help/doc/data/%E5%9F%BA%E9%87%91.html)
- [iTick Fund Real-time Quote API](https://docs.itick.org/en/rest-api/fund/fund-quote)
- [iTick Pricing](https://itick.org/en/pricing)
- [聚合数据净值数据接口](https://www.juhe.cn/docs/api/id/25)
- [Metals-API Documentation](https://metals-api.com/documentation)
