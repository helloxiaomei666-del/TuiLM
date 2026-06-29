const defaultProfile = {
  age: 28,
  target: 3000000,
  salary: 18000,
  sideIncome: 2000,
  livingCost: 8500,
  targetMonthlyLivingCost: 8500,
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

const defaultHoldings = [
  {
    id: "cash-sample",
    type: "cash",
    name: "现金账户",
    instrument: "cash",
    quantity: 1,
    costPrice: 120000,
    currentPrice: 120000,
    currentValue: 120000,
    costAmount: 120000,
    todayPnl: 0,
    updatedAt: "示例初始",
    source: "manual",
  },
  {
    id: "stock-fund-sample",
    type: "stock",
    instrument: "fund",
    name: "沪深300指数基金",
    code: "000300",
    quantity: 70000,
    costPrice: 1.1714,
    currentPrice: 1.2286,
    currentValue: 86002,
    costAmount: 81998,
    todayPnl: -585,
    updatedAt: "示例初始",
    source: "manual",
  },
  {
    id: "bond-sample",
    type: "bond",
    instrument: "bondFund",
    name: "中短债基金",
    code: "bond-demo",
    quantity: 50000,
    costPrice: 1.18,
    currentPrice: 1.2,
    currentValue: 60000,
    costAmount: 59000,
    todayPnl: 72,
    updatedAt: "示例初始",
    source: "manual",
  },
  {
    id: "commodity-gold-sample",
    type: "commodity",
    instrument: "gold",
    name: "黄金资产",
    code: "gold-demo",
    quantity: 100,
    costPrice: 640,
    currentPrice: 660,
    currentValue: 66000,
    costAmount: 64000,
    todayPnl: 277,
    updatedAt: "示例初始",
    source: "manual",
  },
];

const defaultManualDrags = [];

const defaultIncomeStreams = [];

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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getDefaultState() {
  return {
    userProfile: clone(defaultProfile),
    holdings: clone(defaultHoldings),
    incomeStreams: clone(defaultIncomeStreams),
    manualDrags: clone(defaultManualDrags),
    securityAccounts: clone(defaultSecurityAccounts),
    calculationSnapshots: [],
    valuationSnapshots: [],
  };
}

module.exports = {
  defaultProfile,
  defaultHoldings,
  defaultIncomeStreams,
  defaultManualDrags,
  defaultSecurityAccounts,
  getDefaultState,
};
