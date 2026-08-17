const validSecurityAccounts = {
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

const expectedProtectionAccounts = [
  {
    id: "security:pension",
    sourceKey: "pension",
    type: "social_security",
    status: "future",
    coverageLevel: "partial",
    balance: 120000,
    yearsPaid: 12,
    personalMonthlyContribution: 900,
    employerMonthlyContribution: 1800,
    actualMonthlyReceived: 0,
    futureEstimatedMonthlyAmount: 2600,
  },
  {
    id: "security:housingFund",
    sourceKey: "housingFund",
    type: "welfare_asset",
    status: "current",
    coverageLevel: "partial",
    balance: 85000,
    personalMonthlyContribution: 1200,
    employerMonthlyContribution: 1200,
    currentLoanOffsetMonthly: 0,
  },
  {
    id: "security:supplementalHousingFund",
    sourceKey: "supplementalHousingFund",
    type: "welfare_asset",
    status: "current",
    coverageLevel: "partial",
    balance: 20000,
    personalMonthlyContribution: 400,
    employerMonthlyContribution: 400,
    currentLoanOffsetMonthly: 0,
  },
  {
    id: "security:enterpriseAnnuity",
    sourceKey: "enterpriseAnnuity",
    type: "social_security",
    status: "future",
    coverageLevel: "partial",
    balance: 30000,
    personalMonthlyContribution: 200,
    employerMonthlyContribution: 300,
    actualMonthlyReceived: 0,
    futureEstimatedMonthlyAmount: 300,
  },
  {
    id: "security:occupationalAnnuity",
    sourceKey: "occupationalAnnuity",
    type: "social_security",
    status: "future",
    coverageLevel: "partial",
    balance: 0,
    personalMonthlyContribution: 0,
    employerMonthlyContribution: 0,
    actualMonthlyReceived: 0,
    futureEstimatedMonthlyAmount: 0,
  },
];

const invalidSecurityAccounts = {
  pension: {
    balance: -1,
    yearsPaid: Number.NaN,
    personalMonthly: Number.POSITIVE_INFINITY,
    employerMonthly: Number.NEGATIVE_INFINITY,
    estimatedMonthlyBenefit: "2600",
  },
  housingFund: {
    balance: -85000,
    personalMonthly: Number.NaN,
    employerMonthly: Number.POSITIVE_INFINITY,
    loanOffsetMonthly: -1,
  },
};

module.exports = {
  validSecurityAccounts,
  expectedProtectionAccounts,
  invalidSecurityAccounts,
};
