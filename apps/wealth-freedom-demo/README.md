# 退了吗 Demo

这是一个不依赖后端的“今天您退休了吗”个人财富计算器静态 MVP。产品定位是记录资产、计算退休进度、解释资产变化；不做买卖点建议，不推荐金融产品，不承诺收益，不提供自动交易能力。

## 运行方式

推荐使用一键脚本启动本地静态服务器：

```powershell
.\start-demo.ps1
```

脚本会进入项目目录，优先使用 `127.0.0.1:8000`，如果端口被其他进程占用会自动选择后续可用端口，并验证 `index.html?preview=phone` 返回 HTTP 200。

常用链接：
- 手机端真实页面：`http://127.0.0.1:8000/index.html?preview=phone`
- 桌面调试壳：`http://127.0.0.1:8000/`
- 手机外框示意：`http://127.0.0.1:8000/mobile-preview.html`

停止服务：

```powershell
.\start-demo.ps1 -Stop
```

如需手动启动，也可以运行：

```powershell
python dev-static-server.py --host 127.0.0.1 --port 8000
```

直接打开 `index.html` 仍可使用，但外部试用反馈建议使用本地服务链接，避免文件路径和缓存造成验收差异。

## 当前已具备

- 总览页：当前进度、预计退休时间、可投资资产、每月可投入、回测收益率、工资增长率。
- 资产页：现金、基金/股票、债券、商品四类资产；支持名称、代码、持有数量、成本价、当前价录入。
- 行情 Demo：支持 mock 行情刷新，并把今日资产变化计入资产总览和退休进度。
- OCR Demo：支持截图导入占位和模拟 OCR 识别结果卡片；确认后才回填表单并允许保存，取消或未确认结果不会进入 `localStorage`。真实版本必须由用户确认后再保存。
- 保障账户：养老金、公积金、补充公积金、企业年金、职业年金不计入可投资资产，但用于演示退休缺口、预计月领取和房贷现金流支持。
- 路线图：逐月模拟未来资产，展示目标线、预计资产线、达成点和年份检查。
- 拖累项：支持手动记录房贷、车贷、医疗、其他支出，并参与退休时间模拟。
- 本地保存：持仓、手动拖累项、保障账户保存到当前浏览器 `localStorage`。
- 数据清除：页面提供“一键清除本地数据”，删除当前浏览器保存的数据。
- 计算核心：核心公式已拆到 `calculation-core.js`，可被浏览器和 Node 测试复用。

## 核心公式

```text
每月可投入 = 当前月工资 + 月副业收入 - 月生活支出 - 房贷 - 车贷 - 其他还款 - 手动拖累项

工资年化增长 = (当前月工资 / 3年前月工资)^(1/3) - 1

单年投资回测收益率 = (年末市值 - 年初市值 - 当年净投入) / (年初市值 + 当年净投入 / 2)

资产下月值 = 当前资产 * (1 + 月收益率) + 每月可投入
```

系统逐月模拟，直到可投资资产达到退休自由目标，或超过 60 年仍不可达。

## 测试

使用 Node 内置 test runner：

```bash
node --test tests/*.test.js
```

当前测试覆盖：月可投入、投资回测收益率、退休月份模拟、mock 行情刷新、OCR 确认流程、拖累项非整百金额、保障账户不计入可投资资产，以及微信小程序五个 tab 的页面级冒烟流程。

## 数据与隐私边界

当前 Demo 只使用浏览器本地 `localStorage`，不会主动上传数据。保存范围包括：

- `wealth-demo-holdings-v1`：资产持仓。
- `wealth-demo-manual-drags-v1`：手动拖累项。
- `wealth-demo-security-accounts-v1`：保障账户。

截图 OCR 目前是模拟识别。真实版本必须保证：用户选择截图、系统识别、用户确认、再回填或保存；不保存用户未确认的数据。

隐私政策与免责声明草案见 `docs/privacy-and-disclaimer-draft.md`。

## 下一平台建议

短期建议先收敛到微信小程序 MVP，因为当前 Demo 已经是移动端 Web 结构，页面拆分和数据模型迁移成本更低。

当前已新增微信小程序工程：`wechat-miniapp/`。导入和开发说明见 `docs/wechat-miniapp-development.md`。导入微信开发者工具前，推荐先运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\wechat-miniapp-preflight.ps1
```

如果要上传体验版，先用真实小程序 AppID 生成本地私有配置：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\init-miniapp-private-config.ps1 -AppId wx_your_appid_here
```

生成的 `wechat-miniapp/project.private.config.json` 已加入 `.gitignore`，不要提交真实 AppID。

iOS App 可以作为后续方向：先用 SwiftUI 迁移“计算核心 + 总览页 + 资产页”，不要直接复刻全部 Demo。

## 行情估值服务

当前小程序资产页的“刷新估值 Demo”已改为统一 quote client 架构：现金资产不请求行情，基金/商品等资产通过可插拔 adapter 刷新估值，失败时保留上次价格和持仓数据。刷新成功后，小程序会基于持仓生成当日估值快照，用于展示每日资产变动和退休进度测算，不用于交易判断。

本地 quote-service 启动方式：

```powershell
node quote-service\server.js
```

示例接口：

```text
GET http://127.0.0.1:8010/api/quotes?type=fund&code=000300
GET http://127.0.0.1:8010/api/quotes/batch?items=fund:000300,commodity:gold-demo
POST http://127.0.0.1:8010/api/valuations/preview
POST http://127.0.0.1:8010/api/valuations/snapshot
GET http://127.0.0.1:8010/api/valuations/snapshots?userId=demo
```

当前 quote-service 只返回 mock/local quote，用于验证真实 API 接入前的接口形状、错误响应、小程序估值刷新边界和每日估值快照流程。`POST /api/valuations/snapshot` 会把本地快照写入 `.runtime/valuation-snapshots.json`；`.runtime/` 已被忽略，不应提交。

小程序前端不应直接请求第三方行情 API，也不要写入任何 API key；正式环境需要通过自己的 HTTPS 后端中转，并在微信公众平台配置合法 request 域名。详细架构和真实 API 接入 checklist 见 `docs/quote-valuation-architecture.md`，每日估值监控主文档见 `docs/daily-valuation-architecture.md`。
