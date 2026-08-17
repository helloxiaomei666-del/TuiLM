const accountConfigs = [
  {
    sourceKey: "pension",
    type: "social_security",
    status: "future",
    hasFutureIncomeSafetyMarker: true,
    fields: [
      ["balance", "balance"],
      ["yearsPaid", "yearsPaid"],
      ["personalMonthly", "personalMonthlyContribution"],
      ["employerMonthly", "employerMonthlyContribution"],
      ["estimatedMonthlyBenefit", "futureEstimatedMonthlyAmount"],
    ],
  },
  {
    sourceKey: "housingFund",
    type: "welfare_asset",
    status: "current",
    fields: [
      ["balance", "balance"],
      ["personalMonthly", "personalMonthlyContribution"],
      ["employerMonthly", "employerMonthlyContribution"],
      ["loanOffsetMonthly", "currentLoanOffsetMonthly"],
    ],
  },
  {
    sourceKey: "supplementalHousingFund",
    type: "welfare_asset",
    status: "current",
    fields: [
      ["balance", "balance"],
      ["personalMonthly", "personalMonthlyContribution"],
      ["employerMonthly", "employerMonthlyContribution"],
      ["loanOffsetMonthly", "currentLoanOffsetMonthly"],
    ],
  },
  {
    sourceKey: "enterpriseAnnuity",
    type: "social_security",
    status: "future",
    hasFutureIncomeSafetyMarker: true,
    fields: [
      ["balance", "balance"],
      ["personalMonthly", "personalMonthlyContribution"],
      ["employerMonthly", "employerMonthlyContribution"],
      ["estimatedMonthlyBenefit", "futureEstimatedMonthlyAmount"],
    ],
  },
  {
    sourceKey: "occupationalAnnuity",
    type: "social_security",
    status: "future",
    hasFutureIncomeSafetyMarker: true,
    fields: [
      ["balance", "balance"],
      ["personalMonthly", "personalMonthlyContribution"],
      ["employerMonthly", "employerMonthlyContribution"],
      ["estimatedMonthlyBenefit", "futureEstimatedMonthlyAmount"],
    ],
  },
];

function validNonNegative(value) {
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function buildProtectionAccounts(securityAccounts = {}) {
  const accounts = securityAccounts && typeof securityAccounts === "object"
    ? securityAccounts
    : {};

  return accountConfigs.reduce((records, config) => {
    const source = accounts[config.sourceKey];
    if (!source || typeof source !== "object") return records;

    const record = {
      id: `security:${config.sourceKey}`,
      sourceKey: config.sourceKey,
      type: config.type,
      status: config.status,
      coverageLevel: "partial",
    };
    let hasValidFact = false;

    config.fields.forEach(([sourceField, outputField]) => {
      const value = validNonNegative(source[sourceField]);
      if (value === null) return;
      record[outputField] = value;
      hasValidFact = true;
    });

    if (!hasValidFact) return records;
    if (config.hasFutureIncomeSafetyMarker) record.actualMonthlyReceived = 0;
    records.push(record);
    return records;
  }, []);
}

module.exports = {
  buildProtectionAccounts,
};
