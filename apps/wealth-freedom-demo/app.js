const form = document.querySelector("#calculatorForm");
const resetButton = document.querySelector("#resetButton");
const clearDataButton = document.querySelector("#clearDataButton");
const phonePreview = document.querySelector("#phonePreview");
const mobileTabbar = document.querySelector(".mobile-tabbar");
const pageParams =
  typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
const isPhonePreview = pageParams.get("preview") === "phone";
const holdingsStorageKey = "wealth-demo-holdings-v1";
const manualDragsStorageKey = "wealth-demo-manual-drags-v1";
const securityAccountsStorageKey = "wealth-demo-security-accounts-v1";
const pensionYearsTarget = 20;
const calc = window.WealthCalculation;

if (!calc) {
  throw new Error("calculation-core.js must load before app.js");
}

const defaults = {
  age: 28,
  target: 3000000,
  cash: 120000,
  investments: 180000,
  salary: 18000,
  sideIncome: 2000,
  livingCost: 8500,
  mortgage: 0,
  carLoan: 0,
  otherDebt: 0,
  salaryYear3: 14500,
  salaryYear2: 15800,
  salaryYear1: 17000,
  assetStart3: 60000,
  assetEnd3: 92000,
  assetContribution3: 28000,
  assetStart2: 92000,
  assetEnd2: 134000,
  assetContribution2: 36000,
  assetStart1: 134000,
  assetEnd1: 180000,
  assetContribution1: 39000,
};

const defaultAssetHoldings = [
  {
    id: "cash-sample",
    type: "cash",
    name: "现金账户",
    platform: "手动账户",
    quantity: 1,
    costPrice: 120000,
    currentPrice: 120000,
    currentValue: 120000,
    costAmount: 120000,
    todayPnl: 0,
    updatedAt: "示例初始",
    source: "手动录入",
    apiProvider: "cash.manual",
  },
  {
    id: "stock-fund-sample",
    type: "stock",
    instrument: "fund",
    name: "沪深300指数基金",
    platform: "支付宝 / 基金账户",
    code: "000300",
    quantity: 70000,
    costPrice: 1.1714,
    currentPrice: 1.2286,
    currentValue: 86002,
    costAmount: 81998,
    todayPnl: -585,
    updatedAt: "示例初始",
    source: "截图导入或手动录入",
    apiProvider: "quotes.fundNav",
    quoteEndpoint: "/api/quotes/equity-fund",
  },
  {
    id: "bond-sample",
    type: "bond",
    instrument: "bondFund",
    name: "中短债基金",
    platform: "基金账户",
    code: "bond-demo",
    quantity: 50000,
    costPrice: 1.18,
    currentPrice: 1.2,
    currentValue: 60000,
    costAmount: 59000,
    todayPnl: 72,
    updatedAt: "示例初始",
    source: "手动录入，待接债券基金净值 API",
    apiProvider: "quotes.bondFundNav",
    quoteEndpoint: "/api/quotes/bond",
  },
  {
    id: "commodity-gold-sample",
    type: "commodity",
    instrument: "gold",
    name: "黄金资产",
    platform: "黄金 / 商品账户",
    code: "gold-demo",
    quantity: 100,
    costPrice: 640,
    currentPrice: 660,
    currentValue: 66000,
    costAmount: 64000,
    todayPnl: 277,
    updatedAt: "示例初始",
    source: "截图导入或手动录入，待接金价 / 商品 API",
    apiProvider: "quotes.commoditySpot",
    quoteEndpoint: "/api/quotes/commodity",
  },
];

const assetCategories = {
  cash: { label: "现金", color: "#0f766e", apiProvider: "cash.manual" },
  stock: { label: "基金", color: "#2563eb", apiProvider: "quotes.equityOrFund" },
  bond: { label: "债券", color: "#8bbfb3", apiProvider: "quotes.bondOrBondFund" },
  commodity: { label: "商品", color: "#d4a72c", apiProvider: "quotes.commodity" },
};

const assetTypeOptions = [
  ["cash", "现金"],
  ["stock", "基金"],
  ["bond", "债券"],
  ["commodity", "商品"],
];

const defaultSecurityAccounts = {
  pension: {
    balance: 120000,
    yearsPaid: 12,
    personalMonthly: 900,
    employerMonthly: 1800,
    estimatedMonthlyBenefit: 2600,
  },
  housingFund: {
    balance: 85000,
    personalMonthly: 1200,
    employerMonthly: 1200,
    loanOffsetMonthly: 0,
  },
  supplementalHousingFund: {
    balance: 20000,
    personalMonthly: 400,
    employerMonthly: 400,
    loanOffsetMonthly: 0,
  },
  enterpriseAnnuity: {
    balance: 30000,
    personalMonthly: 200,
    employerMonthly: 300,
    estimatedMonthlyBenefit: 300,
  },
  occupationalAnnuity: {
    balance: 0,
    personalMonthly: 0,
    employerMonthly: 0,
    estimatedMonthlyBenefit: 0,
  },
};

const securityAccountMeta = {
  pension: { label: "养老保险", color: "#0f766e" },
  housingFund: { label: "公积金", color: "#2563eb" },
  supplementalHousingFund: { label: "补充公积金", color: "#5b8def" },
  enterpriseAnnuity: { label: "企业年金", color: "#d4a72c" },
  occupationalAnnuity: { label: "职业年金", color: "#8bbfb3" },
};

const quoteApiAdapters = {
  stock: "/api/quotes/equity-fund",
  bond: "/api/quotes/bond",
  commodity: "/api/quotes/commodity",
};

const ocrApiAdapters = {
  stock: "/api/ocr/asset-screenshot/equity-fund",
  bond: "/api/ocr/asset-screenshot/bond",
  commodity: "/api/ocr/asset-screenshot/commodity",
};

let assetHoldings = loadHoldings();
let manualDrags = loadManualDrags();
let securityAccounts = loadSecurityAccounts();
let lastQuoteRefreshImpact = null;
let mockQuoteRefreshCount = 0;
let pendingOcrResult = null;
let confirmedOcrResultId = null;

const els = {
  progressRing: document.querySelector("#progressRing"),
  progressPercent: document.querySelector("#progressPercent"),
  freedomDate: document.querySelector("#freedomDate"),
  freedomAge: document.querySelector("#freedomAge"),
  resultsPanel: document.querySelector("#resultsPanel"),
  overviewProgressValue: document.querySelector("#overviewProgressValue"),
  overviewStatusText: document.querySelector("#overviewStatusText"),
  overviewFreedomDate: document.querySelector("#overviewFreedomDate"),
  overviewGapValue: document.querySelector("#overviewGapValue"),
  overviewInvestAssetValue: document.querySelector("#overviewInvestAssetValue"),
  overviewAssetMix: document.querySelector("#overviewAssetMix"),
  overviewSecurityValue: document.querySelector("#overviewSecurityValue"),
  overviewSecuritySupport: document.querySelector("#overviewSecuritySupport"),
  overviewCashflowStatus: document.querySelector("#overviewCashflowStatus"),
  overviewCashflowCopy: document.querySelector("#overviewCashflowCopy"),
  overviewTodayChange: document.querySelector("#overviewTodayChange"),
  overviewRouteEta: document.querySelector("#overviewRouteEta"),
  overviewReminderTitle: document.querySelector("#overviewReminderTitle"),
  overviewReminder: document.querySelector("#overviewReminder"),
  currentAssets: document.querySelector("#currentAssets"),
  monthlyInvestable: document.querySelector("#monthlyInvestable"),
  backtestedReturn: document.querySelector("#backtestedReturn"),
  backtestedSalaryGrowth: document.querySelector("#backtestedSalaryGrowth"),
  assetTotalValue: document.querySelector("#assetTotalValue"),
  assetTodayPnl: document.querySelector("#assetTodayPnl"),
  assetAiSignal: document.querySelector("#assetAiSignal"),
  assetImpact: document.querySelector("#assetImpact"),
  assetDonut: document.querySelector("#assetDonut"),
  refreshQuotesButton: document.querySelector("#refreshQuotesButton"),
  holdingList: document.querySelector("#holdingList"),
  holdingForm: document.querySelector("#holdingForm"),
  holdingType: document.querySelector("#holdingType"),
  holdingInstrument: document.querySelector("#holdingInstrument"),
  holdingInputMode: document.querySelector("#holdingInputMode"),
  holdingScreenshot: document.querySelector("#holdingScreenshot"),
  screenshotImport: document.querySelector("#screenshotImport"),
  screenshotPreview: document.querySelector("#screenshotPreview"),
  screenshotStatus: document.querySelector("#screenshotStatus"),
  ocrConfirmation: document.querySelector("#ocrConfirmation"),
  ocrResultList: document.querySelector("#ocrResultList"),
  confirmOcrButton: document.querySelector("#confirmOcrButton"),
  cancelOcrButton: document.querySelector("#cancelOcrButton"),
  holdingFormTitle: document.querySelector(".asset-entry-head h3"),
  holdingFormNote: document.querySelector(".asset-entry-head span"),
  holdingSubmitButton: document.querySelector("#holdingForm button[type='submit']"),
  securityForm: document.querySelector("#securityForm"),
  securitySupportBadge: document.querySelector("#securitySupportBadge"),
  securityTotalValue: document.querySelector("#securityTotalValue"),
  securitySupportCopy: document.querySelector("#securitySupportCopy"),
  securityAccountList: document.querySelector("#securityAccountList"),
  pensionYearsText: document.querySelector("#pensionYearsText"),
  pensionProgressBar: document.querySelector("#pensionProgressBar"),
  pensionProgressText: document.querySelector("#pensionProgressText"),
  salaryBacktestResult: document.querySelector("#salaryBacktestResult"),
  returnBacktestResult: document.querySelector("#returnBacktestResult"),
  dragScore: document.querySelector("#dragScore"),
  dragList: document.querySelector("#dragList"),
  manualDragForm: document.querySelector("#manualDragForm"),
  scenarioList: document.querySelector("#scenarioList"),
  assetChart: document.querySelector("#assetChart"),
  chartInspector: document.querySelector("#chartInspector"),
  chartCaption: document.querySelector("#chartCaption"),
  gapBadge: document.querySelector("#gapBadge"),
  reportTitle: document.querySelector("#reportTitle"),
  reportSummary: document.querySelector("#reportSummary"),
};

const chartState = {
  activeScenarioId: null,
  activeYear: null,
  activePage: "overview",
  expandedCategoryKey: "stock",
  entryCategoryKey: null,
  isScrubbing: false,
  routeMeta: null,
  values: null,
  result: null,
};

function yuan(value, digits = 1) {
  const abs = Math.abs(value);
  if (abs >= 10000) {
    return `${(value / 10000).toFixed(digits)} 万`;
  }
  return `${Math.round(value).toLocaleString("zh-CN")} 元`;
}

function percent(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function clamp(value, min, max) {
  return calc.clamp(value, min, max);
}

function numberOr(value, fallback = 0) {
  return calc.numberOr(value, fallback);
}

function formatDateTime(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function progressFromAssets(assets, target) {
  return calc.progressFromAssets(assets, target);
}

function getManualDragTotal() {
  return calc.getManualDragTotal(manualDrags);
}

function getHoldingTotals(holdings = assetHoldings) {
  return calc.getHoldingTotals(holdings, { assetCategories, quoteApiAdapters });
}

function getValues() {
  const values = Object.fromEntries(
    [...new FormData(form).entries()].map(([key, value]) => [key, Number(value) || 0]),
  );
  const holdingTotals = getHoldingTotals();
  return {
    ...values,
    mortgage: 0,
    carLoan: 0,
    otherDebt: 0,
    cash: holdingTotals.cash,
    investments: holdingTotals.investments,
    manualDragOutflow: getManualDragTotal(),
  };
}

function setValues(values) {
  Object.entries(values).forEach(([key, value]) => {
    const input = form.elements[key];
    if (input) input.value = value;
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeHolding(holding) {
  return calc.normalizeHolding(holding, { assetCategories, quoteApiAdapters });
}

function loadHoldings() {
  const normalizeAll = (holdings) => holdings.map(normalizeHolding);
  if (typeof localStorage === "undefined") {
    return normalizeAll(structuredClone(defaultAssetHoldings));
  }

  try {
    const saved = localStorage.getItem(holdingsStorageKey);
    return normalizeAll(saved ? JSON.parse(saved) : structuredClone(defaultAssetHoldings));
  } catch {
    return normalizeAll(structuredClone(defaultAssetHoldings));
  }
}

function saveHoldings() {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(holdingsStorageKey, JSON.stringify(assetHoldings));
}

function loadManualDrags() {
  if (typeof localStorage === "undefined") {
    return [];
  }

  try {
    const saved = localStorage.getItem(manualDragsStorageKey);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveManualDrags() {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(manualDragsStorageKey, JSON.stringify(manualDrags));
}

function normalizeSecurityAccounts(accounts = {}) {
  return {
    pension: {
      balance: numberOr(accounts.pension?.balance, defaultSecurityAccounts.pension.balance),
      yearsPaid: numberOr(accounts.pension?.yearsPaid, defaultSecurityAccounts.pension.yearsPaid),
      personalMonthly: numberOr(accounts.pension?.personalMonthly, defaultSecurityAccounts.pension.personalMonthly),
      employerMonthly: numberOr(accounts.pension?.employerMonthly, defaultSecurityAccounts.pension.employerMonthly),
      estimatedMonthlyBenefit: numberOr(
        accounts.pension?.estimatedMonthlyBenefit,
        defaultSecurityAccounts.pension.estimatedMonthlyBenefit,
      ),
    },
    housingFund: {
      balance: numberOr(accounts.housingFund?.balance, defaultSecurityAccounts.housingFund.balance),
      personalMonthly: numberOr(accounts.housingFund?.personalMonthly, defaultSecurityAccounts.housingFund.personalMonthly),
      employerMonthly: numberOr(accounts.housingFund?.employerMonthly, defaultSecurityAccounts.housingFund.employerMonthly),
      loanOffsetMonthly: numberOr(accounts.housingFund?.loanOffsetMonthly, defaultSecurityAccounts.housingFund.loanOffsetMonthly),
    },
    supplementalHousingFund: {
      balance: numberOr(accounts.supplementalHousingFund?.balance, defaultSecurityAccounts.supplementalHousingFund.balance),
      personalMonthly: numberOr(
        accounts.supplementalHousingFund?.personalMonthly,
        defaultSecurityAccounts.supplementalHousingFund.personalMonthly,
      ),
      employerMonthly: numberOr(
        accounts.supplementalHousingFund?.employerMonthly,
        defaultSecurityAccounts.supplementalHousingFund.employerMonthly,
      ),
      loanOffsetMonthly: numberOr(
        accounts.supplementalHousingFund?.loanOffsetMonthly,
        defaultSecurityAccounts.supplementalHousingFund.loanOffsetMonthly,
      ),
    },
    enterpriseAnnuity: {
      balance: numberOr(accounts.enterpriseAnnuity?.balance, defaultSecurityAccounts.enterpriseAnnuity.balance),
      personalMonthly: numberOr(
        accounts.enterpriseAnnuity?.personalMonthly,
        numberOr(accounts.enterpriseAnnuity?.monthlyContribution, defaultSecurityAccounts.enterpriseAnnuity.personalMonthly),
      ),
      employerMonthly: numberOr(accounts.enterpriseAnnuity?.employerMonthly, defaultSecurityAccounts.enterpriseAnnuity.employerMonthly),
      estimatedMonthlyBenefit: numberOr(
        accounts.enterpriseAnnuity?.estimatedMonthlyBenefit,
        defaultSecurityAccounts.enterpriseAnnuity.estimatedMonthlyBenefit,
      ),
    },
    occupationalAnnuity: {
      balance: numberOr(accounts.occupationalAnnuity?.balance, defaultSecurityAccounts.occupationalAnnuity.balance),
      personalMonthly: numberOr(
        accounts.occupationalAnnuity?.personalMonthly,
        numberOr(accounts.occupationalAnnuity?.monthlyContribution, defaultSecurityAccounts.occupationalAnnuity.personalMonthly),
      ),
      employerMonthly: numberOr(accounts.occupationalAnnuity?.employerMonthly, defaultSecurityAccounts.occupationalAnnuity.employerMonthly),
      estimatedMonthlyBenefit: numberOr(
        accounts.occupationalAnnuity?.estimatedMonthlyBenefit,
        defaultSecurityAccounts.occupationalAnnuity.estimatedMonthlyBenefit,
      ),
    },
  };
}

function loadSecurityAccounts() {
  if (typeof localStorage === "undefined") {
    return normalizeSecurityAccounts(structuredClone(defaultSecurityAccounts));
  }

  try {
    const saved = localStorage.getItem(securityAccountsStorageKey);
    return normalizeSecurityAccounts(saved ? JSON.parse(saved) : structuredClone(defaultSecurityAccounts));
  } catch {
    return normalizeSecurityAccounts(structuredClone(defaultSecurityAccounts));
  }
}

function saveSecurityAccounts() {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(securityAccountsStorageKey, JSON.stringify(securityAccounts));
}

function getSecurityAccountsFromForm() {
  if (!els.securityForm) return normalizeSecurityAccounts(securityAccounts);
  const data = new FormData(els.securityForm);
  return normalizeSecurityAccounts({
    pension: {
      balance: Number(data.get("pensionBalance")) || 0,
      yearsPaid: Number(data.get("pensionYearsPaid")) || 0,
      personalMonthly: Number(data.get("pensionPersonalMonthly")) || 0,
      employerMonthly: Number(data.get("pensionEmployerMonthly")) || 0,
      estimatedMonthlyBenefit: Number(data.get("pensionEstimatedMonthlyBenefit")) || 0,
    },
    housingFund: {
      balance: Number(data.get("housingFundBalance")) || 0,
      personalMonthly: Number(data.get("housingFundPersonalMonthly")) || 0,
      employerMonthly: Number(data.get("housingFundEmployerMonthly")) || 0,
      loanOffsetMonthly: Number(data.get("housingFundLoanOffsetMonthly")) || 0,
    },
    supplementalHousingFund: {
      balance: Number(data.get("supplementalHousingFundBalance")) || 0,
      personalMonthly: Number(data.get("supplementalHousingFundPersonalMonthly")) || 0,
      employerMonthly: Number(data.get("supplementalHousingFundEmployerMonthly")) || 0,
      loanOffsetMonthly: Number(data.get("supplementalHousingFundLoanOffsetMonthly")) || 0,
    },
    enterpriseAnnuity: {
      balance: Number(data.get("enterpriseAnnuityBalance")) || 0,
      personalMonthly: Number(data.get("enterpriseAnnuityPersonalMonthly")) || 0,
      employerMonthly: Number(data.get("enterpriseAnnuityEmployerMonthly")) || 0,
      estimatedMonthlyBenefit: Number(data.get("enterpriseAnnuityEstimatedMonthlyBenefit")) || 0,
    },
    occupationalAnnuity: {
      balance: Number(data.get("occupationalAnnuityBalance")) || 0,
      personalMonthly: Number(data.get("occupationalAnnuityPersonalMonthly")) || 0,
      employerMonthly: Number(data.get("occupationalAnnuityEmployerMonthly")) || 0,
      estimatedMonthlyBenefit: Number(data.get("occupationalAnnuityEstimatedMonthlyBenefit")) || 0,
    },
  });
}

function setSecurityAccountValues(accounts) {
  if (!els.securityForm) return;
  const normalized = normalizeSecurityAccounts(accounts);
  const values = {
    pensionBalance: normalized.pension.balance,
    pensionYearsPaid: normalized.pension.yearsPaid,
    pensionPersonalMonthly: normalized.pension.personalMonthly,
    pensionEmployerMonthly: normalized.pension.employerMonthly,
    pensionEstimatedMonthlyBenefit: normalized.pension.estimatedMonthlyBenefit,
    housingFundBalance: normalized.housingFund.balance,
    housingFundPersonalMonthly: normalized.housingFund.personalMonthly,
    housingFundEmployerMonthly: normalized.housingFund.employerMonthly,
    housingFundLoanOffsetMonthly: normalized.housingFund.loanOffsetMonthly,
    supplementalHousingFundBalance: normalized.supplementalHousingFund.balance,
    supplementalHousingFundPersonalMonthly: normalized.supplementalHousingFund.personalMonthly,
    supplementalHousingFundEmployerMonthly: normalized.supplementalHousingFund.employerMonthly,
    supplementalHousingFundLoanOffsetMonthly: normalized.supplementalHousingFund.loanOffsetMonthly,
    enterpriseAnnuityBalance: normalized.enterpriseAnnuity.balance,
    enterpriseAnnuityPersonalMonthly: normalized.enterpriseAnnuity.personalMonthly,
    enterpriseAnnuityEmployerMonthly: normalized.enterpriseAnnuity.employerMonthly,
    enterpriseAnnuityEstimatedMonthlyBenefit: normalized.enterpriseAnnuity.estimatedMonthlyBenefit,
    occupationalAnnuityBalance: normalized.occupationalAnnuity.balance,
    occupationalAnnuityPersonalMonthly: normalized.occupationalAnnuity.personalMonthly,
    occupationalAnnuityEmployerMonthly: normalized.occupationalAnnuity.employerMonthly,
    occupationalAnnuityEstimatedMonthlyBenefit: normalized.occupationalAnnuity.estimatedMonthlyBenefit,
  };

  Object.entries(values).forEach(([key, value]) => {
    const input = els.securityForm.elements[key];
    if (input) input.value = value;
  });
}

function getSecurityAccountRows(accounts = securityAccounts) {
  const normalized = normalizeSecurityAccounts(accounts);
  return [
    {
      key: "pension",
      ...securityAccountMeta.pension,
      balance: normalized.pension.balance,
      monthly: normalized.pension.personalMonthly + normalized.pension.employerMonthly,
      detail: `已缴纳 ${normalized.pension.yearsPaid.toFixed(1).replace(/\.0$/, "")} 年，预计月领 ${yuan(normalized.pension.estimatedMonthlyBenefit)}`,
    },
    {
      key: "housingFund",
      ...securityAccountMeta.housingFund,
      balance: normalized.housingFund.balance,
      monthly: normalized.housingFund.personalMonthly + normalized.housingFund.employerMonthly,
      detail: normalized.housingFund.loanOffsetMonthly > 0 ? `每月冲还贷 ${yuan(normalized.housingFund.loanOffsetMonthly)}` : "个人与单位缴纳合计",
    },
    {
      key: "supplementalHousingFund",
      ...securityAccountMeta.supplementalHousingFund,
      balance: normalized.supplementalHousingFund.balance,
      monthly: normalized.supplementalHousingFund.personalMonthly + normalized.supplementalHousingFund.employerMonthly,
      detail:
        normalized.supplementalHousingFund.loanOffsetMonthly > 0
          ? `每月冲还贷 ${yuan(normalized.supplementalHousingFund.loanOffsetMonthly)}`
          : "可选住房保障账户",
    },
    {
      key: "enterpriseAnnuity",
      ...securityAccountMeta.enterpriseAnnuity,
      balance: normalized.enterpriseAnnuity.balance,
      monthly: normalized.enterpriseAnnuity.personalMonthly + normalized.enterpriseAnnuity.employerMonthly,
      detail: `预计月领 ${yuan(normalized.enterpriseAnnuity.estimatedMonthlyBenefit)}`,
    },
    {
      key: "occupationalAnnuity",
      ...securityAccountMeta.occupationalAnnuity,
      balance: normalized.occupationalAnnuity.balance,
      monthly: normalized.occupationalAnnuity.personalMonthly + normalized.occupationalAnnuity.employerMonthly,
      detail: `预计月领 ${yuan(normalized.occupationalAnnuity.estimatedMonthlyBenefit)}`,
    },
  ];
}

function getSecurityAccountTotal(accounts = securityAccounts) {
  return calc.getSecurityAccountTotal(accounts);
}

function getSecuritySupport(values, baseResult) {
  return calc.getSecuritySupport(values, baseResult, securityAccounts, pensionYearsTarget);
}

function addManualDragFromForm() {
  const data = new FormData(els.manualDragForm);
  const category = String(data.get("manualDragCategory") || "other");
  const customTitle = String(data.get("manualDragTitle") || "").trim();
  const categoryLabels = {
    mortgage: "房贷",
    car: "车贷",
    medical: "医疗",
    other: "其他",
  };
  const title = category === "other" && customTitle ? customTitle : categoryLabels[category] || "其他";
  const amount = Math.max(0, Number(data.get("manualDragAmount")) || 0);
  const detail = String(data.get("manualDragDetail") || "").trim();

  if (!amount) return;

  manualDrags = [
    {
      id: `manual-drag-${Date.now()}`,
      category,
      title,
      amount,
      detail,
    },
    ...manualDrags,
  ];
  saveManualDrags();
  els.manualDragForm.reset();
  update();
}

function syncHoldingTypeOptions(lockedType, selectedType) {
  if (!els.holdingType) return;
  const allowedOptions = lockedType
    ? assetTypeOptions.filter(([value]) => value === lockedType)
    : assetTypeOptions;
  const signature = allowedOptions.map(([value]) => value).join("|");

  if (els.holdingType.dataset.optionSignature !== signature) {
    els.holdingType.innerHTML = allowedOptions
      .map(([value, label]) => `<option value="${value}">${label}</option>`)
      .join("");
    els.holdingType.dataset.optionSignature = signature;
  }

  els.holdingType.value = allowedOptions.some(([value]) => value === selectedType)
    ? selectedType
    : allowedOptions[0]?.[0] ?? "cash";
}

function updateHoldingFields() {
  const lockedType = assetCategories[chartState.entryCategoryKey] ? chartState.entryCategoryKey : null;
  syncHoldingTypeOptions(lockedType, lockedType || els.holdingType?.value || "cash");
  const type = els.holdingType?.value ?? "cash";
  const mode = els.holdingInputMode?.value ?? "manual";
  const labels = {
    cash: ["添加现金", "只需填写金额，不参与行情刷新", "保存现金资产"],
    stock: ["添加基金", "填写名称、代码、份额、成本价和当前价", "保存基金资产"],
    bond: ["添加债券", "可先按债券基金或债券持仓录入", "保存债券资产"],
    commodity: ["添加商品", "可先按黄金或商品基金持仓录入", "保存商品资产"],
  };
  const copy = labels[type] ?? labels.cash;

  if (els.holdingFormTitle) els.holdingFormTitle.textContent = copy[0];
  if (els.holdingFormNote) els.holdingFormNote.textContent = copy[1];
  if (els.holdingSubmitButton) els.holdingSubmitButton.textContent = copy[2];

  document.querySelectorAll("[data-field]").forEach((field) => {
    field.hidden = field.dataset.field === "cash" ? type !== "cash" : type === "cash";
  });
  if (els.holdingInstrument) {
    const options = [...els.holdingInstrument.options];
    const allowedOptions = options.filter((option) => option.dataset.assetType === type);
    options.forEach((option) => {
      option.hidden = option.dataset.assetType !== type;
      option.disabled = option.dataset.assetType !== type;
    });
    if (!allowedOptions.some((option) => option.value === els.holdingInstrument.value)) {
      els.holdingInstrument.value = allowedOptions[0]?.value ?? "";
    }
  }
  if (els.screenshotImport) {
    els.screenshotImport.hidden = type === "cash" || mode !== "screenshot";
  }
  if (type === "cash" || mode !== "screenshot" || (pendingOcrResult && pendingOcrResult.type !== type)) {
    clearPendingOcrResult();
  }
}

function selectHoldingCategory(type) {
  if (!assetCategories[type] || !els.holdingForm || !els.holdingType) return;

  chartState.expandedCategoryKey = type;
  chartState.entryCategoryKey = type;
  els.holdingType.value = type;
  updateHoldingFields();
  renderAssetOverview();
  syncPhonePreview();

  els.holdingForm.scrollIntoView({ behavior: "smooth", block: "start" });
  const focusTarget =
    type === "cash" ? els.holdingForm.elements.cashAmount : els.holdingForm.elements.holdingName;
  focusTarget?.focus({ preventScroll: true });
}

function setHoldingField(name, value) {
  const input = els.holdingForm?.elements[name];
  if (input) input.value = value;
}

function getOcrDisplayFields(fields) {
  const labels = {
    holdingName: "名称",
    holdingInstrument: "标的类型",
    holdingCode: "代码 / 识别码",
    holdingQuantity: "持有数量 / 份额",
    holdingCostPrice: "成本价",
    holdingCurrentPrice: "当前价",
  };
  return Object.entries(labels).map(([key, label]) => ({
    key,
    label,
    value: fields[key] ?? "-",
  }));
}

function renderPendingOcrCard() {
  if (!els.ocrConfirmation || !els.ocrResultList) return;

  if (!pendingOcrResult) {
    els.ocrConfirmation.hidden = true;
    els.ocrResultList.innerHTML = "";
    return;
  }

  els.ocrResultList.innerHTML = getOcrDisplayFields(pendingOcrResult.fields)
    .map(
      (item) => `
        <div>
          <dt>${escapeHtml(item.label)}</dt>
          <dd>${escapeHtml(item.value)}</dd>
        </div>
      `,
    )
    .join("");
  els.ocrConfirmation.hidden = false;
}

function clearPendingOcrResult(options = {}) {
  pendingOcrResult = null;
  if (!options.keepConfirmed) {
    confirmedOcrResultId = null;
  }
  renderPendingOcrCard();
  if (!options.keepStatus && els.screenshotStatus) {
    els.screenshotStatus.textContent = "等待识别";
  }
}

function confirmPendingOcrResult() {
  if (!pendingOcrResult) return;

  Object.entries(pendingOcrResult.fields).forEach(([key, value]) => setHoldingField(key, value));
  confirmedOcrResultId = pendingOcrResult.id;
  pendingOcrResult = null;
  renderPendingOcrCard();
  if (els.screenshotStatus) {
    els.screenshotStatus.textContent = "识别结果已确认并回填；请检查字段后手动保存。";
  }
}

function cancelPendingOcrResult() {
  clearPendingOcrResult();
  if (els.holdingScreenshot) {
    els.holdingScreenshot.value = "";
  }
  if (els.screenshotPreview) {
    els.screenshotPreview.hidden = true;
  }
}

function priceText(value) {
  const numeric = numberOr(value, 0);
  if (numeric >= 100) return numeric.toFixed(2);
  if (numeric >= 1) return numeric.toFixed(4);
  return numeric.toFixed(6);
}

function instrumentLabel(instrument) {
  const labels = {
    cash: "现金",
    fund: "指数/普通基金",
    etf: "ETF",
    stock: "股票型基金",
    bondFund: "债券基金",
    bond: "债券",
    gold: "黄金",
    commodityFund: "商品基金",
  };
  return labels[instrument] || "持仓";
}

function holdingDetailTitle(holding) {
  if (holding.type === "stock") return "基金详情";
  if (holding.type === "bond") return "债券详情";
  if (holding.type === "commodity") return "商品详情";
  return "资产详情";
}

function holdingSubtypeHint(holding) {
  const hints = {
    fund: "基金种类：指数基金 / 普通基金",
    etf: "基金种类：ETF",
    stock: "基金种类：股票型基金",
    bondFund: "基金种类：债券基金",
    bond: "标的种类：债券",
    gold: "商品种类：黄金",
    commodityFund: "基金种类：商品基金",
    cash: "资产种类：现金",
  };
  return hints[holding.instrument] || `种类：${instrumentLabel(holding.instrument)}`;
}

function renderHoldingDetails(item) {
  const details = [
    ["种类", instrumentLabel(item.instrument)],
    ["代码", item.code || "未填写"],
    ["持有数量", `${Number(item.quantity).toLocaleString("zh-CN", { maximumFractionDigits: 2 })} 份`],
    ["成本价", priceText(item.costPrice)],
    ["当前价", priceText(item.currentPrice)],
    ["成本金额", yuan(item.cost)],
    ["当前市值", yuan(item.value)],
    ["今日盈亏", `${item.todayPnl >= 0 ? "+" : ""}${yuan(item.todayPnl)}`],
    ["更新时间", item.updatedAt || "待刷新"],
  ];

  return `
    <div class="holding-detail-menu">
      <div class="holding-detail-head">
        <strong>${holdingDetailTitle(item)}</strong>
        <span>${escapeHtml(holdingSubtypeHint(item))}</span>
      </div>
      <div class="holding-detail-grid">
        ${details
          .map(
            ([label, value]) => `
              <div>
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderCategoryHoldings(categoryRow, rows) {
  const categoryItems = rows.filter((item) => item.category === categoryRow.key);
  if (!categoryItems.length) {
    return `
      <div class="category-detail-panel">
        <div class="category-empty">
          <p>${categoryRow.label}下面还没有具体资产，保存一笔后会显示在这里。</p>
          <button type="button" data-add-category="${categoryRow.key}">添加${categoryRow.label}</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="category-detail-panel">
      <div class="category-detail-title">
        <strong>${categoryRow.label}明细</strong>
        <div>
          <span>${categoryItems.length} 笔 · 今日 ${categoryRow.today >= 0 ? "+" : ""}${yuan(categoryRow.today)}</span>
          <button type="button" data-add-category="${categoryRow.key}">添加${categoryRow.label}</button>
        </div>
      </div>
      <div class="category-holding-list">
        ${categoryItems
          .map((item) => {
            const rate = item.totalPnl / Math.max(item.cost, 1);
            const today = item.todayPnl;
            const safeName = escapeHtml(item.name);
            const safeApi = escapeHtml(item.quoteEndpoint ? `API ${item.quoteEndpoint}` : item.apiProvider);
            const safeId = escapeHtml(item.id);
            return `
              <article class="holding-item">
                <i style="background:${categoryRow.color}"></i>
                <div>
                  <h3>${safeName}</h3>
                  <p>${escapeHtml(holdingSubtypeHint(item))} · ${escapeHtml(item.platform)} · ${escapeHtml(item.source)}</p>
                  <p class="holding-meta">${Number(item.quantity).toLocaleString("zh-CN", { maximumFractionDigits: 2 })} 份 · 当前价 ${priceText(item.currentPrice)} · 更新 ${escapeHtml(item.updatedAt || "待刷新")}</p>
                  <small class="api-chip">${safeApi}</small>
                </div>
                <div class="holding-value">
                  <strong>${yuan(item.value)}</strong>
                  <span class="${today < 0 ? "is-negative" : ""}">${today >= 0 ? "+" : ""}${yuan(today)} / 今日</span>
                  <small>累计 ${rate >= 0 ? "+" : ""}${(rate * 100).toFixed(1)}%</small>
                </div>
                <button type="button" class="holding-delete" data-delete-holding="${safeId}" aria-label="删除 ${safeName}">删除</button>
                ${renderHoldingDetails(item)}
              </article>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function getMockOcrResult(type, fileName) {
  const lowerName = fileName.toLowerCase();
  const byType = {
    stock: {
      holdingName: lowerName.includes("etf") ? "截图识别 ETF 持仓" : "截图识别基金持仓",
      holdingInstrument: lowerName.includes("etf") ? "etf" : "fund",
      holdingCode: lowerName.match(/\d{6}/)?.[0] ?? "000300",
      holdingQuantity: 22000,
      holdingCostPrice: 1.2318,
      holdingCurrentPrice: 1.3,
    },
    bond: {
      holdingName: "截图识别债券基金",
      holdingInstrument: "bondFund",
      holdingCode: lowerName.match(/\d{6}/)?.[0] ?? "110007",
      holdingQuantity: 20000,
      holdingCostPrice: 1.09,
      holdingCurrentPrice: 1.1,
    },
    commodity: {
      holdingName: lowerName.includes("gold") || lowerName.includes("黄金") ? "截图识别黄金持仓" : "截图识别商品持仓",
      holdingInstrument: lowerName.includes("gold") || lowerName.includes("黄金") ? "gold" : "commodityFund",
      holdingCode: lowerName.match(/\d{6}/)?.[0] ?? "gold-demo",
      holdingQuantity: lowerName.includes("gold") || lowerName.includes("黄金") ? 25 : 12000,
      holdingCostPrice: lowerName.includes("gold") || lowerName.includes("黄金") ? 636 : 1.325,
      holdingCurrentPrice: lowerName.includes("gold") || lowerName.includes("黄金") ? 672 : 1.4,
    },
  };
  return byType[type] ?? byType.stock;
}

function handleScreenshotImport() {
  const file = els.holdingScreenshot?.files?.[0];
  clearPendingOcrResult({ keepStatus: true });
  if (!file || !els.screenshotPreview) return;

  const type = els.holdingType?.value ?? "stock";
  const previewImage = els.screenshotPreview.querySelector("img");
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    previewImage.src = reader.result;
    els.screenshotPreview.hidden = false;
  });
  reader.readAsDataURL(file);

  els.screenshotStatus.textContent = "正在模拟 OCR 识别...";
  window.setTimeout(() => {
    const result = getMockOcrResult(type, file.name);
    pendingOcrResult = {
      id: `${type}-${file.name}-${Date.now()}`,
      type,
      fileName: file.name,
      endpoint: ocrApiAdapters[type] ?? "/api/ocr/asset-screenshot",
      fields: result,
    };
    confirmedOcrResultId = null;
    renderPendingOcrCard();
    els.screenshotStatus.textContent = `Demo OCR 已生成待确认结果；真实版将调用 ${pendingOcrResult.endpoint}，用户确认后才保存。`;
  }, 360);
}

function addHoldingFromForm() {
  const data = new FormData(els.holdingForm);
  const type = data.get("holdingType");
  const name = type === "cash" ? "现金账户" : String(data.get("holdingName") || "").trim() || assetCategories[type]?.label || "未命名资产";
  const id = `${type}-${Date.now()}`;

  if (type === "cash") {
    const amount = Number(data.get("cashAmount")) || 0;
    assetHoldings = [
      {
        id,
        type,
        name,
        instrument: "cash",
        platform: "现金账户",
        code: "",
        quantity: 1,
        costPrice: amount,
        currentPrice: amount,
        currentValue: amount,
        costAmount: amount,
        todayPnl: 0,
        updatedAt: formatDateTime(),
        source: "手动录入",
        apiProvider: assetCategories.cash.apiProvider,
        quoteEndpoint: null,
        ocrEndpoint: null,
      },
      ...assetHoldings,
    ];
  }

  if (type !== "cash") {
    const inputMode = String(data.get("holdingInputMode") || "manual");
    const instrumentOptions = [...(els.holdingInstrument?.options ?? [])].filter((option) => option.dataset.assetType === type);
    const requestedInstrument = String(data.get("holdingInstrument") || "");
    const instrument = instrumentOptions.some((option) => option.value === requestedInstrument)
      ? requestedInstrument
      : instrumentOptions[0]?.value || "fund";
    const screenshotFile = data.get("holdingScreenshot");
    const hasScreenshotFile = screenshotFile instanceof File && screenshotFile.name;
    if (inputMode === "screenshot" && hasScreenshotFile && pendingOcrResult) {
      els.screenshotStatus.textContent = "请先确认或取消当前识别结果，未确认结果不会保存。";
      return false;
    }
    if (inputMode === "screenshot" && hasScreenshotFile && !confirmedOcrResultId) {
      els.screenshotStatus.textContent = "请先完成模拟 OCR 识别并确认结果，再保存持仓。";
      return false;
    }
    const quantity = Math.max(0, Number(data.get("holdingQuantity")) || 0);
    const costPrice = Math.max(0, Number(data.get("holdingCostPrice")) || 0);
    const currentPrice = Math.max(0, Number(data.get("holdingCurrentPrice")) || 0);
    const currentValue = quantity * currentPrice;
    const costAmount = quantity * costPrice;
    assetHoldings = [
      {
        id,
        type,
        name,
        instrument,
        platform: inputMode === "screenshot" ? "截图导入待识别" : "手动录入",
        code: String(data.get("holdingCode") || "").trim(),
        quantity,
        costPrice,
        currentPrice,
        currentValue,
        costAmount,
        todayPnl: 0,
        updatedAt: formatDateTime(),
        source: inputMode === "screenshot" ? "截图导入，待 OCR 匹配标的" : "手动录入",
        apiProvider: assetCategories[type]?.apiProvider,
        quoteEndpoint: quoteApiAdapters[type],
        ocrEndpoint: inputMode === "screenshot" ? ocrApiAdapters[type] : null,
        screenshotFileName: screenshotFile instanceof File ? screenshotFile.name : "",
      },
      ...assetHoldings,
    ];
  }

  saveHoldings();
  clearPendingOcrResult({ keepStatus: true });
  lastQuoteRefreshImpact = null;
  update();
  return true;
}

function stableHash(value) {
  return calc.stableHash(value);
}

function mockQuoteRate(holding, seed) {
  return calc.mockQuoteRate(holding, seed, assetCategories);
}

function roundedPrice(value) {
  return calc.roundedPrice(value);
}

function refreshMockQuotes() {
  const beforeValues = getValues();
  const beforeResult = simulate(beforeValues);
  const beforeProgress = progressFromAssets(beforeResult.currentAssets, beforeValues.target);
  const refreshedAt = formatDateTime();
  mockQuoteRefreshCount += 1;
  assetHoldings = calc.refreshMockHoldings(assetHoldings, { seed: mockQuoteRefreshCount, refreshedAt, assetCategories, quoteApiAdapters }).holdings;
  saveHoldings();
  const afterValues = getValues();
  const afterResult = simulate(afterValues);
  lastQuoteRefreshImpact = {
    beforeAssets: beforeResult.currentAssets,
    afterAssets: afterResult.currentAssets,
    beforeProgress,
    afterProgress: progressFromAssets(afterResult.currentAssets, afterValues.target),
    beforeMonths: beforeResult.months,
    afterMonths: afterResult.months,
    beforeReached: beforeResult.reached,
    afterReached: afterResult.reached,
    refreshedAt,
  };
  update();
}

function deriveSalaryGrowth(values) {
  return calc.deriveSalaryGrowth(values);
}

function deriveInvestmentReturn(values) {
  return calc.deriveInvestmentReturn(values);
}

function monthlyRate(annualReturn) {
  return calc.monthlyRate(annualReturn);
}

function getModel(values, overrides = {}) {
  return calc.getModel(values, overrides);
}

function simulate(values, overrides = {}) {
  return calc.simulate(values, overrides);
}

function monthsText(months, reached) {
  if (!reached) return "60 年以上";
  if (months <= 0) return "已经达成";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} 个月`;
  return rest === 0 ? `${years} 年` : `${years} 年 ${rest} 个月`;
}

function futureDate(months, reached) {
  if (!reached) return "暂不可达";
  if (months <= 0) return "已经达成";
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
}

function ageText(age, months, reached) {
  if (!reached) return "按回测速度，60 年内无法达成";
  const totalMonths = age * 12 + months;
  const years = Math.floor(totalMonths / 12);
  const rest = totalMonths % 12;
  return rest === 0 ? `约 ${years} 岁` : `约 ${years} 岁 ${rest} 个月`;
}

function delayCompared(base, alternative) {
  return calc.delayCompared(base, alternative);
}

function dragInsights(values, base) {
  return calc.dragInsights(values, base);
}

function renderBacktest(result) {
  els.backtestedReturn.textContent = percent(result.annualReturn);
  els.backtestedSalaryGrowth.textContent = percent(result.salaryGrowth);
  els.salaryBacktestResult.textContent = `${percent(result.salaryGrowth)} / 年，${result.salaryBacktest.confidence}`;
  els.returnBacktestResult.textContent = `${percent(result.annualReturn)} / 年，${result.returnBacktest.confidence}`;
}

function getHoldingValue(holding) {
  return calc.getHoldingValue(holding);
}

function getHoldingCost(holding) {
  return calc.getHoldingCost(holding);
}

function getHoldingCategory(holding) {
  return calc.getHoldingCategory(holding, assetCategories);
}

function getHoldingPnl(holding) {
  return calc.getHoldingPnl(holding);
}

function assetRecordSummary(holdings) {
  const rows = holdings.map((holding) => {
    const normalized = normalizeHolding(holding);
    return { ...normalized, ...getHoldingPnl(normalized), category: getHoldingCategory(normalized) };
  });
  const total = rows.reduce((sum, item) => sum + item.value, 0);
  const stockRatio = rows
    .filter((item) => item.category === "stock")
    .reduce((sum, item) => sum + item.value, 0) / Math.max(total, 1);
  const commodityRatio = rows
    .filter((item) => item.category === "commodity")
    .reduce((sum, item) => sum + item.value, 0) / Math.max(total, 1);
  const todayPnl = rows.reduce((sum, item) => sum + item.todayPnl, 0);
  const stockPnl = rows
    .filter((item) => item.category === "stock")
    .reduce((sum, item) => sum + item.todayPnl, 0);
  const commodityPnl = rows
    .filter((item) => item.category === "commodity")
    .reduce((sum, item) => sum + item.todayPnl, 0);

  if (Math.abs(stockPnl) > Math.max(total * 0.003, 300)) {
    return `行情记录：基金类资产今日变动较大，今日约 ${stockPnl >= 0 ? "+" : ""}${yuan(stockPnl)}，已计入总资产和退休进度。`;
  }
  if (commodityRatio > 0.35) {
    return `行情记录：商品类资产占比 ${(commodityRatio * 100).toFixed(1)}%，今日约 ${commodityPnl >= 0 ? "+" : ""}${yuan(commodityPnl)}，后续只记录行情变化。`;
  }
  if (stockRatio < 0.15 && total > 100000) {
    return `行情记录：基金类占比 ${(stockRatio * 100).toFixed(1)}%，当前退休进度主要受现金流和总资产变化影响。`;
  }
  return `行情记录：今日资产合计变动 ${todayPnl >= 0 ? "+" : ""}${yuan(todayPnl)}，现金、基金、债券、商品变化已计入退休进度。`;
}

function impactMonthText(impact) {
  if (!impact) return "刷新行情后会显示进度对比。";
  if (!impact.beforeReached && impact.afterReached) {
    return "预计达成状态从暂不可达变为可达。";
  }
  if (impact.beforeReached && !impact.afterReached) {
    return "预计达成状态变为暂不可达。";
  }
  if (!impact.beforeReached && !impact.afterReached) {
    return "预计退休日期仍为暂不可达。";
  }

  const monthDelta = impact.afterMonths - impact.beforeMonths;
  if (monthDelta < 0) return `预计达成时间提前 ${monthsText(Math.abs(monthDelta), true)}。`;
  if (monthDelta > 0) return `预计达成时间延后 ${monthsText(monthDelta, true)}。`;
  return "预计退休日期暂无变化。";
}

function renderAssetImpact(impact, todayPnl) {
  if (!els.assetImpact) return;
  const change = impact ? impact.afterAssets - impact.beforeAssets : todayPnl;
  const progressCopy = impact
    ? `退休进度 ${impact.beforeProgress.toFixed(2)}% -> ${impact.afterProgress.toFixed(2)}%。`
    : "今日资产变化已按持仓市值计入退休进度。";
  els.assetImpact.textContent = impact
    ? `本次刷新：总资产 ${change >= 0 ? "+" : ""}${yuan(change)}，${progressCopy}${impactMonthText(impact)}`
    : `${progressCopy} 当前记录的今日变化为 ${change >= 0 ? "+" : ""}${yuan(change)}。`;
  els.assetImpact.classList.toggle("is-negative", change < 0);
}

function renderSecurityAccounts(values, result) {
  if (!els.securityTotalValue || !els.securityAccountList) return;
  const rows = getSecurityAccountRows();
  const support = getSecuritySupport(values, result);
  const supportPercent = support.supportFactor * 100;
  const reducedText = support.reducedMonths > 0 ? `约 ${monthsText(support.reducedMonths, true)}` : "影响较小";
  const cashflowSupport =
    support.monthlyRetirementIncome + support.housingLoanOffsetMonthly > 0
      ? `预计退休后月领取 ${yuan(support.monthlyRetirementIncome)}，当前公积金冲还贷 ${yuan(support.housingLoanOffsetMonthly)}。`
      : "暂未录入预计月领取或冲还贷金额。";

  els.securityTotalValue.textContent = yuan(support.total);
  els.securitySupportBadge.textContent = `现金流支持 +${supportPercent.toFixed(1)}%`;
  els.securitySupportCopy.textContent = `${cashflowSupport} 综合保障影响预计可缩短退休时间 ${reducedText}。`;
  els.pensionYearsText.textContent = `${securityAccounts.pension.yearsPaid.toFixed(1).replace(/\.0$/, "")} / ${pensionYearsTarget} 年`;
  els.pensionProgressText.textContent = `完成度 ${support.pensionProgress.toFixed(0)}%，仅按演示目标年限计算。`;
  els.pensionProgressBar.style.width = `${support.pensionProgress}%`;

  els.securityAccountList.innerHTML = `
    ${rows
      .map(
        (item) => `
          <article class="security-account-item">
            <i style="background:${item.color}"></i>
            <div>
              <span>${item.label}</span>
              <strong>${yuan(item.balance)}</strong>
              <small>${item.detail}</small>
            </div>
            <em>每月 ${yuan(item.monthly)}</em>
          </article>
        `,
      )
      .join("")}
  `;
}

function renderHealthOverview(values, result, progress, remaining, drags) {
  if (!els.overviewProgressValue) return;
  const holdingTotals = getHoldingTotals();
  const securitySupport = getSecuritySupport(values, result);
  const topDrag =
    [...drags, ...getManualDragInsights(values, result)].sort((a, b) => b.savedMonths - a.savedMonths)[0] ?? null;
  const routeEta = result.reached ? monthsText(result.months, true) : "60 年以上";
  const cashflowStatus =
    result.monthlyInvestable > 0 ? yuan(result.monthlyInvestable) : result.monthlyInvestable === 0 ? "持平" : "为负";
  const assetMix = getHoldingTotals().rows.length
    ? `现金 ${yuan(holdingTotals.cash)} · 投资 ${yuan(holdingTotals.investments)}`
    : "等待录入资产";
  const supportPercent = securitySupport.supportFactor * 100;
  const reminderTitle = topDrag ? topDrag.title : "现金流状态健康";
  const reminderText = topDrag
    ? `${topDrag.title} 对退休日期影响约 ${monthsText(topDrag.savedMonths, true)}。`
    : "当前没有特别突出的拖累项，可以继续观察现金流、保障账户和资产波动。";

  els.overviewProgressValue.textContent = `${progress.toFixed(1)}%`;
  els.overviewStatusText.textContent =
    progress >= 100 ? "当前可投资资产已达到目标。" : `距离目标还差 ${yuan(remaining)}。`;
  els.overviewFreedomDate.textContent = futureDate(result.months, result.reached);
  els.overviewGapValue.textContent = ageText(values.age, result.months, result.reached);
  els.overviewInvestAssetValue.textContent = yuan(result.currentAssets);
  els.overviewAssetMix.textContent = assetMix;
  els.overviewSecurityValue.textContent = yuan(securitySupport.total);
  els.overviewSecuritySupport.textContent = `现金流支持 +${supportPercent.toFixed(1)}%，不计入可投资资产`;
  els.overviewCashflowStatus.textContent = cashflowStatus;
  els.overviewCashflowCopy.textContent = `收入 ${yuan(values.salary + values.sideIncome)} · 支出 ${yuan(values.livingCost + (values.manualDragOutflow || 0))}`;
  els.overviewTodayChange.textContent = `${holdingTotals.todayPnl >= 0 ? "+" : ""}${yuan(holdingTotals.todayPnl)}`;
  els.overviewRouteEta.textContent = routeEta;
  els.overviewReminderTitle.textContent = reminderTitle;
  els.overviewReminder.textContent = reminderText;
}

function renderAssetOverview() {
  const rows = assetHoldings.map((holding) => {
    const normalized = normalizeHolding(holding);
    return { ...normalized, ...getHoldingPnl(normalized), category: getHoldingCategory(normalized) };
  });
  const total = rows.reduce((sum, item) => sum + item.value, 0);
  const todayPnl = rows.reduce((sum, item) => sum + item.todayPnl, 0);
  let cursor = 0;
  const categoryRows = Object.entries(assetCategories).map(([key, meta]) => {
    const categoryItems = rows.filter((item) => item.category === key);
    const value = categoryItems.reduce((sum, item) => sum + item.value, 0);
    const today = categoryItems.reduce((sum, item) => sum + item.todayPnl, 0);
    return { key, ...meta, value, today, count: categoryItems.length };
  });
  const segments = categoryRows
    .map((item) => {
      const start = cursor;
      const degrees = (item.value / Math.max(total, 1)) * 360;
      cursor += degrees;
      return `${item.color} ${start}deg ${cursor}deg`;
    })
    .join(", ");

  els.assetDonut.style.background = `radial-gradient(circle, #fff 0 56%, transparent 57%), conic-gradient(${segments})`;
  els.assetTotalValue.textContent = yuan(total);
  els.assetTodayPnl.textContent = `${todayPnl >= 0 ? "+" : ""}${yuan(todayPnl)} 今日`;
  els.assetTodayPnl.classList.toggle("is-negative", todayPnl < 0);
  els.assetAiSignal.textContent = assetRecordSummary(assetHoldings);
  renderAssetImpact(lastQuoteRefreshImpact, todayPnl);
  els.holdingList.innerHTML = `
    <div class="asset-category-grid">
      ${categoryRows
        .map((item) => {
          const isExpanded = chartState.expandedCategoryKey === item.key;
          const percent = total > 0 ? `${((item.value / total) * 100).toFixed(1)}%` : "0.0%";
          return `
            <article class="asset-category-card ${isExpanded ? "is-expanded" : ""}" data-toggle-category="${item.key}" role="button" tabindex="0" aria-expanded="${isExpanded}">
              <i style="background:${item.color}"></i>
              <div>
                <span>${item.label}</span>
                <strong>${yuan(item.value)}</strong>
                <small>${item.count ? `${item.count} 笔资产` : "待录入"} · ${percent} · ${item.today >= 0 ? "+" : ""}${yuan(item.today)} 今日</small>
              </div>
              <em>${isExpanded ? "收起" : "展开"}</em>
            </article>
            ${isExpanded ? renderCategoryHoldings(item, rows) : ""}
          `;
        })
        .join("")}
    </div>
  `;
}

function setActivePage(page, options = {}) {
  chartState.activePage = page;
  document.querySelectorAll("[data-app-page]").forEach((section) => {
    const isActive = section.dataset.appPage === page;
    section.classList.toggle("is-active", isActive);
    section.hidden = !isActive;
  });
  document.querySelectorAll("[data-overview-only]").forEach((section) => {
    const isActive = page === "overview";
    section.classList.toggle("is-active", isActive);
    section.hidden = !isActive;
  });
  document.querySelectorAll("[data-page]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.page === page);
  });

  if (page === "route" && chartState.result) {
    renderChart(chartState.result);
  }

  if (!options.silent) {
    syncPhonePreview();
  }
}

function getManualDragInsights(values, base) {
  return calc.getManualDragInsights(manualDrags, values, base);
}

function renderDrags(insights, values, base) {
  const manualInsights = getManualDragInsights(values, base);
  const allInsights = [...insights, ...manualInsights].sort((a, b) => b.savedMonths - a.savedMonths);

  els.dragScore.textContent = allInsights.length
    ? `最大可提前 ${monthsText(allInsights[0].savedMonths, true)}`
    : "暂无明显拖累";
  els.dragList.innerHTML = allInsights.length
    ? allInsights
        .map(
          (item, index) => `
            <article class="drag-item ${item.source === "manual" || item.isManual ? "is-manual" : ""}">
              <span class="drag-rank">${index + 1}</span>
              <div>
                <div class="drag-title-row">
                  <h3>${escapeHtml(item.title)}：${calc.formatDragImpactText(item, { monthsFormatter: (months) => monthsText(months, true) })}</h3>
                  ${item.source === "manual" || item.isManual ? `<span class="drag-source">手动</span>` : ""}
                </div>
                <p>${escapeHtml(item.detail)}</p>
                ${
                  item.source === "manual" || item.isManual
                    ? `<button type="button" class="drag-delete" data-delete-drag="${item.id}">删除</button>`
                    : ""
                }
              </div>
            </article>
          `,
        )
        .join("")
    : `<article class="drag-item"><span class="drag-rank">✓</span><div><h3>现金流状态健康</h3><p>当前配置没有特别突出的拖累项，可以继续观察回测收益和收入增长。</p></div></article>`;
}

function getScenarioDefinitions(values, base) {
  const income = values.salary + values.sideIncome;
  const investable = base.monthlyInvestable;
  const currentAssets = base.currentAssets;
  const remaining = Math.max(values.target - currentAssets, 0);
  const incomeBoost = clamp(Math.round(Math.max(2000, income * 0.12) / 500) * 500, 2000, 6000);
  const livingCut = clamp(Math.round(Math.min(values.livingCost * 0.12, 2000) / 100) * 100, 500, 2000);
  const flexibleDrags = manualDrags.filter((item) => item.category === "other");
  const flexibleAmount = flexibleDrags.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const rigidDrags = [
    values.mortgage > 0 ? `房贷 ${yuan(values.mortgage)}` : "",
    values.carLoan > 0 ? `车贷 ${yuan(values.carLoan)}` : "",
    ...manualDrags
      .filter((item) => item.category !== "other")
      .map((item) => `${item.title} ${yuan(item.amount)}`),
  ].filter(Boolean);

  const scenarios = [];

  if (rigidDrags.length) {
    scenarios.push({
      id: "rigidPressure",
      title: "先承认刚性压力",
      detail: `当前存在 ${rigidDrags.join("、")}。这类支出不建议假设能降低，它们用于判断退休目标是否需要更保守。`,
      patch: null,
      badge: "不做削减模拟",
      priority: 80,
    });
  }

  if (investable < income * 0.25 || investable < 6000) {
    scenarios.push({
      id: "incomeBoost",
      title: `提高稳定现金流 ${yuan(incomeBoost)} / 月`,
      detail: `当前每月可投入 ${yuan(investable)}。现阶段优先提高主业收入、副业收入或稳定奖金，比纠结收益率更直接。`,
      patch: { sideIncome: values.sideIncome + incomeBoost },
      priority: 100,
    });
  }

  if (flexibleAmount > 0) {
    scenarios.push({
      id: "flexibleDrag",
      title: "复盘其他类拖累",
      detail: `你记录了每月 ${yuan(flexibleAmount)} 的其他类拖累。这部分比房贷、医疗更可能有调整空间。`,
      patch: { manualDragOutflow: Math.max(0, values.manualDragOutflow - flexibleAmount) },
      priority: 95,
    });
  }

  if (remaining > 1000000) {
    const stageTarget = Math.max(currentAssets + remaining * 0.5, values.target * 0.5);
    scenarios.push({
      id: "stageTarget",
      title: "把退休目标拆成两段",
      detail: `当前距离目标还差 ${yuan(remaining)}。先设置 ${yuan(stageTarget)} 的阶段目标，更适合判断半退休或低压力工作的可行性。`,
      patch: { target: stageTarget },
      priority: 90,
    });
  }

  if (values.livingCost > income * 0.35 && livingCut > 0) {
    scenarios.push({
      id: "livingReview",
      title: "检查生活支出弹性",
      detail: `生活支出占收入比例偏高。这里不是让你硬省，而是先找可替代、可延后的消费。`,
      patch: { livingCost: Math.max(0, values.livingCost - livingCut) },
      priority: 70,
    });
  }

  if (currentAssets > 100000 && base.annualReturn < 4) {
    scenarios.push({
      id: "returnStability",
      title: "提高资产配置稳定性",
      detail: `当前已有 ${yuan(currentAssets)} 资产，回测收益为 ${percent(base.annualReturn)}。这个阶段应关注配置纪律和回撤控制，而不是追短线。`,
      patch: { annualReturn: base.annualReturn + 1.5 },
      priority: 60,
    });
  }

  if (!scenarios.some((item) => item.patch)) {
    scenarios.push({
      id: "defaultIncome",
      title: "优先扩大每月可投入",
      detail: `当前每月可投入 ${yuan(investable)}。退休日期最敏感的变量通常是稳定现金流，其次才是收益率。`,
      patch: { sideIncome: values.sideIncome + incomeBoost },
      priority: 50,
    });
  }

  return scenarios.sort((a, b) => b.priority - a.priority).slice(0, 4);
}

function getActiveScenario(values, base) {
  return getScenarioDefinitions(values, base).find(
    (scenario) => scenario.id === chartState.activeScenarioId && scenario.patch,
  );
}

function renderScenarios(values, base) {
  const scenarios = getScenarioDefinitions(values, base);

  els.scenarioList.innerHTML = scenarios
    .map((scenario) => {
      const result = scenario.patch ? simulate(values, scenario.patch) : null;
      const saved = result ? Math.max(0, delayCompared(base, result)) : 0;
      return `
        <button class="scenario-item ${chartState.activeScenarioId === scenario.id ? "is-active" : ""}" type="button" data-scenario="${scenario.id}" ${scenario.patch ? "" : "data-static-scenario=\"true\""}>
          <div>
            <h3>${scenario.title}</h3>
            <p>${scenario.detail}</p>
          </div>
          <strong>${scenario.badge ?? (saved > 0 ? `提前 ${monthsText(saved, true)}` : "影响较小")}</strong>
        </button>
      `;
    })
    .join("");
}

function getRoutePoints(result) {
  const yearsToShow = clamp(Math.ceil(Math.max(result.months, 120) / 12) + 1, 10, 24);
  const yearly = Array.from({ length: yearsToShow + 1 }, (_, year) => {
    return result.points.find((point) => point.month === year * 12) ?? result.points[result.points.length - 1];
  });
  return yearly.map((point, index) => ({
    year: index,
    month: index * 12,
    assets: point.assets,
    netInput: point.netInput,
  }));
}

function pointForYear(result, year) {
  const point = result.points.find((item) => item.month === year * 12) ?? result.points[result.points.length - 1];
  return {
    year,
    month: year * 12,
    assets: point.assets,
    netInput: point.netInput,
  };
}

function makeChartCoords(points, maxValue, width, height, padding) {
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  return points.map((point, index) => {
    const x = padding.left + (index / Math.max(points.length - 1, 1)) * plotWidth;
    const y = padding.top + plotHeight - (point.assets / maxValue) * plotHeight;
    return { ...point, x, y };
  });
}

function pathFromCoords(coords) {
  return coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function smoothPathFromCoords(coords) {
  if (coords.length < 2) return pathFromCoords(coords);
  const commands = [`M ${coords[0].x} ${coords[0].y}`];
  for (let index = 0; index < coords.length - 1; index += 1) {
    const current = coords[index];
    const next = coords[index + 1];
    const previous = coords[index - 1] || current;
    const afterNext = coords[index + 2] || next;
    const control1X = current.x + (next.x - previous.x) / 6;
    const control1Y = current.y + (next.y - previous.y) / 6;
    const control2X = next.x - (afterNext.x - current.x) / 6;
    const control2Y = next.y - (afterNext.y - current.y) / 6;
    commands.push(`C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${next.x} ${next.y}`);
  }
  return commands.join(" ");
}

function renderInspector(result, compareResult, activeYear) {
  const point = pointForYear(result, activeYear);
  const gap = result.target - point.assets;
  const age = result.age + activeYear;
  const comparePoint = compareResult ? pointForYear(compareResult, activeYear) : null;
  const compareDelta = comparePoint ? comparePoint.assets - point.assets : 0;
  const status = gap <= 0 ? `已超过目标 ${yuan(Math.abs(gap))}` : `距目标还差 ${yuan(gap)}`;

  els.chartInspector.innerHTML = `
    <div class="scrub-hint">
      <span>图表交互</span>
      <strong>左右滑动曲线查看年份</strong>
    </div>
    <div>
      <span>选中年份</span>
      <strong>第 ${activeYear} 年，约 ${age} 岁</strong>
    </div>
    <div>
      <span>预计资产</span>
      <strong>${yuan(point.assets)}</strong>
    </div>
    <div>
      <span>目标差额</span>
      <strong>${status}</strong>
    </div>
    <div>
      <span>当年每月可投</span>
      <strong>${yuan(point.netInput)}</strong>
    </div>
    ${
      comparePoint
        ? `<div class="compare-note">
            <span>对比方案</span>
            <strong>${compareDelta >= 0 ? "多" : "少"} ${yuan(Math.abs(compareDelta))}</strong>
          </div>`
        : ""
    }
  `;
}

function renderChart(result) {
  const isMobile =
    typeof window !== "undefined" && (window.matchMedia?.("(max-width: 620px)").matches ?? false);
  const width = isMobile ? 360 : 920;
  const height = isMobile ? 220 : 450;
  const padding = isMobile
    ? { top: 22, right: 18, bottom: 32, left: 22 }
    : { top: 42, right: 42, bottom: 58, left: 78 };
  const points = getRoutePoints(result);
  const activeScenario = chartState.values ? getActiveScenario(chartState.values, result) : null;
  const compareResult = activeScenario && chartState.values ? simulate(chartState.values, activeScenario.patch) : null;
  const comparePoints = compareResult ? getRoutePoints(compareResult).slice(0, points.length) : [];
  const maxValue = Math.max(
    result.target * 1.15,
    ...points.map((point) => point.assets),
    ...comparePoints.map((point) => point.assets),
    1,
  );
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const targetY = padding.top + plotHeight - (result.target / maxValue) * plotHeight;
  const hitPoint = result.reached
    ? points.find((point) => point.assets >= result.target) ?? points[points.length - 1]
    : null;
  const activeYear = clamp(chartState.activeYear ?? hitPoint?.year ?? 0, 0, points.length - 1);
  const coords = makeChartCoords(points, maxValue, width, height, padding);
  const compareCoords = comparePoints.length
    ? makeChartCoords(comparePoints, maxValue, width, height, padding)
    : [];
  const path = smoothPathFromCoords(coords);
  const comparePath = compareCoords.length ? smoothPathFromCoords(compareCoords) : "";
  const fillPath = `${path} L ${coords[coords.length - 1].x} ${padding.top + plotHeight} L ${coords[0].x} ${padding.top + plotHeight} Z`;
  const hitCoord = hitPoint ? coords.find((point) => point.year === hitPoint.year) : null;
  const activeCoord = coords.find((point) => point.year === activeYear) ?? coords[0];
  const hitBadgeWidth = isMobile ? 56 : 66;
  const hitBadgeX = hitCoord
    ? clamp(hitCoord.x - hitBadgeWidth / 2, padding.left + 4, padding.left + plotWidth - hitBadgeWidth - 4)
    : 0;
  const hitBadgeY = hitCoord
    ? clamp(hitCoord.y - 46, padding.top + 8, padding.top + plotHeight - 48)
    : 0;
  const tickIndexes = isMobile
    ? [0, Math.floor((coords.length - 1) / 2)]
    : [0, Math.floor((coords.length - 1) / 2), coords.length - 1];
  chartState.routeMeta = {
    padding,
    plotWidth,
    svgWidth: width,
    years: coords.map((point) => ({ year: point.year, x: point.x })),
  };

  els.assetChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="presentation" data-chart-surface="true">
      <defs>
        <linearGradient id="assetFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#0f766e" stop-opacity="0.18" />
          <stop offset="100%" stop-color="#0f766e" stop-opacity="0.02" />
        </linearGradient>
      </defs>
      <rect x="${padding.left}" y="${padding.top}" width="${plotWidth}" height="${plotHeight}" rx="8" fill="#f8fbfa" />
      <line x1="${padding.left}" x2="${padding.left + plotWidth}" y1="${targetY}" y2="${targetY}" class="target-line" />
      ${isMobile ? "" : `<text x="${padding.left + plotWidth}" y="${targetY - 10}" text-anchor="end" class="target-label">目标 ${yuan(result.target)}</text>`}
      <path d="${fillPath}" fill="url(#assetFill)" />
      ${comparePath ? `<path d="${comparePath}" class="compare-line" />` : ""}
      <path d="${path}" class="asset-line" />
      <line x1="${activeCoord.x}" x2="${activeCoord.x}" y1="${padding.top}" y2="${padding.top + plotHeight}" class="focus-line" />
      <circle cx="${activeCoord.x}" cy="${activeCoord.y}" r="9" class="focus-dot" />
      ${
        hitCoord
          ? `<circle cx="${hitCoord.x}" cy="${hitCoord.y}" r="${isMobile ? 4 : 5}" class="hit-dot" />
             <line x1="${hitCoord.x}" x2="${hitCoord.x}" y1="${hitCoord.y}" y2="${padding.top + plotHeight}" class="hit-line" />
             ${
               isMobile
                 ? ""
                 : `
             <g class="hit-badge" transform="translate(${hitBadgeX} ${hitBadgeY})">
               <rect width="${hitBadgeWidth}" height="28" rx="14"></rect>
               <text x="${hitBadgeWidth / 2}" y="19" text-anchor="middle">达成</text>
             </g>`
             }`
          : `<text x="${padding.left + plotWidth}" y="${padding.top + 28}" text-anchor="end" class="miss-label">当前模型 60 年内未达成</text>`
      }
      ${tickIndexes
        .map((index) => {
          const point = coords[index];
          return `<text x="${point.x}" y="${padding.top + plotHeight + 30}" text-anchor="middle" class="axis-label">${point.year === 0 ? "0 年" : `${point.year} 年`}</text>`;
        })
        .join("")}
      ${isMobile ? "" : `<text x="${padding.left}" y="${padding.top - 14}" class="axis-label">${yuan(maxValue)}</text>`}
      ${isMobile ? "" : `<text x="${padding.left}" y="${padding.top + plotHeight + 36}" class="axis-label">现在</text>`}
    </svg>
    <div class="route-range-control">
      <div>
        <span>第 ${activeYear} 年</span>
        <strong>${yuan(pointForYear(result, activeYear).assets)}</strong>
      </div>
      <input type="range" min="0" max="${points.length - 1}" step="1" value="${activeYear}" data-year-range aria-label="选择路线图年份" />
    </div>
  `;

  const remaining = Math.max(0, result.target - result.currentAssets);
  const savedMonths = compareResult ? Math.max(0, delayCompared(result, compareResult)) : 0;
  els.chartCaption.textContent = `用过去数据回测：工资 ${percent(result.salaryGrowth)} / 年，投资 ${percent(result.annualReturn)} / 年。`;
  els.gapBadge.textContent = result.reached
    ? `${futureDate(result.months, true)} 达成${compareResult && savedMonths > 0 ? `，对比提前 ${monthsText(savedMonths, true)}` : ""}`
    : `还差 ${yuan(remaining)}`;
  renderInspector(result, compareResult, activeYear);
}

function update() {
  const values = getValues();
  const result = simulate(values);
  const progress = Math.min(100, (result.currentAssets / Math.max(values.target, 1)) * 100);
  const remaining = Math.max(0, values.target - result.currentAssets);
  const maxYear = getRoutePoints(result).length - 1;
  chartState.values = values;
  chartState.result = result;
  chartState.activeYear = clamp(chartState.activeYear ?? Math.ceil(result.months / 12), 0, maxYear);

  els.progressRing.style.setProperty("--progress", `${progress * 3.6}deg`);
  els.progressPercent.textContent = `${progress.toFixed(1)}%`;
  els.freedomDate.textContent = futureDate(result.months, result.reached);
  els.freedomAge.textContent = ageText(values.age, result.months, result.reached);
  els.currentAssets.textContent = yuan(result.currentAssets);
  els.monthlyInvestable.textContent = yuan(result.monthlyInvestable);

  renderBacktest(result);
  renderAssetOverview();
  renderSecurityAccounts(values, result);
  renderChart(result);

  const drags = dragInsights(values, result);
  renderDrags(drags, values, result);
  renderScenarios(values, result);
  renderHealthOverview(values, result, progress, remaining, drags);
  setActivePage(chartState.activePage, { silent: true });

  const topDrag =
    [...drags, ...getManualDragInsights(values, result)].sort((a, b) => b.savedMonths - a.savedMonths)[0]?.title ??
    "暂无明显拖累项";
  els.reportTitle.textContent = `当前退休进度 ${progress.toFixed(1)}%，预计 ${futureDate(result.months, result.reached)} 上岸`;
  els.reportSummary.textContent = `回测后每月可投入 ${yuan(result.monthlyInvestable)}，距离目标还差 ${yuan(remaining)}。目前最大的关键拖累项是：${topDrag}。`;
  syncPhonePreview(values);
}

function syncPhonePreview(values = getValues()) {
  if (isPhonePreview || !phonePreview?.contentWindow) return;
  phonePreview.contentWindow.postMessage(
    {
      type: "wealth-demo-values",
      values,
      holdings: assetHoldings,
      manualDrags,
      securityAccounts,
      activeScenarioId: chartState.activeScenarioId,
      activeYear: chartState.activeYear,
      activePage: chartState.activePage,
      expandedCategoryKey: chartState.expandedCategoryKey,
      entryCategoryKey: chartState.entryCategoryKey,
    },
    "*",
  );
}

form.addEventListener("input", update);

function yearFromChartEvent(event) {
  const point = event.target.closest?.("[data-year]");
  if (point) return Number(point.dataset.year);

  const svg = event.target.closest?.("svg");
  const meta = chartState.routeMeta;
  if (!svg || !meta || typeof svg.getBoundingClientRect !== "function") return null;

  const rect = svg.getBoundingClientRect();
  const svgX = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * meta.svgWidth;
  const nearest = meta.years.reduce((best, item) => {
    return Math.abs(item.x - svgX) < Math.abs(best.x - svgX) ? item : best;
  }, meta.years[0]);
  return nearest?.year ?? null;
}

function selectChartYear(year, options = {}) {
  if (!chartState.result || year === null || Number.isNaN(year)) return;
  chartState.activeYear = clamp(year, 0, getRoutePoints(chartState.result).length - 1);
  renderChart(chartState.result);
  if (options.sync) {
    syncPhonePreview(chartState.values);
  }
}

els.assetChart.addEventListener("pointerdown", (event) => {
  if (event.target.closest?.("[data-year-range]")) return;
  chartState.isScrubbing = true;
  els.assetChart.classList.add("is-scrubbing");
  event.target.setPointerCapture?.(event.pointerId);
  selectChartYear(yearFromChartEvent(event), { sync: true });
});
els.assetChart.addEventListener("pointermove", (event) => {
  if (!chartState.isScrubbing) return;
  selectChartYear(yearFromChartEvent(event), { sync: true });
});
els.assetChart.addEventListener("pointerup", (event) => {
  chartState.isScrubbing = false;
  els.assetChart.classList.remove("is-scrubbing");
  event.target.releasePointerCapture?.(event.pointerId);
});
els.assetChart.addEventListener("pointerleave", () => {
  chartState.isScrubbing = false;
  els.assetChart.classList.remove("is-scrubbing");
});
els.assetChart.addEventListener("click", (event) => {
  if (event.target.closest?.("[data-year-range]")) return;
  selectChartYear(yearFromChartEvent(event), { sync: true });
});
els.assetChart.addEventListener("input", (event) => {
  const slider = event.target.closest?.("[data-year-range]");
  if (!slider) return;
  selectChartYear(Number(slider.value), { sync: true });
});
els.scenarioList.addEventListener("click", (event) => {
  const item = event.target.closest?.("[data-scenario]");
  if (!item) return;
  if (item.dataset.staticScenario) {
    chartState.activeScenarioId = null;
    if (chartState.values && chartState.result) {
      renderScenarios(chartState.values, chartState.result);
      renderChart(chartState.result);
      syncPhonePreview(chartState.values);
    }
    return;
  }
  chartState.activeScenarioId =
    chartState.activeScenarioId === item.dataset.scenario ? null : item.dataset.scenario;
  if (chartState.values && chartState.result) {
    renderScenarios(chartState.values, chartState.result);
    renderChart(chartState.result);
    syncPhonePreview(chartState.values);
  }
});
mobileTabbar?.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-page]");
  if (!button) return;
  setActivePage(button.dataset.page);
});
els.resultsPanel?.addEventListener("click", (event) => {
  const card = event.target.closest?.("[data-jump-page]");
  if (!card) return;
  setActivePage(card.dataset.jumpPage);
});
els.holdingType?.addEventListener("change", updateHoldingFields);
els.holdingInputMode?.addEventListener("change", updateHoldingFields);
els.holdingScreenshot?.addEventListener("change", handleScreenshotImport);
els.confirmOcrButton?.addEventListener("click", confirmPendingOcrResult);
els.cancelOcrButton?.addEventListener("click", cancelPendingOcrResult);
els.refreshQuotesButton?.addEventListener("click", refreshMockQuotes);
els.holdingForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  addHoldingFromForm();
});
els.manualDragForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  addManualDragFromForm();
});
els.securityForm?.addEventListener("input", () => {
  securityAccounts = getSecurityAccountsFromForm();
  saveSecurityAccounts();
  update();
});
els.securityForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  securityAccounts = getSecurityAccountsFromForm();
  saveSecurityAccounts();
  update();
});
els.holdingList?.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-delete-holding]");
  if (button) {
    assetHoldings = assetHoldings.filter((holding) => holding.id !== button.dataset.deleteHolding);
    lastQuoteRefreshImpact = null;
    saveHoldings();
    update();
    return;
  }

  const addButton = event.target.closest?.("[data-add-category]");
  if (addButton) {
    selectHoldingCategory(addButton.dataset.addCategory);
    return;
  }

  const category = event.target.closest?.("[data-toggle-category]");
  if (!category) return;
  chartState.expandedCategoryKey =
    chartState.expandedCategoryKey === category.dataset.toggleCategory ? null : category.dataset.toggleCategory;
  renderAssetOverview();
});
els.holdingList?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const category = event.target.closest?.("[data-toggle-category]");
  if (!category) return;
  event.preventDefault();
  chartState.expandedCategoryKey =
    chartState.expandedCategoryKey === category.dataset.toggleCategory ? null : category.dataset.toggleCategory;
  renderAssetOverview();
});
els.dragList?.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-delete-drag]");
  if (!button) return;
  manualDrags = manualDrags.filter((item) => item.id !== button.dataset.deleteDrag);
  saveManualDrags();
  update();
});
window.addEventListener("message", (event) => {
  if (!isPhonePreview || event.data?.type !== "wealth-demo-values") return;
  chartState.activeScenarioId = event.data.activeScenarioId ?? null;
  chartState.activeYear = event.data.activeYear ?? null;
  chartState.activePage = event.data.activePage ?? "overview";
  chartState.expandedCategoryKey = event.data.expandedCategoryKey ?? "stock";
  chartState.entryCategoryKey = event.data.entryCategoryKey ?? null;
  assetHoldings = event.data.holdings ?? assetHoldings;
  manualDrags = event.data.manualDrags ?? manualDrags;
  securityAccounts = normalizeSecurityAccounts(event.data.securityAccounts ?? securityAccounts);
  setValues(event.data.values ?? defaults);
  setSecurityAccountValues(securityAccounts);
  updateHoldingFields();
  update();
});
phonePreview?.addEventListener("load", () => {
  syncPhonePreview();
});
if (!isPhonePreview && phonePreview?.dataset.src) {
  phonePreview.src = phonePreview.dataset.src;
}
if (typeof window !== "undefined") {
  window.addEventListener("resize", () => {
    if (chartState.result) {
      renderChart(chartState.result);
    }
  });
}

function clearAllLocalData() {
  if (typeof localStorage !== "undefined") {
    [holdingsStorageKey, manualDragsStorageKey, securityAccountsStorageKey].forEach((key) => {
      localStorage.removeItem(key);
    });
  }

  chartState.activeScenarioId = null;
  chartState.activeYear = null;
  chartState.activePage = "overview";
  chartState.expandedCategoryKey = "stock";
  chartState.entryCategoryKey = null;
  lastQuoteRefreshImpact = null;
  mockQuoteRefreshCount = 0;
  assetHoldings = loadHoldings();
  manualDrags = loadManualDrags();
  securityAccounts = loadSecurityAccounts();
  setValues(defaults);
  setSecurityAccountValues(securityAccounts);
  updateHoldingFields();
  update();
}

clearDataButton?.addEventListener("click", () => {
  const confirmed = window.confirm("清除后，本浏览器保存的资产、拖累项和保障账户数据都会删除。确定继续吗？");
  if (!confirmed) return;
  clearAllLocalData();
});

resetButton.addEventListener("click", () => {
  chartState.activeScenarioId = null;
  chartState.activeYear = null;
  chartState.activePage = "overview";
  chartState.entryCategoryKey = null;
  lastQuoteRefreshImpact = null;
  manualDrags = [];
  securityAccounts = normalizeSecurityAccounts(structuredClone(defaultSecurityAccounts));
  saveManualDrags();
  saveSecurityAccounts();
  setValues(defaults);
  setSecurityAccountValues(securityAccounts);
  updateHoldingFields();
  update();
});

setValues(defaults);
setSecurityAccountValues(securityAccounts);
updateHoldingFields();
update();
setActivePage(chartState.activePage, { silent: true });
