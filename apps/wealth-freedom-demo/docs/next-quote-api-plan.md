# 下一阶段工作计划：资产估值系统真实接入准备

## 目标

把“退了吗”微信小程序的资产估值系统从本地 mock 架构推进到可安全接入真实行情 API 的工程状态。下一阶段仍然只服务于个人资产记录和退休进度测算，不做交易工具。

明确不做：

- 不提供买入、卖出、加仓、减仓等交易建议。
- 不推荐具体金融产品。
- 不承诺收益。
- 不提供自动交易能力。
- 不把第三方 API key 写进小程序前端或 git。

## 当前基线

已完成：

- 小程序 MVP 可运行，资产页支持手动录入、删除、OCR 待确认回填。
- `quote-service/` 已有本地 Node quote-service 骨架。
- `wechat-miniapp/utils/quote-client.js` 已有 local mock adapter 和未来 `wx.request` adapter。
- 资产页已显示估值来源、更新时间、状态和失败提示。
- `scripts/wechat-miniapp-preflight.ps1` 可一键跑结构验证、测试、语法检查。
- 当前 `project.config.json` 仍为 `touristappid`，`project.private.config.json` 保持本地 ignored。

当前限制：

- 未接真实行情 API。
- 未配置真实 AppID 和正式 request 合法域名。
- 微信开发者工具游客模式可能产生 `WAServiceMainContext`、`webapi_getwxaasyncsecinfo`、`wx.operateWXData` 等工具噪音。
- quote-service 当前只返回本地 mock quote。

## 阶段 1：真实开发者工具与 AppID 验证

目标：确认小程序在真实开发者工具环境里可稳定编译、预览和运行，不把游客模式噪音误判为项目问题。

任务：

1. 运行本地预检：
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\wechat-miniapp-preflight.ps1
   ```
2. 准备真实 AppID：
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\init-miniapp-private-config.ps1 -AppId <real-appid>
   ```
3. 在微信开发者工具 GUI 导入：
   ```text
   C:\Users\18955\Desktop\Codex_work\ios_app\wealth-freedom-demo\wechat-miniapp
   ```
4. 按 `docs/wechat-miniapp-acceptance-checklist.md` 逐页验收。
5. 记录所有真正指向 `pages/`、`utils/`、`app.js` 的错误；忽略纯 `WAServiceMainContext` 工具链噪音。

验收标准：

- 小程序编译通过。
- 五个 tab 可切换。
- 资产页可新增、删除、刷新估值、OCR 确认回填。
- 刷新估值不清空持仓。
- 控制台不再出现项目文件级别的 `Cannot find module`、`TypeError`、`ReferenceError`。
- `wechat-miniapp/project.private.config.json` 不入 git。

风险：

- 本机可能没有 WeChat DevTools CLI，只能 GUI 验证。
- 游客模式会产生工具噪音。
- 真机和模拟器表现可能有差异。

## 阶段 2：quote-service 后端生产化骨架

目标：把本地 quote-service 从 mock HTTP 服务推进到可部署的后端边界，但仍不接真实 provider key。

任务：

1. 增加后端配置读取：
   - `QUOTE_SERVICE_PORT`
   - `QUOTE_SERVICE_ALLOWED_ORIGIN`
   - `QUOTE_PROVIDER_MODE=mock|provider`
   - `QUOTE_CACHE_TTL_SECONDS`
2. 拆分 provider adapter：
   - `providers/mock-provider.js`
   - `providers/provider-registry.js`
   - 预留 `providers/fund-provider.js`、`providers/gold-provider.js`
3. 增加统一错误模型：
   - `missing_code`
   - `unsupported_type`
   - `provider_timeout`
   - `provider_rate_limited`
   - `quote_not_found`
4. 增加内存缓存与 TTL。
5. 增加 provider 超时控制。
6. 增加服务健康检查：
   ```text
   GET /health
   ```

验收标准：

- 本地 `node quote-service\server.js` 可启动。
- `/health` 返回服务状态。
- mock provider 仍能返回标准 quote。
- 错误响应保持稳定 JSON 结构。
- 测试不依赖真实网络。
- 不出现任何真实 API key。

风险：

- 后端结构过早复杂化。
- 缓存逻辑可能掩盖 provider 错误。
- 端口可能与静态 demo 服务冲突。

## 阶段 3：小程序 quote client 配置化

目标：让小程序能在不改业务代码的情况下，在 local mock 和 HTTPS quote-service 之间切换。

任务：

1. 新增小程序侧配置文件，例如：
   ```text
   wechat-miniapp/utils/quote-config.js
   ```
2. 支持模式：
   - `local`：默认测试模式，不请求网络。
   - `wx-request`：请求自己的 quote-service。
3. 支持后端 base URL 配置，但不允许第三方 provider URL。
4. 增加配置校验：
   - 正式模式必须是 `https://`。
   - 禁止 URL 中出现 `key=`、`token=`、`secret=`。
5. 更新测试覆盖：
   - local 模式成功刷新。
   - wx-request 模式请求自有后端。
   - 后端失败保留旧值。
   - cash 不请求。

验收标准：

- 默认游客模式仍可使用 local adapter。
- 切换 wx-request 不需要改资产页。
- 失败路径保留持仓和上次价格。
- 页面继续显示来源、时间和状态。

风险：

- 小程序 request 合法域名限制必须等真实 HTTPS 域名后才能完整验证。
- 开发者工具热重载可能缓存旧文件，需要清缓存重编译。

## 阶段 4：基金 / ETF 净值接入

目标：优先接入最适合资产记录场景的基金/ETF 净值，而不是高频交易行情。

任务：

1. 选择合规 provider，并确认授权范围、延迟、频率限制和展示要求。
2. 后端环境变量保存 provider key。
3. 实现 fund provider adapter。
4. quote-service 输出统一 quote：
   ```json
   {
     "assetType": "fund",
     "price": 1.2345,
     "priceTime": "provider time",
     "source": "provider display name",
     "status": "ok",
     "message": "基金净值估值"
   }
   ```
5. 增加缓存策略：基金净值按交易日或 provider 更新周期缓存。
6. 增加 provider contract tests，使用 fixture，不打真实网络。

验收标准：

- 有效基金代码返回真实或 fixture quote。
- 无效代码返回 `quote_not_found`。
- provider 失败时小程序保留旧值。
- UI 明确展示 source 和 priceTime。
- 文案不出现交易建议。

风险：

- provider 数据延迟可能被用户误认为实时行情。
- 基金代码格式与不同市场产品类型存在差异。
- provider 授权条款可能限制展示或缓存。

## 阶段 5：黄金估值接入

目标：为商品/黄金资产提供估值刷新能力，仍仅用于资产记录和退休测算。

任务：

1. 明确黄金估值单位：
   - CNY/gram
   - 或 provider 原始单位加转换说明。
2. 后端增加 gold provider adapter。
3. 增加单位和异常值校验。
4. 小程序商品/黄金持仓显示来源和更新时间。
5. 增加测试：
   - 正常黄金 quote。
   - 单位转换。
   - 异常价格拒绝或标记 error。

验收标准：

- `commodity` / `gold` 持仓可刷新估值。
- 单位在文档和代码注释中清楚。
- 异常 quote 不覆盖旧价格。
- 不输出买卖建议。

风险：

- 黄金数据源单位差异大。
- 汇率和交易所价格可能导致用户误解。
- 需要明确展示延迟和来源。

## 阶段 6：体验版验收与发布前合规检查

目标：形成可交给外部试用的体验版候选。

任务：

1. 运行完整预检。
2. 微信开发者工具中上传体验版。
3. 真机扫码验证资产页核心路径。
4. 检查隐私和免责声明。
5. 检查网络域名配置。
6. 检查无 key、日志、`.runtime`、`project.private.config.json` 入库。

验收标准：

- 体验版可打开。
- 资产记录、刷新估值、OCR 确认、删除均可用。
- quote-service 失败时页面保留旧数据。
- 免责声明仍明确不构成投资建议、不承诺收益。

风险：

- 微信审核和域名备案/证书配置属于外部流程。
- 真机网络环境可能暴露模拟器没有的问题。

## 全局验证命令

每次阶段性改动后运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\wechat-miniapp-preflight.ps1
```

如果只改 quote-service：

```powershell
node --test tests\quote-service.test.js
node --check quote-service\server.js
```

如果只改小程序 quote client：

```powershell
node --test tests\quote-client.test.js tests\wechat-miniapp-page-smoke.test.js tests\wechat-miniapp.test.js
```

提交前检查：

```powershell
git status --short --ignored
rg -n "api[_-]?key\s*[:=]|access[_-]?token\s*[:=]|secret\s*[:=]|sk-[A-Za-z0-9]|AKIA[0-9A-Z]{16}" . -g "!*.png" -g "!*.jpg" -g "!*.jpeg" -g "!.git/**" -g "!.runtime/**"
```

## 下一步建议

优先执行阶段 1。原因是本地代码预检已通过，真实 AppID、开发者工具导入、合法 request 域名和真机体验是后续真实 API 接入前必须确认的外部条件。
