const { getDefaultState, getEmptyState } = require("./demo-data");

const storageKey = "wealth-miniapp-state-v1";
const inputCompletionKeys = [
  "profile",
  "assets",
  "incomeSources",
  "protectionAccounts",
  "dragItems",
];
const canonicalDerivedFields = [
  "monthlyEssentialExpense",
  "liquidCash",
  "investableAssets",
  "targetRetirementAssets",
];
const incomeDerivedFields = [
  "monthlyAmount",
  "netMonthlyCashflow",
  "eligibleMonthlyPassiveIncome",
  "includedInCoreRate",
  "exclusionReason",
  "originKey",
  "duplicateOfOriginKey",
];
let memoryState = null;

function hasWxStorage() {
  return typeof wx !== "undefined" && wx && typeof wx.getStorageSync === "function";
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeSecurityAccounts(defaults, saved) {
  const savedAccounts = saved && typeof saved === "object" ? saved : {};
  const keys = new Set([
    ...Object.keys(defaults || {}),
    ...Object.keys(savedAccounts),
  ]);
  return Array.from(keys).reduce((next, key) => {
    const savedGroup = (savedAccounts && savedAccounts[key]) || {};
    const migratedGroup = { ...savedGroup };
    if (
      migratedGroup.monthlyContribution !== undefined &&
      migratedGroup.personalMonthly === undefined &&
      migratedGroup.employerMonthly === undefined
    ) {
      migratedGroup.personalMonthly = migratedGroup.monthlyContribution;
      migratedGroup.employerMonthly = 0;
    }
    next[key] = {
      ...(defaults[key] || {}),
      ...migratedGroup,
    };
    return next;
  }, {});
}

function normalizeInputCompletion(inputCompletion, mode) {
  const source = inputCompletion && typeof inputCompletion === "object"
    ? inputCompletion
    : {};
  return inputCompletionKeys.reduce((next, key) => {
    next[key] = mode === "user" && source[key] === true;
    return next;
  }, {});
}

function stripCanonicalDerivedFields(state) {
  const next = { ...state };
  canonicalDerivedFields.forEach((key) => {
    delete next[key];
  });
  return next;
}

function stripIncomeDerivedFields(income) {
  if (!income || typeof income !== "object") {
    return income;
  }

  const next = { ...income };
  incomeDerivedFields.forEach((key) => {
    delete next[key];
  });
  return next;
}

function migrateState(state) {
  const source = stripCanonicalDerivedFields(
    state && typeof state === "object" ? state : {},
  );
  const mode = source.mode === "demo" ? "demo" : "user";
  const defaults = mode === "demo" ? getDefaultState() : getEmptyState();
  return {
    ...defaults,
    ...source,
    schemaVersion: 2,
    mode,
    inputCompletion: normalizeInputCompletion(source.inputCompletion, mode),
    userProfile: {
      ...defaults.userProfile,
      ...((source && source.userProfile) || {}),
    },
    holdings: Array.isArray(source.holdings) ? source.holdings : defaults.holdings,
    incomeStreams: Array.isArray(source.incomeStreams)
      ? source.incomeStreams.map(stripIncomeDerivedFields)
      : defaults.incomeStreams,
    manualDrags: Array.isArray(source.manualDrags) ? source.manualDrags : defaults.manualDrags,
    securityAccounts: mergeSecurityAccounts(defaults.securityAccounts, source.securityAccounts),
    calculationSnapshots: Array.isArray(source.calculationSnapshots) ? source.calculationSnapshots : [],
    valuationSnapshots: Array.isArray(source.valuationSnapshots) ? source.valuationSnapshots : [],
  };
}

function hasStateChanged(saved, normalized) {
  return JSON.stringify(saved) !== JSON.stringify(normalized);
}

function loadState() {
  if (hasWxStorage()) {
    const saved = wx.getStorageSync(storageKey);
    if (saved && typeof saved === "object") {
      const normalized = migrateState(saved);
      if (hasStateChanged(saved, normalized)) wx.setStorageSync(storageKey, normalized);
      return normalized;
    }
    const defaults = migrateState(getDefaultState());
    wx.setStorageSync(storageKey, defaults);
    return clone(defaults);
  }

  if (!memoryState) memoryState = migrateState(getDefaultState());
  return clone(migrateState(memoryState));
}

function saveState(nextState) {
  const state = clone(migrateState(nextState));
  if (hasWxStorage()) {
    wx.setStorageSync(storageKey, state);
    return state;
  }

  memoryState = state;
  return clone(memoryState);
}

function resetState() {
  const defaults = getDefaultState();
  return saveState(defaults);
}

function clearState() {
  const emptyState = getEmptyState();
  if (hasWxStorage()) {
    wx.removeStorageSync(storageKey);
    wx.setStorageSync(storageKey, emptyState);
  }
  memoryState = emptyState;
  return clone(emptyState);
}

module.exports = {
  storageKey,
  loadState,
  saveState,
  resetState,
  clearState,
  migrateState,
};
