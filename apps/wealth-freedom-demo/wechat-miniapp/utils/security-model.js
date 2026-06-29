const calc = require("./calculation-core");
const { yuan } = require("./format");

const securityFields = [
  { key: "pension.balance", label: "养老金余额" },
  { key: "pension.yearsPaid", label: "已缴年限" },
  { key: "pension.personalMonthly", label: "养老金个人月缴" },
  { key: "pension.employerMonthly", label: "养老金单位月缴" },
  { key: "pension.estimatedMonthlyBenefit", label: "养老金预计月领" },
  { key: "housingFund.balance", label: "公积金余额" },
  { key: "housingFund.personalMonthly", label: "公积金个人月缴" },
  { key: "housingFund.employerMonthly", label: "公积金单位月缴" },
  { key: "housingFund.loanOffsetMonthly", label: "公积金每月冲还贷" },
  { key: "supplementalHousingFund.balance", label: "补充公积金余额" },
  { key: "supplementalHousingFund.personalMonthly", label: "补充公积金个人月缴" },
  { key: "supplementalHousingFund.employerMonthly", label: "补充公积金单位月缴" },
  { key: "supplementalHousingFund.loanOffsetMonthly", label: "补充公积金每月冲还贷" },
  { key: "enterpriseAnnuity.balance", label: "企业年金余额" },
  { key: "enterpriseAnnuity.personalMonthly", label: "企业年金个人月缴" },
  { key: "enterpriseAnnuity.employerMonthly", label: "企业年金单位月缴" },
  { key: "enterpriseAnnuity.estimatedMonthlyBenefit", label: "企业年金预计月领" },
  { key: "occupationalAnnuity.balance", label: "职业年金余额" },
  { key: "occupationalAnnuity.personalMonthly", label: "职业年金个人月缴" },
  { key: "occupationalAnnuity.employerMonthly", label: "职业年金单位月缴" },
  { key: "occupationalAnnuity.estimatedMonthlyBenefit", label: "职业年金预计月领" },
];

const securityGroupConfigs = [
  {
    key: "pension",
    categoryKey: "socialSecurity",
    title: "基本养老保险",
    note: "国家退休保障体系，用于记录预计退休后月领，不代表当前收入。",
    retirementRole: "stable_retirement_cashflow",
    calculationRole: "retirement_cashflow",
    fields: ["pension.balance", "pension.yearsPaid", "pension.personalMonthly", "pension.employerMonthly", "pension.estimatedMonthlyBenefit"],
  },
  {
    key: "housingFund",
    categoryKey: "welfareAsset",
    title: "住房公积金",
    note: "工作期间积累的福利性资产，可用于资产与净资产统计，默认不计入退休率。",
    retirementRole: "welfare_asset",
    calculationRole: "welfare_asset",
    fields: ["housingFund.balance", "housingFund.personalMonthly", "housingFund.employerMonthly", "housingFund.loanOffsetMonthly"],
  },
  {
    key: "supplementalHousingFund",
    categoryKey: "welfareAsset",
    title: "补充公积金",
    note: "补充性的福利资产，与住房公积金一起进入福利资产统计。",
    retirementRole: "welfare_asset",
    calculationRole: "welfare_asset",
    fields: [
      "supplementalHousingFund.balance",
      "supplementalHousingFund.personalMonthly",
      "supplementalHousingFund.employerMonthly",
      "supplementalHousingFund.loanOffsetMonthly",
    ],
  },
  {
    key: "enterpriseAnnuity",
    categoryKey: "socialSecurity",
    title: "企业年金",
    note: "单位补充退休保障，用于记录预计退休后月领，不纳入当前退休率。",
    retirementRole: "stable_retirement_cashflow",
    calculationRole: "retirement_cashflow",
    fields: [
      "enterpriseAnnuity.balance",
      "enterpriseAnnuity.personalMonthly",
      "enterpriseAnnuity.employerMonthly",
      "enterpriseAnnuity.estimatedMonthlyBenefit",
    ],
  },
  {
    key: "occupationalAnnuity",
    categoryKey: "socialSecurity",
    title: "职业年金",
    note: "职业体系下的退休保障来源，用于记录预计退休后月领，不纳入当前退休率。",
    retirementRole: "stable_retirement_cashflow",
    calculationRole: "retirement_cashflow",
    fields: [
      "occupationalAnnuity.balance",
      "occupationalAnnuity.personalMonthly",
      "occupationalAnnuity.employerMonthly",
      "occupationalAnnuity.estimatedMonthlyBenefit",
    ],
  },
  {
    key: "commercialPensionInsurance",
    categoryKey: "socialSecurity",
    title: "商业养老保险（预留）",
    note: "预留给未来商业养老保险录入，目前不影响计算结果。",
    retirementRole: "stable_retirement_cashflow",
    calculationRole: "reserved_retirement_cashflow",
    isReserved: true,
    fields: [],
  },
];

const securityCategoryConfigs = [
  {
    key: "socialSecurity",
    title: "社会保障",
    note: "用于记录预计退休后月领的保障体系，仅用于未来保障参考。",
  },
  {
    key: "welfareAsset",
    title: "福利资产",
    note: "工作期间积累的福利性资产，仅作结构展示和未来支持解释，不计入当前退休率。",
  },
];

const legacyCategoryKeyMap = {
  insurance: "socialSecurity",
  fund: "welfareAsset",
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function numberOr(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function setByPath(target, path, value) {
  const [group, field] = path.split(".");
  target[group] = {
    ...(target[group] || {}),
    [field]: numberOr(value, 0),
  };
  return target;
}

function getByPath(target, path) {
  const [group, field] = path.split(".");
  const groupData = target && target[group] ? target[group] : {};
  return groupData[field] === undefined || groupData[field] === null ? 0 : groupData[field];
}

function updateSecurityField(accounts, path, value) {
  return setByPath(clone(accounts || {}), path, value);
}

function buildSecurityForm(accounts = {}) {
  return securityFields.map((field) => ({
    ...field,
    value: getByPath(accounts, field.key),
  }));
}

function getFieldDefinition(key) {
  return securityFields.find((field) => field.key === key) || { key, label: key };
}

function getMonthlyContribution(accounts, groupKey) {
  return getByPath(accounts, `${groupKey}.personalMonthly`) + getByPath(accounts, `${groupKey}.employerMonthly`);
}

function getSecurityGroups(accounts = {}) {
  return securityGroupConfigs.map((group) => {
    const balance = getByPath(accounts, `${group.key}.balance`);
    const monthlyContribution = getMonthlyContribution(accounts, group.key);
    const estimatedBenefit = getByPath(accounts, `${group.key}.estimatedMonthlyBenefit`);
    const loanOffset = getByPath(accounts, `${group.key}.loanOffsetMonthly`);
    const fields = group.fields.map((key) => {
      const definition = getFieldDefinition(key);
      return {
        ...definition,
        value: getByPath(accounts, key),
      };
    });
    return {
      key: group.key,
      categoryKey: group.categoryKey,
      title: group.title,
      note: group.note,
      retirementRole: group.retirementRole,
      calculationRole: group.calculationRole,
      isReserved: !!group.isReserved,
      balanceText: yuan(balance),
      monthlyContributionText: yuan(monthlyContribution),
      benefitText: group.isReserved
        ? "预留入口，暂不参与计算"
        : estimatedBenefit > 0
          ? `预计月领 ${yuan(estimatedBenefit)}`
          : loanOffset > 0
            ? `冲还贷 ${yuan(loanOffset)}`
            : group.calculationRole === "welfare_asset"
              ? "福利资产，默认不计入退休率"
              : "暂无稳定月领",
      fields,
    };
  });
}

function getSecurityCategoryView(accounts = {}, selectedCategoryKey = "socialSecurity", selectedGroupKey = "") {
  const groups = getSecurityGroups(accounts);
  const fallbackCategory = securityCategoryConfigs[0];
  const normalizedCategoryKey = legacyCategoryKeyMap[selectedCategoryKey] || selectedCategoryKey;
  const hasCategory = securityCategoryConfigs.some((category) => category.key === normalizedCategoryKey);
  const currentCategoryKey = hasCategory ? normalizedCategoryKey : fallbackCategory.key;
  const selectedCategoryConfig = securityCategoryConfigs.find((category) => category.key === currentCategoryKey) || fallbackCategory;
  const groupsInCategory = groups.filter((group) => group.categoryKey === selectedCategoryConfig.key);
  const hasGroup = groupsInCategory.some((group) => group.key === selectedGroupKey);
  const currentGroupKey = hasGroup ? selectedGroupKey : groupsInCategory[0] && groupsInCategory[0].key;
  const selectedGroup = groupsInCategory.find((group) => group.key === currentGroupKey) || groupsInCategory[0] || null;

  return {
    categories: securityCategoryConfigs.map((category) => {
      const categoryGroups = groups.filter((group) => group.categoryKey === category.key);
      return {
        ...category,
        isActive: category.key === selectedCategoryConfig.key,
        className: category.key === selectedCategoryConfig.key ? "is-active" : "",
        countText: `${categoryGroups.length} 项`,
      };
    }),
    groups,
    groupsInCategory: groupsInCategory.map((group) => ({
      ...group,
      isActive: selectedGroup ? group.key === selectedGroup.key : false,
      className: selectedGroup && group.key === selectedGroup.key ? "is-active" : "",
    })),
    selectedCategory: {
      ...selectedCategoryConfig,
      countText: `${groupsInCategory.length} 项`,
    },
    selectedGroup,
    selectedCategoryKey: selectedCategoryConfig.key,
    selectedGroupKey: selectedGroup ? selectedGroup.key : "",
  };
}

function getSecuritySummary(accounts = {}, values, baseResult) {
  const total = calc.getSecurityAccountTotal(accounts);
  const support = values && baseResult ? calc.getSecuritySupport(values, baseResult, accounts) : null;
  const pensionYearsPaid = accounts.pension && accounts.pension.yearsPaid ? accounts.pension.yearsPaid : 0;
  const pensionGapYears = Math.max(0, 20 - pensionYearsPaid);
  const supportFactorText = support ? `${(support.supportFactor * 100).toFixed(1)}%` : "-";
  return {
    total,
    totalText: yuan(total),
    supportFactorText,
    supportText: support ? `未来支持参考 ${(support.supportFactor * 100).toFixed(1)}%，不计入可投资资产` : "不计入可投资资产",
    monthlyIncomeText: support ? `预计月领 ${yuan(support.monthlyRetirementIncome)}` : "预计月领 -",
    loanOffsetText: support ? `冲还贷 ${yuan(support.housingLoanOffsetMonthly)}` : "冲还贷 -",
    pensionProgressText: `${Math.min(100, (pensionYearsPaid / 20) * 100).toFixed(1)}%`,
    pensionGapText: pensionGapYears > 0 ? `距离 20 年目标还差 ${pensionGapYears} 年` : "已达到 20 年缴费演示目标",
    impactText: support
      ? `预计退休后月领 ${yuan(support.monthlyRetirementIncome)}，当前房贷冲还参考 ${yuan(support.housingLoanOffsetMonthly)}。`
      : "退休保障不会进入可投资资产，但会用于解释退休缺口和未来保障参考。",
  };
}

module.exports = {
  securityCategoryConfigs,
  securityGroupConfigs,
  securityFields,
  buildSecurityForm,
  getSecurityCategoryView,
  getSecurityGroups,
  getSecuritySummary,
  updateSecurityField,
};
