const storage = require("../../utils/storage");
const { getOverviewModel } = require("../../utils/overview-model");
const { buildProtectionAccounts } = require("../../utils/security-protection-accounts-bridge");
const {
  buildSecurityForm,
  getSecurityCategoryView,
  getSecurityGroups,
  getSecuritySummary,
  updateSecurityField,
} = require("../../utils/security-model");

function showSecurityMessage(title) {
  if (typeof wx !== "undefined" && wx && typeof wx.showToast === "function") {
    wx.showToast({ title, icon: "none" });
  }
}

Page({
  data: {
    state: null,
    summary: {
      totalText: "-",
      supportFactorText: "-",
      supportText: "不计入可投资资产",
      monthlyIncomeText: "预计月领 -",
      loanOffsetText: "冲还贷 -",
      pensionProgressText: "-",
      pensionGapText: "-",
      impactText: "退休保障不会进入可投资资产，但会用于解释退休缺口和未来保障参考。",
    },
    fields: [],
    groups: [],
    securityCategories: [],
    groupsInCategory: [],
    selectedCategory: null,
    selectedGroup: null,
    selectedSecurityCategoryKey: "socialSecurity",
    selectedSecurityGroupKey: "pension",
    securityCompletionText: "保障情况待确认",
    hasProtectionAccounts: false,
    confirmProtectionText: "确认以上是我当前完整的保障情况",
    confirmNoProtectionText: "我目前没有这些保障账户",
  },

  onShow() {
    this.load();
  },

  load() {
    this.applyState(storage.loadState());
  },

  applyState(state) {
    const model = getOverviewModel(state);
    const protectionAccounts = buildProtectionAccounts(state.securityAccounts || {});
    const hasProtectionAccounts = protectionAccounts.length > 0;
    const confirmed = state.inputCompletion && state.inputCompletion.protectionAccounts === true;
    const securityCompletionText = !confirmed
      ? "保障情况待确认"
      : hasProtectionAccounts
        ? "保障情况已确认"
        : "我目前没有这些保障账户";
    const securityView = getSecurityCategoryView(
      state.securityAccounts || {},
      this.data.selectedSecurityCategoryKey,
      this.data.selectedSecurityGroupKey
    );
    this.setData({
      state,
      summary: getSecuritySummary(state.securityAccounts || {}, model.values, model.result),
      fields: buildSecurityForm(state.securityAccounts || {}),
      groups: getSecurityGroups(state.securityAccounts || {}),
      securityCategories: securityView.categories,
      groupsInCategory: securityView.groupsInCategory,
      selectedCategory: securityView.selectedCategory,
      selectedGroup: securityView.selectedGroup,
      selectedSecurityCategoryKey: securityView.selectedCategoryKey,
      selectedSecurityGroupKey: securityView.selectedGroupKey,
      securityCompletionText,
      hasProtectionAccounts,
    });
  },

  switchSecurityCategory(event) {
    const categoryKey = event.currentTarget.dataset.category;
    const securityView = getSecurityCategoryView(this.data.state.securityAccounts || {}, categoryKey, "");
    this.setData({
      selectedSecurityCategoryKey: securityView.selectedCategoryKey,
      selectedSecurityGroupKey: securityView.selectedGroupKey,
    });
    this.applyState(this.data.state);
  },

  switchSecurityGroup(event) {
    const groupKey = event.currentTarget.dataset.group;
    this.setData({
      selectedSecurityGroupKey: groupKey,
    });
    this.applyState(this.data.state);
  },

  onSecurityInput(event) {
    const key = event.currentTarget.dataset.key;
    const securityAccounts = updateSecurityField(this.data.state.securityAccounts || {}, key, event.detail.value);
    const state = {
      ...this.data.state,
      securityAccounts,
      inputCompletion: {
        ...(this.data.state.inputCompletion || {}),
        protectionAccounts: false,
      },
    };
    storage.saveState(state);
    this.applyState(state);
  },

  confirmProtectionAccounts() {
    const state = this.data.state;
    if (buildProtectionAccounts(state.securityAccounts || {}).length === 0) {
      showSecurityMessage("请先录入保障信息，或确认目前没有这些保障账户");
      return;
    }

    const nextState = {
      ...state,
      inputCompletion: {
        ...(state.inputCompletion || {}),
        protectionAccounts: true,
      },
    };
    storage.saveState(nextState);
    this.applyState(nextState);
  },

  confirmNoProtectionAccounts() {
    const state = this.data.state;
    if (buildProtectionAccounts(state.securityAccounts || {}).length > 0) {
      showSecurityMessage("请先清空或核对保障账户信息");
      return;
    }

    const nextState = {
      ...state,
      inputCompletion: {
        ...(state.inputCompletion || {}),
        protectionAccounts: true,
      },
    };
    storage.saveState(nextState);
    this.applyState(nextState);
  },
});
