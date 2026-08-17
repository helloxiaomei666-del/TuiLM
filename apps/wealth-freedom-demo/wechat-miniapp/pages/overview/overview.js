const storage = require("../../utils/storage");
const { getOverviewModel } = require("../../utils/overview-model");
const { getRouteYears } = require("../../utils/route-model");

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

function formatDisplayDate(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const monthText = month < 10 ? `0${month}` : `${month}`;
  const dayText = day < 10 ? `0${day}` : `${day}`;
  return `${year}-${monthText}-${dayText}`;
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

const routeNodes = [
  { label: "现在", className: "is-current" },
  { label: "2年", className: "" },
  { label: "4年", className: "" },
  { label: "6年", className: "" },
  { label: "8年", className: "" },
  { label: "10年", className: "" },
];

const emptyOverviewView = {
  phaseLabel: "起步期",
  statusCopyLine1: "你现在还主要依赖工资收入，",
  statusCopyLine2: "下一步先提高被动收入覆盖率。",
};

const emptyRoutePreview = {
  headline: "补充数据后即可生成路线预览。",
  gapText: "距离目标还差 --",
  nodes: routeNodes,
};

function getPhaseLabel(progress) {
  if (progress >= 100) return "已超过当前设定目标";
  if (progress >= 70) return "接近期";
  if (progress >= 30) return "推进期";
  return "起步期";
}

function buildOverviewView(overview) {
  return {
    phaseLabel: getPhaseLabel(overview.progress),
    statusCopyLine1: "你现在还主要依赖工资收入，",
    statusCopyLine2: "下一步先提高被动收入覆盖率。",
  };
}

function findReachYear(routeYears, target) {
  for (let index = 0; index < routeYears.length; index += 1) {
    if (target > 0 && routeYears[index].assets >= target) return routeYears[index];
  }
  return null;
}

function getYearAtOrBefore(routeYears, targetYear) {
  if (!routeYears.length) return null;
  let selected = routeYears[0];
  for (let index = 0; index < routeYears.length; index += 1) {
    if (routeYears[index].year <= targetYear) selected = routeYears[index];
  }
  return selected;
}

function normalizeGapText(gapText) {
  if (!gapText) return "距离目标还差 --";
  if (gapText.indexOf("距目标还差") === 0) {
    return gapText.replace("距目标还差", "距离目标还差");
  }
  if (gapText.indexOf("已超过目标") === 0) {
    return gapText.replace("已超过目标", "已超过当前设定目标");
  }
  return gapText;
}

function buildRoutePreview(overview) {
  const routeYears = getRouteYears(overview.result);
  const target = Number(overview.result && overview.result.target) || 0;
  const reachYear = findReachYear(routeYears, target);
  const tenthYear = getYearAtOrBefore(routeYears, 10);
  let headline = "当前假设下暂未看到接近目标。";

  if (target > 0 && overview.result && overview.result.currentAssets >= target) {
    headline = "已超过当前设定目标。";
  } else if (reachYear) {
    headline = `预计第 ${reachYear.year} 年接近目标。`;
  }

  return {
    headline,
    gapText: normalizeGapText(tenthYear && tenthYear.gapText),
    nodes: routeNodes,
  };
}

Page({
  data: {
    state: null,
    profile: {},
    overview: emptyOverview,
    overviewView: emptyOverviewView,
    routePreview: emptyRoutePreview,
    displayUpdatedDate: formatDisplayDate(new Date()),
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
      overviewView: buildOverviewView(overview),
      routePreview: buildRoutePreview(overview),
      displayUpdatedDate: formatDisplayDate(new Date()),
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

  openIncome() {
    wx.navigateTo({
      url: "/pages/income/income",
    });
  },
});
