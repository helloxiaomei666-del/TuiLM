# 微信小程序开发说明

当前小程序工程位于 `wechat-miniapp/`，用于把 Web Demo 迁移成可外部试用反馈的微信小程序 MVP。

## 如何打开

1. 打开微信开发者工具。
2. 选择“导入项目”。
3. 项目目录选择：`C:\Users\18955\Desktop\Codex_work\ios_app\wealth-freedom-demo\wechat-miniapp`
4. 没有 AppID 时可先使用测试号或游客模式；当前 `project.config.json` 使用 `touristappid`。
5. 需要上传体验版时，先在仓库根目录运行 `powershell -ExecutionPolicy Bypass -File scripts\init-miniapp-private-config.ps1 -AppId wx_your_appid_here`，生成本地 `wechat-miniapp/project.private.config.json`。

## 当前已完成

- 5 个 tab 页面：总览、资产、保障、路线、拖累项。
- 计算核心迁移到 `wechat-miniapp/utils/calculation-core.js`。
- 本地存储封装：`wechat-miniapp/utils/storage.js`。
- 总览页：输入年龄、目标、工资、副业、生活支出，并实时计算退休进度。
- 资产页：添加、删除、mock 行情刷新；OCR Demo 使用“待确认结果卡片”，确认后才回填。
- 拖累项页：添加、删除，支持非整百金额，并参与退休时间模拟。
- 保障账户页：养老金、公积金、补充公积金、企业年金、职业年金录入；不计入可投资资产，但参与退休缺口和房贷现金流支持展示。
- 路线页：年度 slider、预计资产、目标差额、当年每月可投。
- 数据清除入口：总览页可清除本地数据并恢复默认示例。
- 隐私与免责声明页：总览页可进入，说明本地存储、OCR 确认和非金融建议边界。

## 验证命令

在仓库根目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\wechat-miniapp-preflight.ps1
node scripts/validate-miniapp.js
node --test tests/*.test.js
```

`wechat-miniapp-preflight.ps1` 会串联小程序结构验证、全部自动测试、JS 语法检查、JSON 解析检查，并提示本机是否能找到微信开发者工具 CLI。`validate-miniapp.js` 会在导入微信开发者工具前检查页面文件、组件引用、`require` 路径、tab 图标、无真实网络请求、兼容性语法和合规入口。测试命令会覆盖小程序工程结构、核心计算、本地存储、资产、拖累项、保障账户、路线模型，以及五个 tab 的页面级冒烟流程。

## 当前边界

- 仍然只使用本地存储，不使用云数据库。
- 行情刷新仍是 mock，不接真实 API。
- OCR 仍是模拟识别，不上传图片，不调用真实后端。
- 不做买入、卖出、加仓、减仓、收益承诺或金融产品推荐。
- 真实 AppID 只写入本地 `project.private.config.json`，该文件不入库。

## 下一阶段

1. 用微信开发者工具导入并做真机预览。
2. 按 `docs/wechat-miniapp-acceptance-checklist.md` 做逐页验收。
3. 按真机效果修正 WXML/WXSS 布局。
4. 将隐私与免责声明草案交给专业人士复核，准备正式上线文本。
5. 再决定是否接云开发、真实行情和真实 OCR。
