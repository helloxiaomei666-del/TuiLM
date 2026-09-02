const storage = require("../../utils/storage");
const {
  LIABILITY_TYPES,
  validateLiabilityFact,
  validateLiabilityFacts,
  calculateLiabilitySummary,
} = require("../../utils/liability-model");

const formFields = new Set([
  "type",
  "outstandingBalance",
  "monthlyPayment",
  "includedInEssentialExpense",
  "note",
]);
let liabilitySequence = 0;

function defaultForm() {
  return {
    type: LIABILITY_TYPES[0].value,
    outstandingBalance: "",
    monthlyPayment: "",
    includedInEssentialExpense: null,
    note: "",
  };
}

function createLiabilityId(existingLiabilities) {
  const ids = new Set((existingLiabilities || []).map((item) => item.id));
  let id;
  do {
    liabilitySequence += 1;
    id = "liability-" + Date.now() + "-" + liabilitySequence;
  } while (ids.has(id));
  return id;
}

function formatAmount(value) {
  return Number(value).toLocaleString("zh-CN") + " 元";
}

function getCompletionText(state) {
  const liabilities = state.liabilities || [];
  if (!state.inputCompletion || state.inputCompletion.liabilities !== true) {
    return "负债情况待确认";
  }
  return liabilities.length ? "负债情况已确认" : "我目前没有负债";
}

function getLegacyReminder(state) {
  const profile = state.userProfile || {};
  const hasLegacyLiability = ["mortgage", "carLoan", "otherDebt"].some((key) => {
    const value = Number(profile[key]);
    return Number.isFinite(value) && value > 0;
  });
  return hasLegacyLiability
    ? "旧版负债信息仅供参考，请按当前实际情况逐项录入。"
    : "";
}

function getDisplaySummary(liabilities) {
  const summary = calculateLiabilitySummary(liabilities);
  return {
    totalLiabilitiesText: formatAmount(summary.totalLiabilities),
    totalMonthlyPaymentText: formatAmount(summary.totalMonthlyPayment),
    uncoveredMonthlyPaymentText: formatAmount(summary.uncoveredMonthlyPayment),
  };
}

function showToast(title) {
  if (typeof wx !== "undefined" && wx && typeof wx.showToast === "function") {
    wx.showToast({ title, icon: "none" });
  }
}

function isMissingNumericInput(value) {
  return value === null || value === undefined
    || (typeof value === "string" && value.trim() === "");
}

Page({
  data: {
    state: null,
    liabilities: [],
    summary: {
      totalLiabilitiesText: "0 元",
      totalMonthlyPaymentText: "0 元",
      uncoveredMonthlyPaymentText: "0 元",
    },
    liabilityTypes: LIABILITY_TYPES,
    form: defaultForm(),
    editingLiabilityId: "",
    isEditing: false,
    liabilityCompletionText: "负债情况待确认",
    legacyReminder: "",
    confirmLiabilitiesText: "确认以上是我当前完整的负债情况",
    confirmNoLiabilitiesText: "我目前没有负债",
  },

  onShow() {
    this.applyState(storage.loadState());
  },

  applyState(state) {
    const liabilities = Array.isArray(state.liabilities) ? state.liabilities : [];
    this.setData({
      state,
      liabilities,
      summary: getDisplaySummary(liabilities),
      liabilityCompletionText: getCompletionText({ ...state, liabilities }),
      legacyReminder: getLegacyReminder(state),
    });
  },

  onFormInput(event) {
    const field = event.currentTarget.dataset.field;
    if (!formFields.has(field)) return;
    this.setData({
      form: {
        ...this.data.form,
        [field]: event.detail.value,
      },
    });
  },

  onLiabilityTypeChange(event) {
    const index = Number(event.detail.value);
    const type = LIABILITY_TYPES[index];
    if (!type) return;
    this.setData({ form: { ...this.data.form, type: type.value } });
  },

  onIncludedInEssentialExpenseChange(event) {
    const includedInEssentialExpense = event.detail.value;
    if (typeof includedInEssentialExpense !== "boolean") return;
    this.setData({
      form: { ...this.data.form, includedInEssentialExpense },
    });
  },

  saveLiability() {
    const currentState = this.data.state || storage.loadState();
    const currentLiabilities = currentState.liabilities || [];
    const form = this.data.form;
    if (typeof form.includedInEssentialExpense !== "boolean") {
      showToast("请选择这笔月供是否已包含在每月必要支出中");
      return;
    }
    if (isMissingNumericInput(form.monthlyPayment)) {
      showToast("请输入有效的每月还款金额");
      return;
    }

    const editingLiabilityId = this.data.editingLiabilityId;
    const currentItem = editingLiabilityId
      ? currentLiabilities.find((item) => item.id === editingLiabilityId)
      : null;
    if (editingLiabilityId && !currentItem) {
      showToast("未找到需要编辑的负债信息");
      return;
    }

    const id = editingLiabilityId || createLiabilityId(currentLiabilities);
    const fact = {
      id,
      type: form.type,
      outstandingBalance: Number(form.outstandingBalance),
      monthlyPayment: Number(form.monthlyPayment),
      includedInEssentialExpense: form.includedInEssentialExpense,
      source: "manual",
      note: form.note,
    };
    const existingIds = currentLiabilities
      .filter((item) => item.id !== editingLiabilityId)
      .map((item) => item.id);
    const validation = validateLiabilityFact(fact, existingIds);
    if (!validation.ok) {
      showToast(validation.message);
      return;
    }

    const nextLiabilities = editingLiabilityId
      ? currentLiabilities.map((item) => (item.id === editingLiabilityId ? validation.value : item))
      : currentLiabilities.concat(validation.value);
    const listValidation = validateLiabilityFacts(nextLiabilities);
    if (!listValidation.ok) {
      showToast(listValidation.message);
      return;
    }

    const savedState = storage.saveState({
      ...currentState,
      liabilities: listValidation.value,
      inputCompletion: {
        ...(currentState.inputCompletion || {}),
        liabilities: false,
      },
    });
    this.setData({ form: defaultForm(), editingLiabilityId: "", isEditing: false });
    this.applyState(savedState);
  },

  editLiability(event) {
    const id = event.currentTarget.dataset.id;
    const currentState = this.data.state || storage.loadState();
    const liability = (currentState.liabilities || []).find((item) => item.id === id);
    if (!liability) return;
    this.setData({
      form: {
        type: liability.type,
        outstandingBalance: String(liability.outstandingBalance),
        monthlyPayment: String(liability.monthlyPayment),
        includedInEssentialExpense: liability.includedInEssentialExpense,
        note: liability.note,
      },
      editingLiabilityId: id,
      isEditing: true,
    });
  },

  cancelEdit() {
    this.setData({ form: defaultForm(), editingLiabilityId: "", isEditing: false });
  },

  deleteLiability(event) {
    const id = event.currentTarget.dataset.id;
    const remove = () => {
      const currentState = this.data.state || storage.loadState();
      const currentLiabilities = currentState.liabilities || [];
      if (!currentLiabilities.some((item) => item.id === id)) return;
      const savedState = storage.saveState({
        ...currentState,
        liabilities: currentLiabilities.filter((item) => item.id !== id),
        inputCompletion: {
          ...(currentState.inputCompletion || {}),
          liabilities: false,
        },
      });
      if (this.data.editingLiabilityId === id) {
        this.setData({ form: defaultForm(), editingLiabilityId: "", isEditing: false });
      }
      this.applyState(savedState);
    };

    if (typeof wx !== "undefined" && wx && typeof wx.showModal === "function") {
      wx.showModal({
        title: "删除负债信息",
        content: "确认删除这条负债吗？",
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

  confirmLiabilities() {
    const currentState = this.data.state || storage.loadState();
    const validation = validateLiabilityFacts(currentState.liabilities || []);
    if (validation.value && validation.value.length === 0) {
      showToast("请先录入负债信息，或确认目前没有负债");
      return;
    }
    if (!validation.ok) {
      showToast(validation.message);
      return;
    }
    const savedState = storage.saveState({
      ...currentState,
      inputCompletion: {
        ...(currentState.inputCompletion || {}),
        liabilities: true,
      },
    });
    this.applyState(savedState);
  },

  confirmNoLiabilities() {
    const currentState = this.data.state || storage.loadState();
    if ((currentState.liabilities || []).length > 0) {
      showToast("请先清空或核对负债信息");
      return;
    }
    const savedState = storage.saveState({
      ...currentState,
      inputCompletion: {
        ...(currentState.inputCompletion || {}),
        liabilities: true,
      },
    });
    this.applyState(savedState);
  },
});
