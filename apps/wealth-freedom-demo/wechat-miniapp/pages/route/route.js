const storage = require("../../utils/storage");
const { getOverviewModel } = require("../../utils/overview-model");
const { getRouteChart, getRouteDiagnostics, getRouteYears } = require("../../utils/route-model");

Page({
  data: {
    freedomDate: "-",
    selectedIndex: 0,
    maxYearIndex: 0,
    years: [],
    selected: {
      title: "-",
      assetText: "-",
      gapText: "-",
      netInputText: "-",
    },
    diagnosis: {
      title: "路线诊断",
      cards: [],
      trajectory: [],
    },
    chart: {
      targetText: "-",
      targetLineBottom: "0%",
      reachedText: "-",
      points: [],
    },
  },

  onShow() {
    this.load();
  },

  load() {
    const model = getOverviewModel(storage.loadState());
    const years = getRouteYears(model.result);
    const selectedIndex = Math.min(this.data.selectedIndex || 0, Math.max(years.length - 1, 0));
    this.routeResult = model.result;
    this.setData({
      freedomDate: model.freedomDate,
      selectedIndex,
      maxYearIndex: Math.max(years.length - 1, 0),
      years,
      selected: years[selectedIndex] || this.data.selected,
      diagnosis: getRouteDiagnostics(model.result, selectedIndex),
      chart: getRouteChart(model.result, selectedIndex),
    });
  },

  selectYear(index) {
    const years = this.data.years || [];
    const selectedIndex = Math.min(Math.max(Number(index) || 0, 0), Math.max(years.length - 1, 0));
    this.setData({
      selectedIndex,
      selected: years[selectedIndex] || this.data.selected,
      diagnosis: getRouteDiagnostics(this.routeResult, selectedIndex),
      chart: getRouteChart(this.routeResult, selectedIndex),
    });
  },

  onYearChanging(event) {
    this.selectYear(event.detail.value);
  },

  onYearChange(event) {
    this.selectYear(event.detail.value);
  },
});
