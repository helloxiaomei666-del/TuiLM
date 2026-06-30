(function (root, factory) {
  const app = factory(root.RetirementCalculator || (
    typeof require === 'function' ? require('./calculator.js') : null
  ), root.RetirementShareCard || (
    typeof require === 'function' ? require('./share-card.js') : null
  ));

  root.RetirementTestApp = app;

  if (typeof module === 'object' && module.exports) {
    module.exports = app;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (calculator, shareCard) {
  const STORAGE_KEY = 'retirement-test:v1:draft';
  const APP_VIEW = {
    LANDING: 'landing',
    FORM: 'form',
    RESULT: 'result',
    POSTER: 'poster',
  };
  const TOTAL_STEPS = 5;
  const NUMBER_FIELDS = [
    'age',
    'desiredRetirementAge',
    'currentMonthlyCost',
    'targetMonthlyCost',
    'cash',
    'funds',
    'stocks',
    'gold',
    'propertyValue',
    'propertyEquity',
    'propertyNetValue',
    'realEstateNetValue',
    'otherAssets',
    'mortgageBalance',
    'mortgage',
    'carLoan',
    'consumerLoan',
    'otherDebt',
    'monthlySalary',
    'monthlySideIncome',
    'monthlyLivingExpense',
    'monthlyFixedExpense',
    'monthlyDebtPayment',
    'dividends',
    'rent',
    'interest',
    'reits',
    'pension',
    'annuity',
    'royalties',
    'otherPassive',
    'semiPassive',
  ];
  const FREQUENCY_FIELDS = [
    'dividendsFrequency',
    'rentFrequency',
    'interestFrequency',
    'reitsFrequency',
    'pensionFrequency',
    'annuityFrequency',
    'royaltiesFrequency',
    'otherPassiveFrequency',
    'semiPassiveFrequency',
  ];
  const STEP_FIELDS = {
    1: ['age', 'desiredRetirementAge', 'currentMonthlyCost', 'targetMonthlyCost'],
    2: ['cash', 'funds', 'stocks', 'gold', 'propertyValue', 'propertyEquity', 'propertyNetValue', 'realEstateNetValue', 'otherAssets'],
    3: ['mortgageBalance', 'mortgage', 'carLoan', 'consumerLoan', 'otherDebt'],
    4: [
      'monthlySalary',
      'monthlySideIncome',
      'monthlyLivingExpense',
      'monthlyFixedExpense',
      'monthlyDebtPayment',
    ],
    5: [
      'dividends',
      'rent',
      'interest',
      'reits',
      'pension',
      'annuity',
      'royalties',
      'otherPassive',
      'semiPassive',
    ],
  };
  const STEP_META = {
    1: { shortLabel: '生活目标', nextLabel: '继续填写资产', nextShortLabel: '资产' },
    2: { shortLabel: '资产', nextLabel: '继续填写负债', nextShortLabel: '负债' },
    3: { shortLabel: '负债', nextLabel: '继续填写收支', nextShortLabel: '收支' },
    4: { shortLabel: '收支', nextLabel: '继续填写资产收入', nextShortLabel: '被动收入' },
    5: { shortLabel: '被动收入', nextLabel: '生成我的自由进度报告', nextShortLabel: '' },
  };

  function toAmount(value) {
    if (calculator && typeof calculator.toAmount === 'function') {
      return calculator.toAmount(value);
    }

    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0 ? amount : 0;
  }

  function ownValue(source, key) {
    return source != null && Object.prototype.hasOwnProperty.call(source, key)
      ? source[key]
      : undefined;
  }

  function frequencyValue(source, key) {
    const value = ownValue(source, key);
    return value ? String(value) : 'month';
  }

  function firstNormalizedAmount(source, keys) {
    for (const key of keys) {
      if (source != null && Object.prototype.hasOwnProperty.call(source, key)) {
        return toAmount(source[key]);
      }
    }
    return 0;
  }

  function normalizeFormData(input) {
    const source = input || {};
    const data = {
      city: ownValue(source, 'city') ? String(ownValue(source, 'city')).trim() : '',
    };

    NUMBER_FIELDS.forEach(function (field) {
      data[field] = toAmount(ownValue(source, field));
    });
    FREQUENCY_FIELDS.forEach(function (field) {
      data[field] = frequencyValue(source, field);
    });

    data.propertyValue = firstNormalizedAmount(source, [
      'propertyValue',
      'propertyEquity',
      'propertyNetValue',
      'realEstateNetValue',
    ]);
    data.mortgageBalance = firstNormalizedAmount(source, ['mortgageBalance', 'mortgage']);

    if (data.targetMonthlyCost <= 0 && data.currentMonthlyCost > 0) {
      data.targetMonthlyCost = data.currentMonthlyCost;
    }

    data.assets = {
      cash: data.cash,
      funds: data.funds,
      stocks: data.stocks,
      gold: data.gold,
      propertyValue: data.propertyValue,
      propertyEquity: data.propertyEquity,
      propertyNetValue: data.propertyNetValue,
      realEstateNetValue: data.realEstateNetValue,
      other: data.otherAssets,
    };
    data.debts = {
      mortgageBalance: data.mortgageBalance,
      mortgage: data.mortgage,
      carLoan: data.carLoan,
      consumerLoan: data.consumerLoan,
      other: data.otherDebt,
    };
    data.passiveIncome = {
      dividends: { amount: data.dividends, frequency: data.dividendsFrequency },
      rent: { amount: data.rent, frequency: data.rentFrequency },
      interest: { amount: data.interest, frequency: data.interestFrequency },
      reits: { amount: data.reits, frequency: data.reitsFrequency },
      pension: { amount: data.pension, frequency: data.pensionFrequency },
      annuity: { amount: data.annuity, frequency: data.annuityFrequency },
      royalties: { amount: data.royalties, frequency: data.royaltiesFrequency },
      other: { amount: data.otherPassive, frequency: data.otherPassiveFrequency },
    };
    data.semiPassiveIncome = {
      amount: data.semiPassive,
      frequency: data.semiPassiveFrequency,
    };

    return data;
  }

  function formatWholeCurrency(value) {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(value) || 0);
  }

  function formatResultCurrency(value) {
    return formatWholeCurrency(value);
  }

  function formatResultRate(value) {
    const rate = Number(value);
    if (value === null || value === '' || !Number.isFinite(rate)) {
      return '暂无法计算';
    }

    return new Intl.NumberFormat('zh-CN', {
      style: 'percent',
      maximumFractionDigits: 1,
    }).format(rate);
  }

  function buildResultHeroCopy(metrics) {
    const source = metrics || {};
    const rateText = formatResultRate(source.cashflowRetirementRate);
    const isZeroProgress = Number(source.cashflowRetirementRate) === 0;
    const posterSummary = source.statuses && source.statuses.posterSummary
      ? source.statuses.posterSummary
      : null;
    const cashflowStatus = source.statuses && source.statuses.cashFlowStatus
      ? source.statuses.cashFlowStatus
      : null;
    const fallbackSummary = '填写数据后，这里会显示你的自由进度。';
    const stageLabelText = isZeroProgress
      ? '打基础中'
      : (
        posterSummary && posterSummary.stageLabel
          ? posterSummary.stageLabel
          : (cashflowStatus && cashflowStatus.label ? cashflowStatus.label : '等待生成结果')
      );
    const summaryText = isZeroProgress
      ? '稳定现金流还没真正接班，现在主要还是靠自己扛。'
      : (posterSummary && posterSummary.summaryText ? posterSummary.summaryText : fallbackSummary);

    return {
      rateText,
      stageLabel: stageLabelText,
      summaryText,
      detailText: `现在有 ${rateText} 的生活成本，不用完全靠工资来扛。`,
      cautionText: '本结果仅用于个人财务观察，不构成投资、理财、保险或退休决策建议。',
    };
  }

  function buildShareCopy(data) {
    const source = data || {};
    const progress = source.freedomProgress || source.cashflowRetirementRate || '暂无法计算';
    return [
      '测一测你的自由进度｜退了吗',
      '',
      `我的自由进度是 ${progress}。`,
      `现在有 ${progress} 的生活成本，不用完全靠工资来扛。`,
      '',
      '你也可以测测自己的自由进度。',
    ].join('\n');
  }

  function amountByFrequency(amount, frequency) {
    const value = toAmount(amount);
    if (value <= 0) return 0;
    if (frequency === 'quarter') return value / 3;
    if (frequency === 'year') return value / 12;
    if (frequency === 'irregular') return 0;
    return value;
  }

  function buildGuidedSummaries(input) {
    const data = normalizeFormData(input);
    const totalAssets = sumAmounts(data, [
      'cash',
      'funds',
      'stocks',
      'gold',
      'propertyValue',
      'otherAssets',
    ]);
    const totalDebts = sumAmounts(data, [
      'mortgageBalance',
      'carLoan',
      'consumerLoan',
      'otherDebt',
    ]);
    const monthlyIncome = sumAmounts(data, ['monthlySalary', 'monthlySideIncome']);
    const monthlySpend = sumAmounts(data, [
      'monthlyLivingExpense',
      'monthlyFixedExpense',
      'monthlyDebtPayment',
    ]);
    const monthlyInvestable = Math.max(0, monthlyIncome - monthlySpend);
    const stablePassiveIncome = [
      ['dividends', 'dividendsFrequency'],
      ['rent', 'rentFrequency'],
      ['interest', 'interestFrequency'],
      ['reits', 'reitsFrequency'],
      ['pension', 'pensionFrequency'],
      ['annuity', 'annuityFrequency'],
      ['royalties', 'royaltiesFrequency'],
      ['otherPassive', 'otherPassiveFrequency'],
    ].reduce(function (total, item) {
      return total + amountByFrequency(data[item[0]], data[item[1]]);
    }, 0);
    const semiPassiveIncome = amountByFrequency(data.semiPassive, data.semiPassiveFrequency);
    const assetMonthlyIncome = stablePassiveIncome + semiPassiveIncome;

    return {
      assets: [
        '资产小结',
        `当前总资产：${formatWholeCurrency(totalAssets)}`,
        '下一步会填写负债，系统会用“总资产 - 总负债”计算你的净资产。',
      ].join('\n'),
      debts: [
        '净资产小结',
        `总资产：${formatWholeCurrency(totalAssets)}`,
        `总负债：${formatWholeCurrency(totalDebts)}`,
        `当前净资产：${formatWholeCurrency(totalAssets - totalDebts)}`,
        '净资产 = 总资产 - 总负债。它会用于计算你的目标资产进度。',
      ].join('\n'),
      cashflow: [
        '每月现金流小结',
        `月收入：${formatWholeCurrency(monthlyIncome)}`,
        `月支出：${formatWholeCurrency(monthlySpend)}`,
        `月可投入金额：${formatWholeCurrency(monthlyInvestable)}`,
        '月可投入金额越高，保守模型下的目标达成时间通常越短。',
      ].join('\n'),
      passive: [
        '资产收入小结',
        `稳定被动收入：${formatWholeCurrency(stablePassiveIncome)} / 月`,
        `半被动收入：${formatWholeCurrency(semiPassiveIncome)} / 月`,
        `资产月收入：${formatWholeCurrency(assetMonthlyIncome)} / 月`,
        '自由进度主要看稳定被动收入能覆盖多少生活成本。',
      ].join('\n'),
    };
  }

  function sumAmounts(values, fields) {
    return fields.reduce(function (total, field) {
      return total + toAmount(values[field]);
    }, 0);
  }

  function validateForReport(input) {
    const data = normalizeFormData(input);
    const errors = {};
    const MIN_AGE = 18;
    const MAX_AGE = 100;

    if (data.age <= 0) {
      errors.age = '请填写当前年龄';
    } else if (data.age < MIN_AGE || data.age > MAX_AGE) {
      errors.age = '当前年龄需在 18 到 100 岁之间';
    }
    if (data.currentMonthlyCost <= 0) {
      errors.currentMonthlyCost = '请填写当前月生活成本';
    }
    if (data.targetMonthlyCost <= 0) {
      errors.targetMonthlyCost = '请填写目标月生活成本';
    }
    if (
      data.desiredRetirementAge > 0
      && (data.desiredRetirementAge < MIN_AGE || data.desiredRetirementAge > MAX_AGE)
    ) {
      errors.desiredRetirementAge = '希望达成自由状态的年龄需在 18 到 100 岁之间';
    }
    if (
      data.age > 0
      && data.desiredRetirementAge > 0
      && data.desiredRetirementAge < data.age
      && !errors.desiredRetirementAge
    ) {
      errors.desiredRetirementAge = '希望达成自由状态的年龄不能低于当前年龄';
    }

    return errors;
  }

  function init(options) {
    const doc = options && options.document
      ? options.document
      : (typeof document !== 'undefined' ? document : null);
    if (!doc) return null;

    const win = doc.defaultView || (typeof window !== 'undefined' ? window : null);
    const storage = getStorage(win);
    const landingView = doc.getElementById('landing-view');
    const formView = doc.getElementById('form-view');
    const reportView = doc.getElementById('report-view');
    const posterView = doc.getElementById('poster-view');
    const form = doc.getElementById('retirement-form');
    const fieldsets = form ? Array.from(form.querySelectorAll('fieldset[data-step]')) : [];
    const continueButton = doc.getElementById('continue-test');
    let currentStep = 1;
    let latestShareData = null;
    let latestShareTrigger = null;

    if (!form || fieldsets.length === 0) {
      return null;
    }

    function showView(name) {
      if (landingView) landingView.hidden = name !== APP_VIEW.LANDING;
      if (formView) formView.hidden = name !== APP_VIEW.FORM;
      if (reportView) reportView.hidden = name !== APP_VIEW.RESULT;
      if (posterView) posterView.hidden = name !== APP_VIEW.POSTER;
      const root = doc.querySelector('.app-shell');
      if (root) root.dataset.currentView = name;
    }

    function hasSavedDraft() {
      if (!storage) return false;
      try {
        return Boolean(storage.getItem(STORAGE_KEY));
      } catch (error) {
        return false;
      }
    }

    function updateContinueVisibility() {
      if (!continueButton) return;
      continueButton.hidden = !hasSavedDraft();
    }

    function showStep(step, options) {
      const settings = options || {};
      currentStep = Math.min(TOTAL_STEPS, Math.max(1, Number(step) || 1));
      fieldsets.forEach(function (fieldset) {
        fieldset.hidden = Number(fieldset.dataset.step) !== currentStep;
      });

      const stepLabel = doc.getElementById('step-label');
      const meta = STEP_META[currentStep] || STEP_META[1];
      if (stepLabel) stepLabel.textContent = `第 ${currentStep} / ${TOTAL_STEPS} 步：${meta.shortLabel}`;

      const nextStepLabel = doc.getElementById('next-step-label');
      if (nextStepLabel) {
        nextStepLabel.textContent = meta.nextShortLabel
          ? `下一步：${meta.nextShortLabel}`
          : '下一步：生成报告';
      }

      doc.querySelectorAll('.stepper__item').forEach(function (item) {
        const itemStep = Number(item.dataset.step);
        item.classList.toggle('is-current', itemStep === currentStep);
        item.classList.toggle('is-complete', itemStep < currentStep);
        if (itemStep === currentStep) {
          item.setAttribute('aria-current', 'step');
        } else {
          item.removeAttribute('aria-current');
        }
      });

      const progress = doc.querySelector('.progress');
      if (progress) progress.setAttribute('aria-valuenow', String(currentStep));

      const progressBar = doc.getElementById('progress-bar');
      if (progressBar) progressBar.style.width = `${(currentStep / TOTAL_STEPS) * 100}%`;

      form.querySelectorAll('[data-action="previous"]').forEach(function (button) {
        button.disabled = currentStep === 1;
      });
      form.querySelectorAll('[data-action="next"]').forEach(function (button) {
        button.textContent = meta.nextLabel;
      });
      const submit = doc.getElementById('generate-report');
      if (submit) submit.textContent = STEP_META[5].nextLabel;

      if (settings.save !== false) {
        saveDraft();
      }
    }

    function readFormValues() {
      const values = {};
      Array.from(form.elements).forEach(function (field) {
        if (!field.name) return;
        values[field.name] = field.value;
      });
      return values;
    }

    function restoreFormValues(values) {
      if (!values) return;
      Array.from(form.elements).forEach(function (field) {
        if (!field.name || !Object.prototype.hasOwnProperty.call(values, field.name)) return;
        field.value = values[field.name];
      });
    }

    function saveDraft() {
      if (!storage) return;
      const payload = {
        currentStep,
        values: readFormValues(),
      };
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(payload));
        updateContinueVisibility();
      } catch (error) {
        // Ignore storage quota and private browsing failures.
      }
    }

    function loadDraft() {
      if (!storage) return;
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return;
        const payload = JSON.parse(raw);
        restoreFormValues(payload.values);
        currentStep = Number(payload.currentStep) || 1;
        updateContinueVisibility();
      } catch (error) {
        // Ignore unreadable drafts.
      }
    }

    function removeDraft() {
      if (storage) {
        try {
          storage.removeItem(STORAGE_KEY);
        } catch (error) {
          // Ignore storage failures.
        }
      }
      updateContinueVisibility();
    }

    function clearDraft() {
      removeDraft();
      form.reset();
      clearErrors();
      latestShareData = null;
      updateSummaries();
      showView(APP_VIEW.LANDING);
      showStep(1, { save: false });
    }

    function restartTest() {
      removeDraft();
      form.reset();
      clearErrors();
      latestShareData = null;
      updateSummaries();
      showView(APP_VIEW.FORM);
      showStep(1);
      const firstField = fieldsets[0]?.querySelector('input, select, button');
      if (firstField && typeof firstField.focus === 'function') firstField.focus();
    }

    function errorElementFor(field) {
      const describedBy = field.getAttribute('aria-describedby') || '';
      const describedIds = describedBy.split(/\s+/).filter(Boolean);

      for (const id of describedIds) {
        const candidate = doc.getElementById(id);
        if (candidate && candidate.classList.contains('field-error')) {
          return candidate;
        }
      }

      const wrapper = field.closest('.field, .passive-row');
      return wrapper ? wrapper.querySelector('.field-error') : null;
    }

    function clearErrors() {
      form.querySelectorAll('.field-error').forEach(function (element) {
        element.textContent = '';
      });
      form.querySelectorAll('[aria-invalid="true"]').forEach(function (field) {
        field.removeAttribute('aria-invalid');
      });
    }

    function showErrors(errors) {
      clearErrors();
      Object.keys(errors).forEach(function (name) {
        const field = form.elements[name];
        if (!field) return;

        field.setAttribute('aria-invalid', 'true');
        const errorElement = errorElementFor(field);
        if (errorElement) {
          errorElement.textContent = errors[name];
        }
      });
    }

    function visibleStepForError(errors) {
      const errorNames = Object.keys(errors);
      for (let step = 1; step <= TOTAL_STEPS; step += 1) {
        if ((STEP_FIELDS[step] || []).some(function (field) {
          return errorNames.includes(field);
        })) {
          return step;
        }
      }
      return 1;
    }

    function focusFirstError(errors) {
      const field = form.elements[Object.keys(errors)[0]];
      if (field && typeof field.focus === 'function') {
        field.focus();
      }
    }

    function validateCurrentStep() {
      const allErrors = validateForReport(readFormValues());
      const stepFieldSet = new Set(STEP_FIELDS[currentStep] || []);
      const stepErrors = {};

      Object.keys(allErrors).forEach(function (field) {
        if (stepFieldSet.has(field)) {
          stepErrors[field] = allErrors[field];
        }
      });
      showErrors(stepErrors);

      if (Object.keys(stepErrors).length > 0) {
        focusFirstError(stepErrors);
        return false;
      }

      return true;
    }

    function updateText(id, text) {
      const element = doc.getElementById(id);
      if (element) element.textContent = text;
    }

    function setProgressWidth(id, rate) {
      const element = doc.getElementById(id);
      if (!element) return;
      const width = Number.isFinite(rate) ? Math.max(0, Math.min(rate, 1)) * 100 : 0;
      element.style.width = `${width}%`;
    }

    function stageLabel(stage) {
      const labels = {
        'freedom-starting': '刚刚起步',
        'freedom-building': '正在积累',
        'freedom-improving': '明显改善',
        'freedom-near': '高度接近自由',
        'cashflow-covered': '现金流已覆盖',
      };
      return labels[stage && stage.key] || '等待生成结果';
    }

    function renderResultSummary(metrics) {
      const heroCopy = buildResultHeroCopy(metrics);
      const overallStatus = metrics.statuses && metrics.statuses.overallStatus
        ? metrics.statuses.overallStatus
        : null;

      updateText('cashflow-rate', heroCopy.rateText);
      updateText('retirement-stage', heroCopy.stageLabel);
      updateText('result-summary-rate-inline', heroCopy.rateText);
      updateText('result-summary-main', heroCopy.summaryText);
      updateText(
        'result-summary-caution',
        overallStatus && overallStatus.caution
          ? overallStatus.caution
          : heroCopy.cautionText
      );
    }

    function formatRate(value) {
      return formatPercent(value);
    }

    function formatMonths(value) {
      const months = Number(value);
      if (!Number.isFinite(months)) return '暂无法计算';
      return `${Math.round(months * 10) / 10} 个月`;
    }

    function renderMetrics(metrics) {
      renderResultSummary(metrics);
      updateText('cashflow-rate', formatRate(metrics.cashflowRetirementRate));
      updateText('asset-rate', formatRate(metrics.targetAssetProgress));
      updateText('asset-work-power', `${formatResultCurrency(metrics.assetWorkPower)} / 月`);
      updateText('labor-rate', formatRate(metrics.laborDependencyRate));
      updateText('safety-months', formatMonths(metrics.safetyMonths));
      updateText('stable-passive-income', `${formatResultCurrency(metrics.monthlyPassiveIncome)} / 月`);
      updateText('semi-passive-income', `${formatResultCurrency(metrics.monthlySemiPassiveIncome)} / 月`);
      updateText('cashflow-badge', metrics.cashflowCovered ? '现金流已覆盖目标生活成本' : '现金流尚未覆盖目标生活成本');
      updateText('asset-badge', metrics.statuses ? metrics.statuses.assetStatus.label : (metrics.assetTargetReached ? '资产模型达标' : '资产仍在积累'));
      setProgressWidth('cashflow-progress', metrics.cashflowRetirementRate);

      const cashflowCopy = metrics.cashflowRetirementRate !== null
        && metrics.cashflowRetirementRate >= 0.8
        ? '自由进度已达到 80% 或以上，但不代表你一定可以立即辞职，仍需考虑风险、稳定性和保障安排。'
        : '稳定被动收入对目标生活成本的覆盖情况，超过 100% 时也会如实显示。';
      updateText('cashflow-explanation', cashflowCopy);

      const assetCopy = metrics.assetTargetReached
        ? '按目标资产模型观察当前已达标，但资产达标不等于现金流覆盖，也不是收益承诺。'
        : '目标资产进度按当前净资产 / 目标退休资产计算，现金流覆盖情况仍比单一资产总额更关键。';
      updateText('asset-retirement-copy', assetCopy);
    }

    function renderEstimate(estimate, metrics) {
      const unavailableMessage = '当前月可投入金额不足，暂不估算具体达成时间。';
      const copySuffix = '该结果只是测算，不代表承诺，也不构成投资建议。';

      if (metrics && metrics.cashflowCovered) {
        updateText('estimated-age', '现金流已覆盖目标生活成本');
        updateText('countdown-days', '继续观察稳定性与安全垫');
        updateText('retirement-age-comparison', `现金流已覆盖目标生活成本，但这不代表可以立即辞职，仍需评估稳定性、安全垫、通胀、医疗、家庭责任和极端风险。${copySuffix}`);
        return;
      }

      if (estimate.status === 'reached') {
        updateText('estimated-age', '资产模型：当前已达标');
        updateText('countdown-days', '现金流模型：尚未达标');
        updateText('retirement-age-comparison', `资产模型当前已达标；现金流模型尚未达标。${copySuffix}`);
        return;
      }

      if (estimate.status === 'estimated') {
        const yearsRemaining = Math.round((estimate.monthsRemaining / 12) * 10) / 10;
        updateText('estimated-age', `保守模型约 ${yearsRemaining} 年`);
        updateText('countdown-days', `约 ${estimate.daysRemaining} 天`);
        updateText(
          'retirement-age-comparison',
          `按当前输入，保守模型估算还需约 ${yearsRemaining} 年达到目标资产。${copySuffix}`,
        );
        return;
      }

      updateText('estimated-age', unavailableMessage);
      updateText('countdown-days', unavailableMessage);
      updateText('retirement-age-comparison', `${unavailableMessage}${copySuffix}`);
    }

    function renderAccelerators(accelerators) {
      const list = doc.getElementById('accelerator-list');
      if (!list) return;
      list.textContent = '';

      accelerators.forEach(function (item) {
        const row = doc.createElement('li');
        const prefix = `每月稳定被动收入 +${formatCurrency(item.addedMonthlyIncome)}：`;
        if (item.status === 'estimated') {
          row.textContent = `${prefix}约提前 ${item.monthsEarlier} 个月（${item.yearsEarlier} 年）。场景模拟，不是投资建议。`;
        } else if (item.status === 'reached') {
          row.textContent = `${prefix}资产模型当前已达标。场景模拟，不是投资建议。`;
        } else {
          row.textContent = `${prefix}当前基础数据下暂无法估算提前时间。场景模拟，不是投资建议。`;
        }
        list.appendChild(row);
      });
    }

    function renderReport(normalized) {
      if (!calculator
        || typeof calculator.calculateMetrics !== 'function'
        || typeof calculator.estimateRetirement !== 'function'
        || typeof calculator.calculateAccelerators !== 'function') {
        return null;
      }

      const metrics = calculator.calculateMetrics(normalized);
      const estimateInput = Object.assign({}, normalized, {
        monthlyPassiveIncome: metrics.monthlyPassiveIncome,
        netAssets: metrics.netAssets,
      });
      const estimate = calculator.estimateRetirement(estimateInput);
      const accelerators = calculator.calculateAccelerators(estimateInput);

      renderMetrics(metrics);
      renderEstimate(estimate, metrics);
      renderAccelerators(accelerators);

      return { metrics, estimate, accelerators };
    }

    function formatShareReportData(normalized, report) {
      const metrics = report ? report.metrics : null;
      const estimate = report ? report.estimate : null;
      const estimatedAge = estimate && estimate.estimatedAge !== null
        ? `${estimate.estimatedAge} 岁`
        : '暂无法计算';
      const countdown = estimate && estimate.status === 'reached'
        ? '资产模型当前已达标'
        : (estimate && estimate.daysRemaining !== null ? `${estimate.daysRemaining} 天` : '暂无法计算');

      return {
        freedomProgress: metrics ? formatRate(metrics.cashflowRetirementRate) : '暂无法计算',
        cashflowRetirementRate: metrics ? formatRate(metrics.cashflowRetirementRate) : '暂无法计算',
        targetAssetProgress: metrics ? formatRate(metrics.targetAssetProgress) : '暂无法计算',
        assetRetirementRate: metrics ? formatRate(metrics.targetAssetProgress) : '暂无法计算',
        assetMonthlyIncome: metrics ? `${formatResultCurrency(metrics.assetWorkPower)} / 月` : '暂无法计算',
        assetWorkPower: metrics ? `${formatResultCurrency(metrics.assetWorkPower)} / 月` : '暂无法计算',
        wageDependency: metrics ? formatRate(metrics.laborDependencyRate) : '暂无法计算',
        laborDependencyRate: metrics ? formatRate(metrics.laborDependencyRate) : '暂无法计算',
        stageLabel: metrics && metrics.statuses ? metrics.statuses.posterSummary.stageLabel : '',
        summaryText: metrics && metrics.statuses ? metrics.statuses.posterSummary.summaryText : '',
        estimatedAge,
        countdown,
        targetMonthlyCost: formatCurrency(normalized.targetMonthlyCost),
      };
    }

    function updateShareSummary(data) {
      const summary = doc.getElementById('share-summary');
      if (!summary || !data) return;
      const lines = shareCard && typeof shareCard.buildShareLines === 'function'
        ? shareCard.buildShareLines(data)
        : [];
      summary.textContent = lines.length > 0
        ? lines.join('。')
        : `已生成测算摘要：自由进度 ${data.freedomProgress}，目标资产进度 ${data.targetAssetProgress}。`;
    }

    function generateReport() {
      const values = readFormValues();
      const errors = validateForReport(values);

      if (Object.keys(errors).length > 0) {
        showView('form');
        showStep(visibleStepForError(errors));
        showErrors(errors);
        focusFirstError(errors);
        return;
      }

      const normalized = normalizeFormData(values);
      const report = renderReport(normalized);
      latestShareData = formatShareReportData(normalized, report);
      updateShareSummary(latestShareData);
      showView(APP_VIEW.RESULT);
      saveDraft();
    }

    function updateSummaries() {
      const values = readFormValues();
      const summaries = buildGuidedSummaries(values);

      updateText('assets-summary', summaries.assets);
      updateText('debts-summary', summaries.debts);
      updateText('net-assets-summary', summaries.debts);
      updateText('investable-summary', summaries.cashflow);
      updateText('passive-summary', summaries.passive);
    }

    function formatCurrency(value) {
      if (calculator && typeof calculator.formatCurrency === 'function') {
        return calculator.formatCurrency(value);
      }

      return new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: 'CNY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(value) || 0);
    }

    function formatPercent(value) {
      if (calculator && typeof calculator.formatPercent === 'function') {
        return calculator.formatPercent(value);
      }

      const rate = Number(value);
      if (value === null || value === '' || !Number.isFinite(rate)) {
        return '暂无法计算';
      }

      return new Intl.NumberFormat('zh-CN', {
        style: 'percent',
        maximumFractionDigits: 1,
      }).format(rate);
    }

    function openPosterView() {
      const canvas = doc.getElementById('share-canvas');
      if (!latestShareData) {
        const summary = doc.getElementById('share-summary');
        if (summary) summary.textContent = '请先生成结果，再保存自由进度卡。';
        return;
      }
      latestShareTrigger = doc.activeElement;
      if (shareCard && typeof shareCard.drawShareCard === 'function' && canvas) {
        shareCard.drawShareCard(canvas, latestShareData);
      }
      updateShareSummary(latestShareData);
      showView(APP_VIEW.POSTER);
    }

    function backToResult() {
      showView(APP_VIEW.RESULT);
      if (latestShareTrigger && typeof latestShareTrigger.focus === 'function') {
        latestShareTrigger.focus();
      }
    }

    function updateCopyFeedback(message) {
      const feedback = doc.getElementById('share-copy-feedback');
      if (!feedback) return;
      feedback.textContent = message;
      feedback.hidden = false;
    }

    function showManualShareCopy(copy) {
      const wrapper = doc.getElementById('manual-share-copy');
      const textarea = doc.getElementById('share-copy-text');
      if (textarea) textarea.value = copy;
      if (wrapper) wrapper.hidden = false;
    }

    async function copyShareText() {
      if (!latestShareData) return;
      const copy = buildShareCopy(latestShareData);
      const nav = doc.defaultView && doc.defaultView.navigator ? doc.defaultView.navigator : null;
      try {
        if (!nav || !nav.clipboard || typeof nav.clipboard.writeText !== 'function') {
          throw new Error('clipboard unavailable');
        }
        await nav.clipboard.writeText(copy);
        updateCopyFeedback('分享文案已复制');
      } catch (error) {
        showManualShareCopy(copy);
        updateCopyFeedback('复制失败，请手动复制下方文案');
      }
    }

    doc.getElementById('start-test')?.addEventListener('click', function () {
      showView(APP_VIEW.FORM);
      showStep(1);
      const firstField = fieldsets[0]?.querySelector('input, select, button');
      if (firstField && typeof firstField.focus === 'function') firstField.focus();
    });
    continueButton?.addEventListener('click', function () {
      loadDraft();
      showView(APP_VIEW.FORM);
      showStep(currentStep);
      const firstField = fieldsets[currentStep - 1]?.querySelector('input, select, button');
      if (firstField && typeof firstField.focus === 'function') firstField.focus();
    });
    doc.getElementById('clear-data')?.addEventListener('click', clearDraft);
    doc.getElementById('clear-result-data')?.addEventListener('click', clearDraft);
    doc.getElementById('restart-test')?.addEventListener('click', restartTest);
    doc.getElementById('back-home')?.addEventListener('click', function () {
      showView(APP_VIEW.LANDING);
      updateContinueVisibility();
    });
    doc.getElementById('open-poster-view')?.addEventListener('click', openPosterView);
    doc.getElementById('back-to-result')?.addEventListener('click', backToResult);
    doc.getElementById('copy-share-copy')?.addEventListener('click', copyShareText);
    doc.getElementById('save-share-card')?.addEventListener('click', function () {
      const canvas = doc.getElementById('share-canvas');
      if (!latestShareData) {
        updateShareSummary(null);
        return;
      }
      if (shareCard && typeof shareCard.drawShareCard === 'function' && canvas) {
        shareCard.drawShareCard(canvas, latestShareData);
      }
      if (shareCard && typeof shareCard.downloadShareCard === 'function') {
        const downloaded = shareCard.downloadShareCard(canvas);
        const hint = doc.getElementById('poster-save-hint');
        if (hint) {
          hint.textContent = downloaded
            ? '已尝试保存自由进度卡。如果无法自动保存，请长按图片保存。'
            : '如果无法自动保存，请长按图片保存。';
        }
      }
      updateShareSummary(latestShareData);
    });

    form.addEventListener('click', function (event) {
      const action = event.target && event.target.dataset ? event.target.dataset.action : '';
      if (action === 'previous') {
        showStep(currentStep - 1);
      }
      if (action === 'next' && validateCurrentStep()) {
        showStep(currentStep + 1);
      }
    });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      generateReport();
    });
    form.addEventListener('input', function () {
      saveDraft();
      updateSummaries();
    });
    form.addEventListener('change', function () {
      saveDraft();
      updateSummaries();
    });

    loadDraft();
    showStep(currentStep, { save: false });
    updateSummaries();
    updateContinueVisibility();

    return {
      showStep,
      readFormValues,
      updateSummaries,
    };
  }

  function getStorage(win) {
    if (!win) return null;
    try {
      const storage = win.localStorage;
      if (!storage) return null;

      const probe = '__retirement_test_probe__';
      storage.setItem(probe, probe);
      storage.removeItem(probe);
      return storage;
    } catch (error) {
      return null;
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        init();
      });
    } else {
      init();
    }
  }

  return {
    APP_VIEW,
    STORAGE_KEY,
    buildResultHeroCopy,
    buildShareCopy,
    buildGuidedSummaries,
    formatResultCurrency,
    formatWholeCurrency,
    normalizeFormData,
    validateForReport,
    init,
  };
});
