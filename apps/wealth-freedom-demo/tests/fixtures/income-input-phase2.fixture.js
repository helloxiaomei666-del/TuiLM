const v1IncomeTypeLabels = [
  ["rental_property", "房租收入"],
  ["stock_dividend", "股票分红"],
  ["dividend_etf_distribution", "ETF 分红"],
  ["bond_coupon", "债券利息"],
  ["deposit_interest", "存款利息"],
  ["money_market_fund_income", "货币基金收益"],
  ["pension_received", "已领取养老金"],
  ["annuity_received", "已领取年金"],
];

const receivedDividendForm = {
  sourceType: "stock_dividend",
  rawAmount: 1200,
  frequency: "annual",
  actualReceived: true,
  requiresLabor: false,
};

const unreceivedDividendForm = {
  sourceType: "stock_dividend",
  rawAmount: 1200,
  frequency: "annual",
  actualReceived: false,
  requiresLabor: false,
};

const rentalForm = {
  sourceType: "rental_property",
  rawAmount: 6000,
  frequency: "monthly",
  actualReceived: true,
  requiresLabor: false,
  taxOrFee: 300,
  maintenanceCost: 500,
  otherNecessaryCost: 200,
};

module.exports = {
  v1IncomeTypeLabels,
  receivedDividendForm,
  unreceivedDividendForm,
  rentalForm,
};
