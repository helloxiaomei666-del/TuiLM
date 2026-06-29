const storage = require("../../utils/storage");
const { getOverviewModel } = require("../../utils/overview-model");
const {
  decorateDrags,
  dragCategoryOptions,
  getCategoryLabel,
  getDragSummary,
  normalizeDragForm,
} = require("../../utils/drag-model");

function defaultForm(category = "medical") {
  return {
    category,
    amount: "",
    title: "",
  };
}

function getCategoryIndex(category = "medical") {
  const index = dragCategoryOptions.findIndex((option) => option.value === category);
  return index >= 0 ? index : 0;
}

function formFromDrag(drag) {
  return {
    category: drag.category || "medical",
    amount: String(drag.amount || ""),
    title: drag.title || "",
  };
}

function scrollToDragForm() {
  if (typeof wx === "undefined" || !wx.pageScrollTo) return;
  wx.pageScrollTo({
    selector: "#dragEditForm",
    duration: 220,
  });
}

Page({
  data: {
    state: null,
    dragTotalText: "-",
    summary: {
      totalText: "-",
      countText: "0 项",
      savedMonthsText: "0 个月",
      headlineText: "还没有拖累项",
      actionText: "添加医疗、房贷、车贷或其他长期支出，查看它们对退休时间的影响。",
      topDragTitle: "等待添加拖累项",
      topDragAmountText: "-",
      topDragImpactText: "添加拖累项后显示优先处理建议",
      topDragClass: "impact-low",
      categoryRows: [],
    },
    drags: [],
    categoryOptions: dragCategoryOptions,
    selectedCategoryIndex: 0,
    selectedCategoryLabel: "医疗",
    form: defaultForm(),
    editingDragId: "",
    formTitle: "手动添加拖累项",
    formActionText: "加入拖累分析",
  },

  onShow() {
    this.load();
  },

  load() {
    this.applyState(storage.loadState());
  },

  applyState(state) {
    const model = getOverviewModel(state);
    const summary = getDragSummary(state.manualDrags || [], model.values, model.result);
    this.setData({
      state,
      dragTotalText: summary.totalText,
      summary,
      drags: decorateDrags(state.manualDrags || [], model.values, model.result),
    });
  },

  onCategoryChange(event) {
    const selectedCategoryIndex = Number(event.detail.value) || 0;
    const selectedCategory = dragCategoryOptions[selectedCategoryIndex];
    const category = selectedCategory ? selectedCategory.value : "medical";
    this.setData({
      selectedCategoryIndex,
      selectedCategoryLabel: getCategoryLabel(category),
      form: {
        ...this.data.form,
        category,
      },
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

  saveDrag() {
    const editingDragId = this.data.editingDragId;
    const drag = normalizeDragForm(this.data.form, { id: editingDragId });
    if (!drag.amount) return;
    let found = false;
    const existingDrags = this.data.state.manualDrags || [];
    const manualDrags = editingDragId
      ? existingDrags.map((item) => {
          if (item.id !== editingDragId) return item;
          found = true;
          return drag;
        })
      : [drag, ...existingDrags];
    const state = {
      ...this.data.state,
      manualDrags: editingDragId && !found ? [drag, ...existingDrags] : manualDrags,
    };
    storage.saveState(state);
    this.setData({
      form: defaultForm(this.data.form.category),
      editingDragId: "",
      formTitle: "手动添加拖累项",
      formActionText: "加入拖累分析",
    });
    this.applyState(state);
  },

  addDrag() {
    this.saveDrag();
  },

  deleteDrag(event) {
    const id = event.currentTarget.dataset.id;
    const state = {
      ...this.data.state,
      manualDrags: (this.data.state.manualDrags || []).filter((item) => item.id !== id),
    };
    storage.saveState(state);
    if (this.data.editingDragId === id) {
      this.setData({
        form: defaultForm(this.data.form.category),
        editingDragId: "",
        formTitle: "手动添加拖累项",
        formActionText: "加入拖累分析",
      });
    }
    this.applyState(state);
  },

  editDrag(event) {
    const id = event.currentTarget.dataset.id;
    const drag = (this.data.state.manualDrags || []).find((item) => item.id === id);
    if (!drag) return;

    const category = drag.category || "medical";
    this.setData({
      selectedCategoryIndex: getCategoryIndex(category),
      selectedCategoryLabel: getCategoryLabel(category),
      form: formFromDrag(drag),
      editingDragId: id,
      formTitle: "修改拖累项",
      formActionText: "保存修改",
    });
    scrollToDragForm();
  },

  cancelEdit() {
    this.setData({
      form: defaultForm(this.data.form.category),
      editingDragId: "",
      formTitle: "手动添加拖累项",
      formActionText: "加入拖累分析",
    });
  },
});
