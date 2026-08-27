const validLiabilities = [
  {
    id: "liability-mortgage",
    type: "mortgage",
    outstandingBalance: 120000,
    monthlyPayment: 1600,
    includedInEssentialExpense: true,
    source: "manual",
    note: "自住房贷款",
  },
  {
    id: "liability-car-loan",
    type: "car_loan",
    outstandingBalance: 30000,
    monthlyPayment: 900,
    includedInEssentialExpense: false,
    source: "manual",
    note: "",
  },
];

const summaryContext = {
  monthlyEssentialExpense: 6000,
  investableAssetsTotal: 100000,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  validLiabilities,
  summaryContext,
  clone,
};
