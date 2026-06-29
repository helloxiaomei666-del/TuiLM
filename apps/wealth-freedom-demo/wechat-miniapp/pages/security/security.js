const storage = require("../../utils/storage");
const { getOverviewModel } = require("../../utils/overview-model");
const {
  buildSecurityForm,
  getSecurityCategoryView,
  getSecurityGroups,
  getSecuritySummary,
  updateSecurityField,
} = require("../../utils/security-model");

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
  },

  onShow() {
    this.load();
  },

  load() {
    this.applyState(storage.loadState());
  },

  applyState(state) {
    const model = getOverviewModel(state);
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
    };
    storage.saveState(state);
    this.applyState(state);
  },
});
