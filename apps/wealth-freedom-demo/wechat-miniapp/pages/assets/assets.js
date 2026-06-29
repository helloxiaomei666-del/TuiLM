const storage = require("../../utils/storage");
const valuation = require("../../utils/valuation-model");
const {
  assetTypeOptions,
  decorateHoldings,
  getAssetFormFromHolding,
  getAssetSummary,
  getMockOcrResult,
  getTypeLabel,
  upsertAssetHolding,
  refreshHoldings,
} = require("../../utils/asset-model");

function getDefaultForm(type = "stock") {
  if (type === "cash") {
    return {
      type,
      name: "现金账户",
      amount: "",
    };
  }

  return {
    type,
    name: "",
    code: "",
    amount: "",
    quantity: "",
    costPrice: "",
    currentPrice: "",
  };
}

function getTypeIndex(type = "stock") {
  const index = assetTypeOptions.findIndex((option) => option.value === type);
  return index >= 0 ? index : 1;
}

function getFormCopy(form) {
  return JSON.parse(JSON.stringify(form));
}

function buildStateWithHoldings(state, holdings, now) {
  const generatedAt = now || new Date().toISOString();
  const previousSnapshots = state.valuationSnapshots || [];
  const valuationSnapshot = valuation.buildValuationSnapshot(holdings, previousSnapshots, {
    now: generatedAt,
  });
  return {
    ...state,
    holdings,
    valuationSnapshots: valuation.upsertTodaySnapshot(previousSnapshots, valuationSnapshot),
  };
}

function scrollToEditForm() {
  if (typeof wx === "undefined" || !wx.pageScrollTo) return;
  wx.pageScrollTo({
    selector: "#assetEditForm",
    duration: 220,
  });
}

Page({
  data: {
    state: null,
    holdings: [],
    summary: {
      totalText: "-",
      cashText: "-",
      investmentsText: "-",
      todayText: "-",
      quoteStatusText: "-",
      quoteTimeText: "-",
      allocationRows: [],
    },
    assetTypeOptions,
    selectedTypeIndex: 1,
    selectedTypeLabel: "基金",
    form: getDefaultForm("stock"),
    editingHoldingId: "",
    formTitle: "添加资产",
    formActionText: "保存到可投资资产",
    isFormOpen: false,
    pendingOcr: null,
  },

  onShow() {
    this.load();
  },

  load() {
    const state = storage.loadState();
    this.applyState(state);
  },

  applyState(state) {
    this.setData({
      state,
      holdings: decorateHoldings(state.holdings || []),
      summary: getAssetSummary(state.holdings || [], state.valuationSnapshots || []),
    });
  },

  onTypeChange(event) {
    const selectedTypeIndex = Number(event.detail.value) || 0;
    const selectedType = assetTypeOptions[selectedTypeIndex];
    const type = selectedType ? selectedType.value : "stock";
    this.setData({
      selectedTypeIndex,
      selectedTypeLabel: getTypeLabel(type),
      form: getDefaultForm(type),
      pendingOcr: null,
    });
  },

  onFormInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      form: {
        ...this.data.form,
        [field]: event.detail.value,
      },
      pendingOcr: null,
    });
  },

  openAssetForm() {
    this.setData({
      isFormOpen: true,
      form: getDefaultForm(this.data.form.type),
      editingHoldingId: "",
      formTitle: "添加资产",
      formActionText: "保存到可投资资产",
      pendingOcr: null,
    });
    scrollToEditForm();
  },

  toggleAssetForm() {
    const nextOpen = !this.data.isFormOpen;
    const patch = {
      isFormOpen: nextOpen,
      pendingOcr: nextOpen ? this.data.pendingOcr : null,
    };
    if (!nextOpen) {
      patch.form = getDefaultForm(this.data.form.type);
      patch.editingHoldingId = "";
      patch.formTitle = "添加资产";
      patch.formActionText = "保存到可投资资产";
    }
    this.setData(patch);
  },

  onPendingOcrInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      pendingOcr: {
        ...this.data.pendingOcr,
        [field]: event.detail.value,
      },
    });
  },

  saveHolding() {
    if (this.data.pendingOcr) {
      return;
    }
    const editingHoldingId = this.data.editingHoldingId;
    const nextHoldings = upsertAssetHolding(this.data.state.holdings || [], this.data.form, editingHoldingId);
    const state = buildStateWithHoldings(this.data.state, nextHoldings);
    storage.saveState(state);
    this.setData({
      form: getDefaultForm(this.data.form.type),
      editingHoldingId: "",
      formTitle: "添加资产",
      formActionText: "保存到可投资资产",
      isFormOpen: false,
      pendingOcr: null,
    });
    this.applyState(state);
  },

  addHolding() {
    this.saveHolding();
  },

  simulateOcr() {
    if (this.data.form.type === "cash") return;
    this.setData({
      pendingOcr: {
        ...getMockOcrResult(this.data.form.type),
        confidenceText: "识别结果仅作辅助，保存前必须逐项确认",
      },
    });
  },

  confirmOcr() {
    if (!this.data.pendingOcr) return;
    const result = this.data.pendingOcr;
    this.setData({
      form: {
        ...this.data.form,
        ...result,
      },
      pendingOcr: null,
    });
  },

  cancelOcr() {
    this.setData({ pendingOcr: null });
  },

  deleteHolding(event) {
    const id = event.currentTarget.dataset.id;
    const nextHoldings = (this.data.state.holdings || []).filter((item) => item.id !== id);
    const state = buildStateWithHoldings(this.data.state, nextHoldings);
    storage.saveState(state);
    if (this.data.editingHoldingId === id) {
      this.setData({
        form: getDefaultForm(this.data.form.type),
        editingHoldingId: "",
        formTitle: "添加资产",
        formActionText: "保存到可投资资产",
        isFormOpen: false,
        pendingOcr: null,
      });
    }
    this.applyState(state);
  },

  editHolding(event) {
    const id = event.currentTarget.dataset.id;
    const holding = (this.data.state.holdings || []).find((item) => item.id === id);
    if (!holding) return;

    const form = getAssetFormFromHolding(holding);
    const selectedTypeIndex = getTypeIndex(form.type);
    this.setData({
      selectedTypeIndex,
      selectedTypeLabel: getTypeLabel(form.type),
      form: getFormCopy(form),
      editingHoldingId: id,
      formTitle: "修改资产",
      formActionText: "保存修改",
      isFormOpen: true,
      pendingOcr: null,
    });
    scrollToEditForm();
  },

  cancelEdit() {
    this.setData({
      form: getDefaultForm(this.data.form.type),
      editingHoldingId: "",
      formTitle: "添加资产",
      formActionText: "保存到可投资资产",
      isFormOpen: false,
      pendingOcr: null,
    });
  },

  refreshQuotes() {
    const refreshedAt = new Date().toISOString();
    const result = refreshHoldings(this.data.state.holdings || [], { now: refreshedAt });
    const applyHoldings = (holdings) => {
      const state = buildStateWithHoldings(this.data.state, holdings, refreshedAt);
      storage.saveState(state);
      this.applyState(state);
      const hasError = holdings.some((item) => item.quoteStatus === "error");
      if (hasError && typeof wx !== "undefined" && wx.showToast) {
        wx.showToast({
          title: "部分估值保留原价",
          icon: "none",
        });
      }
    };

    if (result && typeof result.then === "function") {
      result.then(applyHoldings).catch(() => {
        if (typeof wx !== "undefined" && wx.showToast) {
          wx.showToast({
            title: "估值服务暂不可用",
            icon: "none",
          });
        }
      });
      return;
    }

    applyHoldings(result);
  },
});
