const { getDefaultState } = require("./demo-data");

const storageKey = "wealth-miniapp-state-v1";
let memoryState = null;

function hasWxStorage() {
  return typeof wx !== "undefined" && wx && typeof wx.getStorageSync === "function";
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeSecurityAccounts(defaults, saved) {
  const savedAccounts = saved || {};
  return Object.keys(defaults).reduce((next, key) => {
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

function migrateState(state) {
  const defaults = getDefaultState();
  return {
    ...defaults,
    ...(state || {}),
    userProfile: {
      ...defaults.userProfile,
      ...((state && state.userProfile) || {}),
    },
    holdings: Array.isArray(state && state.holdings) ? state.holdings : defaults.holdings,
    incomeStreams: Array.isArray(state && state.incomeStreams) ? state.incomeStreams : defaults.incomeStreams,
    manualDrags: Array.isArray(state && state.manualDrags) ? state.manualDrags : defaults.manualDrags,
    securityAccounts: mergeSecurityAccounts(defaults.securityAccounts, state && state.securityAccounts),
    calculationSnapshots: Array.isArray(state && state.calculationSnapshots) ? state.calculationSnapshots : [],
    valuationSnapshots: Array.isArray(state && state.valuationSnapshots) ? state.valuationSnapshots : [],
  };
}

function loadState() {
  if (hasWxStorage()) {
    const saved = wx.getStorageSync(storageKey);
    if (saved && typeof saved === "object") return migrateState(saved);
    const defaults = getDefaultState();
    wx.setStorageSync(storageKey, defaults);
    return defaults;
  }

  if (!memoryState) memoryState = getDefaultState();
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
  if (hasWxStorage()) {
    wx.removeStorageSync(storageKey);
  }
  memoryState = null;
}

module.exports = {
  storageKey,
  loadState,
  saveState,
  resetState,
  clearState,
  migrateState,
};
