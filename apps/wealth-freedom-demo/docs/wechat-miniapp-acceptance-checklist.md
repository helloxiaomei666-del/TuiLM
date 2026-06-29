# 微信小程序试用验收清单

用于微信开发者工具导入后做真机/模拟器验收。当前仓库内无法替代微信账号、AppID、上传体验版和真机扫码步骤。

## 导入前

在仓库根目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\wechat-miniapp-preflight.ps1
node scripts/validate-miniapp.js
node --test tests/*.test.js
```

验收：

- 预检脚本通过；如果单独运行验证命令，结构验证和全部测试也都通过。
- `git status --short` 没有未提交业务改动。
- 如需上传体验版，已运行 `powershell -ExecutionPolicy Bypass -File scripts\init-miniapp-private-config.ps1 -AppId wx_your_appid_here`，并确认 `wechat-miniapp/project.private.config.json` 只保存在本地。

## 导入开发者工具

1. 打开微信开发者工具。
2. 导入目录：`C:\Users\18955\Desktop\Codex_work\ios_app\wealth-freedom-demo\wechat-miniapp`
3. 选择小程序项目。
4. 先用模拟器运行，再做真机预览。

验收：

- 编译无阻断错误。
- 底部出现 5 个 tab：总览、资产、保障、路线、拖累项。
- 页面没有明显文字重叠、按钮遮挡或横向溢出。

## 游客模式控制台说明

游客模式下，微信开发者工具可能输出以下工具链内部日志或错误：

- `webapi_getwxaasyncsecinfo:fail`
- `Error: timeout`，且调用栈只包含 `WAServiceMainContext.js`
- `wx.operateWXData 是受限的`
- `SharedArrayBuffer will require cross-origin isolation`
- `WAServiceMainContext.js ... was preloaded ...`

这些信息来自微信开发者工具运行时或游客模式限制，不指向本项目文件。只要页面能编译、五个 tab 能切换、核心操作能完成，可先记录为工具环境噪音。若红色错误包含 `pages/`、`utils/`、`app.js`、`TypeError`、`ReferenceError` 或 `Cannot read`，才按项目代码问题处理并截图反馈。

## 总览页

操作：

- 修改年龄、目标、工资、副业收入、生活支出。
- 点击“恢复示例”。
- 点击“清除数据”。
- 进入“隐私与免责声明”页面并返回。

验收：

- 修改输入后退休进度、预计时间、每月可投入同步变化。
- 恢复示例后回到默认数据。
- 清除数据后重新加载默认示例。
- 隐私与免责声明页面可打开，且文案包含本地存储、OCR 确认、非金融建议边界。

## 资产页

操作：

- 添加现金资产。
- 添加基金/债券/商品资产。
- 删除一笔资产。
- 点击 mock 行情刷新。
- 点击模拟 OCR，确认回填，再保存。
- 点击模拟 OCR，取消后确认没有保存。

验收：

- 添加/删除后总览可投资资产同步变化。
- mock 行情刷新会改变今日变化。
- OCR 未确认时不得保存；确认后只回填用户可检查的字段。
- 页面不出现买入、卖出、加仓、减仓或产品推荐表达。

## 保障页

操作：

- 修改养老金、公积金、补充公积金、企业年金、职业年金数字。
- 返回总览页。

验收：

- 保障账户总额变化。
- 总览显示保障支持说明。
- 可投资资产不因保障账户变化而增加。

## 路线页

操作：

- 拖动年份 slider。
- 查看年度节点列表。

验收：

- 选中年份、预计资产、目标差额、当年每月可投同步变化。
- 图表信息不空白，不出现溢出。

## 拖累项页

操作：

- 添加医疗、房贷、车贷、其他拖累项。
- 金额输入 `123.45` 这类非整百数字。
- 删除拖累项。
- 返回总览页。

验收：

- 非整百金额可保存。
- 添加后每月可投入下降。
- 删除后每月可投入恢复。

## 失败处理

如果开发者工具报错：

- 截图或复制错误文本。
- 记录所在页面和刚执行的操作。
- 保留当前 `git status --short` 输出。
- 交给 Codex 继续修复。
