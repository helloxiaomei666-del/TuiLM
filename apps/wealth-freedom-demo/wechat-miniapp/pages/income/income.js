const storage = require("../../utils/storage");

const incomeTypeOptions = [
  { value: "rental_property", label: "房租收入" },
  { value: "stock_dividend", label: "股票分红" },
  { value: "dividend_etf_distribution", label: "ETF 分红" },
  { value: "bond_coupon", label: "债券利息" },
  { value: "deposit_interest", label: "存款利息" },
  { value: "money_market_fund_income", label: "货币基金收益" },
  { value: "pension_received", label: "已领取养老金" },
  { value: "annuity_received", label: "已领取年金" },
];

const frequencyOptions = [
  { value: "monthly", label: "每月" },
  { value: "quarterly", label: "每季度" },
  { value: "annual", label: "每年" },
];

const actualReceivedOptions = [
  { value: true, label: "已经实际到账" },
  { value: false, label: "尚未实际到账" },
];

const requiresLaborOptions = [
  { value: false, label: "不需要持续劳动" },
  { value: true, label: "需要持续劳动" },
];

const derivedIncomeFields = [
  "monthlyAmount",
  "netMonthlyCashflow",
  "eligibleMonthlyPassiveIncome",
  "includedInCoreRate",
  "exclusionReason",
  "originKey",
  "duplicateOfOriginKey",
];

const confirmRecordsText = "确认以上是我当前完整的收入情况";
const confirmNoIncomeText = "我目前没有被动收入";
let incomeSequence = 0;

function getOptionLabel(options, value) {
  const option = options.find((item) => item.value === value);
  return option ? option.label : "待选择";
}

function getOptionIndex(options, value) {
  const index = options.findIndex((item) => item.value === value);
  return index < 0 ? 0 : index;
}

function defaultForm() {
  return {
    sourceType: "stock_dividend",
    rawAmount: "",
    frequency: "annual",
    actualReceived: null,
    requiresLabor: null,
    taxOrFee: "",
    maintenanceCost: "",
    otherNecessaryCost: "",
  };
}

function createIncomeId() {
  incomeSequence += 1;
  return "income-" + Date.now() + "-" + incomeSequence;
}

function formatAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString("zh-CN") + " 元" : "金额待补充";
}

function decorateIncomeStreams(incomeStreams) {
  return (incomeStreams || []).map((income) => ({
    ...income,
    sourceTypeText: getOptionLabel(incomeTypeOptions, income.sourceType),
    amountText: formatAmount(income.rawAmount) + " / " + getOptionLabel(frequencyOptions, income.frequency),
    actualReceivedText: getOptionLabel(actualReceivedOptions, income.actualReceived),
    requiresLaborText: getOptionLabel(requiresLaborOptions, income.requiresLabor),
  }));
}

function getCompletionText(state) {
  const completed = Boolean(state.inputCompletion && state.inputCompletion.incomeSources);
  if (!completed) return "收入情况待确认";
  return state.incomeStreams && state.incomeStreams.length
    ? "收入情况已确认"
    : "已确认目前没有被动收入";
}

function buildIncomeFact(form, id) {
  const income = {
    ...form,
    id,
    rawAmount: Number(form.rawAmount),
  };
  derivedIncomeFields.forEach((field) => {
    delete income[field];
  });
  return income;
}

Page({
  data: {
    state: null,
    incomeStreams: [],
    incomeCompletionText: "收入情况待确认",
    incomeTypeOptions,
    frequencyOptions,
    actualReceivedOptions,
    requiresLaborOptions,
    form: defaultForm(),
    editingIncomeId: "",
    isEditing: false,
    selectedIncomeTypeIndex: 1,
    selectedFrequencyIndex: 2,
    selectedActualReceivedIndex: 0,
    selectedRequiresLaborIndex: 0,
    selectedIncomeTypeLabel: "股票分红",
    selectedFrequencyLabel: "每年",
    selectedActualReceivedLabel: "已经实际到账",
    selectedRequiresLaborLabel: "不需要持续劳动",
    confirmRecordsText,
    confirmNoIncomeText,
  },

  onShow() {
    this.applyState(storage.loadState());
  },

  applyState(state) {
    const form = this.data.form || defaultForm();
    this.setData({
      state,
      incomeStreams: decorateIncomeStreams(state.incomeStreams),
      incomeCompletionText: getCompletionText(state),
      selectedIncomeTypeIndex: getOptionIndex(incomeTypeOptions, form.sourceType),
      selectedFrequencyIndex: getOptionIndex(frequencyOptions, form.frequency),
      selectedActualReceivedIndex: getOptionIndex(actualReceivedOptions, form.actualReceived),
      selectedRequiresLaborIndex: getOptionIndex(requiresLaborOptions, form.requiresLabor),
      selectedIncomeTypeLabel: getOptionLabel(incomeTypeOptions, form.sourceType),
      selectedFrequencyLabel: getOptionLabel(frequencyOptions, form.frequency),
      selectedActualReceivedLabel: getOptionLabel(actualReceivedOptions, form.actualReceived),
      selectedRequiresLaborLabel: getOptionLabel(requiresLaborOptions, form.requiresLabor),
    });
  },

  onFormInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      form: {
        ...this.data.form,
        [field]: event.detail.value,
      },
    });
  },

  onIncomeTypeChange(event) {
    const index = Number(event.detail.value) || 0;
    const option = incomeTypeOptions[index];
    this.setData({
      form: { ...this.data.form, sourceType: option.value },
      selectedIncomeTypeIndex: index,
      selectedIncomeTypeLabel: option.label,
    });
  },

  onFrequencyChange(event) {
    const index = Number(event.detail.value) || 0;
    const option = frequencyOptions[index];
    this.setData({
      form: { ...this.data.form, frequency: option.value },
      selectedFrequencyIndex: index,
      selectedFrequencyLabel: option.label,
    });
  },

  onActualReceivedChange(event) {
    const index = Number(event.detail.value) || 0;
    const option = actualReceivedOptions[index];
    this.setData({
      form: { ...this.data.form, actualReceived: option.value },
      selectedActualReceivedIndex: index,
      selectedActualReceivedLabel: option.label,
    });
  },

  onRequiresLaborChange(event) {
    const index = Number(event.detail.value) || 0;
    const option = requiresLaborOptions[index];
    this.setData({
      form: { ...this.data.form, requiresLabor: option.value },
      selectedRequiresLaborIndex: index,
      selectedRequiresLaborLabel: option.label,
    });
  },

  showToast(title) {
    if (typeof wx !== "undefined" && wx.showToast) {
      wx.showToast({ title, icon: "none" });
    }
  },

  validateForm(form) {
    const rawAmount = Number(form.rawAmount);
    if (!incomeTypeOptions.some((item) => item.value === form.sourceType)) {
      this.showToast("请选择收入类型");
      return false;
    }
    if (!Number.isFinite(rawAmount) || rawAmount < 0 || form.rawAmount === "") {
      this.showToast("请输入有效的收入金额");
      return false;
    }
    if (!frequencyOptions.some((item) => item.value === form.frequency)) {
      this.showToast("请选择收入频率");
      return false;
    }
    if (typeof form.actualReceived !== "boolean") {
      this.showToast("请选择是否已经实际到账");
      return false;
    }
    if (typeof form.requiresLabor !== "boolean") {
      this.showToast("请选择是否需要持续投入劳动");
      return false;
    }
    return true;
  },

  saveIncome() {
    const form = this.data.form;
    if (!this.validateForm(form)) return;

    const currentState = this.data.state || storage.loadState();
    const currentIncomeStreams = currentState.incomeStreams || [];
    const editingIncomeId = this.data.editingIncomeId;
    const income = buildIncomeFact(form, editingIncomeId || createIncomeId());
    const nextIncomeStreams = editingIncomeId
      ? currentIncomeStreams.map((item) => (item.id === editingIncomeId ? income : item))
      : currentIncomeStreams.concat(income);
    const savedState = storage.saveState({
      ...currentState,
      incomeStreams: nextIncomeStreams,
      inputCompletion: {
        ...(currentState.inputCompletion || {}),
        incomeSources: false,
      },
    });
    this.setData({ form: defaultForm(), editingIncomeId: "", isEditing: false });
    this.applyState(savedState);
  },

  editIncome(event) {
    const id = event.currentTarget.dataset.id;
    const currentState = this.data.state || storage.loadState();
    const income = (currentState.incomeStreams || []).find((item) => item.id === id);
    if (!income) return;
    this.setData({
      form: { ...defaultForm(), ...income },
      editingIncomeId: id,
      isEditing: true,
    });
    this.applyState(currentState);
  },

  cancelEdit() {
    this.setData({ form: defaultForm(), editingIncomeId: "", isEditing: false });
    this.applyState(this.data.state || storage.loadState());
  },

  deleteIncome(event) {
    const id = event.currentTarget.dataset.id;
    const remove = () => {
      const currentState = this.data.state || storage.loadState();
      const nextIncomeStreams = (currentState.incomeStreams || []).filter((item) => item.id !== id);
      const savedState = storage.saveState({
        ...currentState,
        incomeStreams: nextIncomeStreams,
        inputCompletion: {
          ...(currentState.inputCompletion || {}),
          incomeSources: false,
        },
      });
      if (this.data.editingIncomeId === id) {
        this.setData({ form: defaultForm(), editingIncomeId: "", isEditing: false });
      }
      this.applyState(savedState);
    };

    if (typeof wx !== "undefined" && wx.showModal) {
      wx.showModal({
        title: "删除收入来源",
        content: "确认删除这条收入吗？",
        confirmText: "删除",
        cancelText: "取消",
        success(result) {
          if (result.confirm) remove();
        },
      });
      return;
    }
    remove();
  },

  setIncomeCompletion(completed) {
    const currentState = this.data.state || storage.loadState();
    const savedState = storage.saveState({
      ...currentState,
      inputCompletion: {
        ...(currentState.inputCompletion || {}),
        incomeSources: completed,
      },
    });
    this.applyState(savedState);
  },

  confirmIncomeSources() {
    this.setIncomeCompletion(true);
  },

  confirmNoIncome() {
    const currentState = this.data.state || storage.loadState();
    if (currentState.incomeStreams && currentState.incomeStreams.length) {
      this.showToast("请先确认已有收入记录");
      return;
    }
    this.setIncomeCompletion(true);
  },
});
