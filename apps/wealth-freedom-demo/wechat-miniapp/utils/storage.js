const { getDefaultState, getEmptyState } = require("./demo-data");
const { validateLiabilityFacts } = require("./liability-model");

const storageKey = "wealth-miniapp-state-v1";
const inputCompletionKeys = [
  "profile",
  "assets",
  "incomeSources",
  "protectionAccounts",
  "dragItems",
  "liabilities",
];
const snapshotDerivedFields = [
  "protectionAccounts",
  "dragItems",
  "totalLiabilities",
  "totalMonthlyPayment",
  "uncoveredMonthlyPayment",
  "effectiveEssentialExpense",
  "investableNetAssets",
];
const canonicalDerivedFields = [
  "monthlyEssentialExpense",
  "liquidCash",
  "investableAssets",
  "targetRetirementAssets",
  ...snapshotDerivedFields,
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

function stripSnapshotDerivedFields(value, isInputCompletion = false) {
  if (Array.isArray(value)) {
    return value.map((item) => stripSnapshotDerivedFields(item));
  }
  if (!value || typeof value !== "object") return value;

  const next = { ...value };
  Object.keys(next).forEach((key) => {
    // These booleans are historical confirmation facts, not derived payloads.
    const isConfirmationFact = isInputCompletion && typeof value[key] === "boolean"
      && (key === "protectionAccounts" || key === "dragItems");
    if (snapshotDerivedFields.includes(key) && !isConfirmationFact) {
      delete next[key];
    } else {
      next[key] = stripSnapshotDerivedFields(value[key], key === "inputCompletion");
    }
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

function normalizeV3Liabilities(source, isV3) {
  if (!isV3) return [];

  const validation = validateLiabilityFacts(source.liabilities);
  if (!validation.ok) throw new Error(validation.message);
  return validation.value;
}

function migrateState(state) {
  const source = stripCanonicalDerivedFields(
    state && typeof state === "object" ? state : {},
  );
  const isV3 = source.schemaVersion === 3;
  const mode = source.mode === "demo" ? "demo" : "user";
  const defaults = mode === "demo" ? getDefaultState() : getEmptyState();
  const inputCompletion = normalizeInputCompletion(source.inputCompletion, mode);
  return {
    ...defaults,
    ...source,
    schemaVersion: 3,
    mode,
    inputCompletion: {
      ...inputCompletion,
      liabilities: isV3 ? inputCompletion.liabilities : false,
    },
    userProfile: {
      ...defaults.userProfile,
      ...((source && source.userProfile) || {}),
    },
    holdings: Array.isArray(source.holdings) ? source.holdings : defaults.holdings,
    incomeStreams: Array.isArray(source.incomeStreams)
      ? source.incomeStreams.map(stripIncomeDerivedFields)
      : defaults.incomeStreams,
    manualDrags: Array.isArray(source.manualDrags) ? source.manualDrags : defaults.manualDrags,
    liabilities: normalizeV3Liabilities(source, isV3),
    securityAccounts: mergeSecurityAccounts(defaults.securityAccounts, source.securityAccounts),
    calculationSnapshots: Array.isArray(source.calculationSnapshots)
      ? stripSnapshotDerivedFields(source.calculationSnapshots) : [],
    valuationSnapshots: Array.isArray(source.valuationSnapshots)
      ? stripSnapshotDerivedFields(source.valuationSnapshots) : [],
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
