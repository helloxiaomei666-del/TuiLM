# 微信小程序 MVP 数据结构与页面拆分

当前 Demo 优先收敛到微信小程序 MVP。原因是现有产品已经按移动端信息架构组织，迁移到小程序比直接完整复刻 iOS App 风险更低。

## 页面拆分

### 总览页

承载问题：“今天，您退休了吗？”

展示：

- 当前退休进度。
- 预计退休时间。
- 可投资资产。
- 每月可投入。
- 今日资产变化。
- 最重要提醒。

### 资产页

展示和录入：

- 现金。
- 基金/股票。
- 债券。
- 商品。
- mock 或真实行情刷新结果。
- 截图 OCR 待确认结果。

### 路线图页

展示：

- 未来资产路线。
- 退休目标线。
- 达成点。
- 年份检查卡。
- 对比方案。

### 拖累项与报告页

展示：

- 房贷、车贷、医疗、其他支出。
- 可复盘拖累项。
- 计算提示。
- 可分享报告文案。

## 数据集合

### userProfile

```json
{
  "age": 28,
  "target": 3000000,
  "salary": 18000,
  "sideIncome": 2000,
  "livingCost": 8500,
  "salaryHistory": [14500, 15800, 17000, 18000],
  "createdAt": "2026-06-04T00:00:00.000Z",
  "updatedAt": "2026-06-04T00:00:00.000Z"
}
```

### holdings

```json
{
  "id": "stock-fund-sample",
  "type": "stock",
  "instrument": "fund",
  "name": "沪深300指数基金",
  "code": "000300",
  "quantity": 70000,
  "costPrice": 1.1714,
  "currentPrice": 1.2286,
  "currentValue": 86002,
  "costAmount": 81998,
  "todayPnl": -585,
  "updatedAt": "2026-06-04 19:00",
  "source": "manual",
  "quoteEndpoint": "/api/quotes/equity-fund"
}
```

### manualDrags

```json
{
  "id": "manual-drag-1",
  "category": "other",
  "title": "长期固定支出",
  "amount": 1200,
  "detail": "用户手动录入",
  "createdAt": "2026-06-04T00:00:00.000Z"
}
```

### securityAccounts

```json
{
  "pension": {
    "balance": 120000,
    "yearsPaid": 12,
    "personalMonthly": 900,
    "employerMonthly": 1800,
    "estimatedMonthlyBenefit": 2600
  },
  "housingFund": {
    "balance": 85000,
    "personalMonthly": 1200,
    "employerMonthly": 1200,
    "loanOffsetMonthly": 0
  },
  "supplementalHousingFund": {
    "balance": 20000,
    "personalMonthly": 400,
    "employerMonthly": 400,
    "loanOffsetMonthly": 0
  },
  "enterpriseAnnuity": {
    "balance": 30000,
    "personalMonthly": 200,
    "employerMonthly": 300,
    "estimatedMonthlyBenefit": 300
  },
  "occupationalAnnuity": {
    "balance": 0,
    "personalMonthly": 0,
    "employerMonthly": 0,
    "estimatedMonthlyBenefit": 0
  }
}
```

### calculationSnapshots

```json
{
  "id": "snapshot-20260604",
  "currentAssets": 300000,
  "monthlyInvestable": 11500,
  "progress": 10,
  "freedomMonths": 180,
  "reached": true,
  "annualReturn": 5.03,
  "salaryGrowth": 7.47,
  "summary": "当前进度 10.0%，预计 15 年后达成。",
  "createdAt": "2026-06-04T00:00:00.000Z"
}
```

## OCR 确认状态

截图识别结果不直接写入 `holdings`，先进入待确认状态。

```json
{
  "id": "ocr-pending-1",
  "assetType": "stock",
  "imageLocalPath": "cloud://...",
  "recognizedFields": {
    "name": "沪深300指数基金",
    "code": "000300",
    "quantity": 1000,
    "currentPrice": 1.25
  },
  "status": "pending_user_confirmation",
  "createdAt": "2026-06-04T00:00:00.000Z"
}
```

只有当用户确认后，才生成或更新 `holdings`。
