const storage = require("../../utils/storage");
const { getOverviewModel } = require("../../utils/overview-model");

const tabRoutes = {
  assets: "/pages/assets/assets",
  security: "/pages/security/security",
  route: "/pages/route/route",
  drags: "/pages/drags/drags",
};

function numberInput(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const emptyOverview = {
  progress: 0,
  progressWidth: "0.0%",
  progressText: "0.0%",
  statusText: "",
  freedomDate: "",
  freedomAge: "",
  currentAssetsText: "",
  monthlyInvestableText: "",
  todayPnlText: "",
  valuationChangeText: "",
  valuationRateText: "",
  valuationStatusText: "",
  valuationTimeText: "",
  valuationSourceText: "",
  annualReturnText: "",
  salaryGrowthText: "",
  dragTotalText: "",
  dragCountText: "",
  securityTotalText: "",
  securitySupportText: "",
  cashflowTitle: "",
  cashflowText: "",
  monthlyIncomeText: "",
  baseExpenseText: "",
  cashflowRetirementRateText: "",
  cashflowRetirementProgressWidth: "0.0%",
  assetRetirementRateText: "",
  runwayMonthsText: "",
  laborDependenceRateText: "",
  monthlyPassiveIncomeText: "",
  monthlySemiPassiveIncomeText: "",
  passiveIncomeGapText: "",
  passiveIncomeSurplusText: "",
  combinedCoverageRateText: "",
  cashflowHeadlineText: "",
  cashflowDenominatorText: "",
  cashflowStatusLabel: "",
  cashflowStatusCode: "",
  cashflowDisclosureText: "",
};

Page({
  data: {
    state: null,
    profile: {},
    overview: emptyOverview,
    isEditingProfile: false,
    showAdvancedProfile: false,
  },

  onLoad() {
    this.load();
  },

  onShow() {
    this.load();
  },

  load() {
    const state = storage.loadState();
    this.applyState(state);
  },

  applyState(state) {
    const overview = getOverviewModel(state);
    this.setData({
      state,
      profile: state.userProfile,
      overview,
    });
  },

  onProfileInput(event) {
    const field = event.currentTarget.dataset.field;
    const value = numberInput(event.detail.value);
    const state = {
      ...this.data.state,
      userProfile: {
        ...this.data.state.userProfile,
        [field]: value,
        updatedAt: new Date().toISOString(),
      },
    };
    storage.saveState(state);
    this.applyState(state);
  },

  resetExample() {
    const state = storage.resetState();
    this.applyState(state);
  },

  clearLocalData() {
    storage.clearState();
    this.load();
  },

  toggleEditPanel() {
    const nextEditing = !this.data.isEditingProfile;
    this.setData({
      isEditingProfile: nextEditing,
      showAdvancedProfile: nextEditing ? this.data.showAdvancedProfile : false,
    });
  },

  toggleAdvancedProfile() {
    this.setData({
      showAdvancedProfile: !this.data.showAdvancedProfile,
    });
  },

  goTab(event) {
    const page = event.currentTarget.dataset.page;
    const url = tabRoutes[page];
    if (!url) return;
    wx.switchTab({ url });
  },

  openLegal() {
    wx.navigateTo({
      url: "/pages/legal/legal",
    });
  },
});
