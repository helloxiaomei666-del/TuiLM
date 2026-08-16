const legacyState = {
  userProfile: {
    livingCost: 5000,
    targetMonthlyLivingCost: 6000,
    target: 2000000,
  },
  holdings: [
    {
      id: "legacy-cash",
      type: "cash",
      currentValue: 18000,
    },
    {
      id: "legacy-fund",
      type: "stock",
      currentValue: 1000000,
    },
    {
      id: "legacy-bond",
      type: "bond",
      currentValue: 200000,
    },
  ],
  securityAccounts: {
    pension: {
      balance: 120000,
      estimatedMonthlyBenefit: 2600,
    },
  },
  manualDrags: [
    {
      id: "legacy-mortgage",
      category: "mortgage",
      amount: 3000,
    },
  ],
  incomeStreams: [],
};

module.exports = {
  legacyState,
};
