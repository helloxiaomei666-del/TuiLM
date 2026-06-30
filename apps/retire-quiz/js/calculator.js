(function (root, factory) {
  const calculator = factory();

  root.RetirementCalculator = calculator;

  if (typeof module === 'object' && module.exports) {
    module.exports = calculator;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function toAmount(value) {
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0 ? amount : 0;
  }

  function toMonthly(value, frequency) {
    const amount = toAmount(value);
    const normalizedFrequency = String(frequency).trim().toLowerCase();

    if (normalizedFrequency === 'month') return amount;
    if (normalizedFrequency === 'quarter') return amount / 3;
    if (normalizedFrequency === 'year') return amount / 12;
    return 0;
  }

  function ownValue(source, key) {
    return source != null && Object.prototype.hasOwnProperty.call(source, key)
      ? source[key]
      : undefined;
  }

  function saturatingAdd(total, amount) {
    return total > Number.MAX_VALUE - amount
      ? Number.MAX_VALUE
      : total + amount;
  }

  function sumAmounts(values, keys) {
    const source = values || {};
    return keys.reduce(function (total, key) {
      return saturatingAdd(total, toAmount(ownValue(source, key)));
    }, 0);
  }

  function firstAmount(values, keys) {
    const source = values || {};
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        return toAmount(source[key]);
      }
    }
    return 0;
  }

  function sumMonthlyIncome(values, keys) {
    const source = values || {};
    return keys.reduce(function (total, key) {
      const income = ownValue(source, key) || {};
      return saturatingAdd(
        total,
        toMonthly(ownValue(income, 'amount'), ownValue(income, 'frequency'))
      );
    }, 0);
  }

  function safeRatio(numerator, denominator) {
    if (!Number.isFinite(numerator)
      || !Number.isFinite(denominator)
      || denominator <= 0) {
      return null;
    }

    const ratio = numerator / denominator;
    return Number.isFinite(ratio) ? ratio : null;
  }

  function classifyStage(rate) {
    if (rate === null || rate < 0.2) return { key: 'freedom-starting' };
    if (rate < 0.5) return { key: 'freedom-building' };
    if (rate < 0.8) return { key: 'freedom-improving' };
    if (rate < 1) return { key: 'freedom-near' };
    return { key: 'cashflow-covered' };
  }

  function deriveCashFlowStatus(rate) {
    if (!Number.isFinite(Number(rate)) || Number(rate) < 0.2) {
      return {
        key: 'freedom-starting',
        label: '刚刚起步',
        description: '稳定被动收入已经出现，但覆盖比例仍较低。',
      };
    }
    if (rate < 0.5) {
      return {
        key: 'freedom-building',
        label: '正在积累',
        description: '稳定被动收入正在积累，已经开始分担一部分目标生活成本。',
      };
    }
    if (rate < 0.8) {
      return {
        key: 'freedom-improving',
        label: '明显改善',
        description: '稳定被动收入已经覆盖较多目标生活成本。',
      };
    }
    if (rate < 1) {
      return {
        key: 'freedom-near',
        label: '高度接近自由',
        description: '稳定被动收入接近覆盖目标生活成本。',
      };
    }
    return {
      key: 'cashflow-covered',
      label: '现金流已覆盖',
      description: '稳定被动收入已覆盖目标生活成本，但仍需观察稳定性和风险。',
    };
  }

  function deriveAssetStatus(progress) {
    const value = Number(progress);
    if (!Number.isFinite(value)) {
      return {
        key: 'asset-unavailable',
        label: '资产状态暂无法判断',
        description: '目标生活成本不足时，暂无法计算目标资产进度。',
      };
    }
    if (value < 0) {
      return {
        key: 'asset-debt-repair',
        label: '资产负债修复期',
        description: '当前净资产为负，优先修复资产负债表。',
      };
    }
    if (value < 0.2) {
      return {
        key: 'asset-accumulation-start',
        label: '资产积累起步期',
        description: '净资产已开始积累，但距离目标资产仍有较大差距。',
      };
    }
    if (value < 0.5) {
      return {
        key: 'asset-accumulation-progress',
        label: '资产积累推进期',
        description: '净资产正在向目标资产推进。',
      };
    }
    if (value < 0.8) {
      return {
        key: 'asset-near-target',
        label: '资产接近目标期',
        description: '净资产已经完成目标资产的一半以上。',
      };
    }
    if (value < 1) {
      return {
        key: 'asset-target-close',
        label: '资产临近达标期',
        description: '净资产已经接近目标资产。',
      };
    }
    return {
      key: 'asset-model-reached',
      label: '资产模型达标期',
      description: '按目标资产模型观察，当前净资产已覆盖简化估算目标。',
    };
  }

  function deriveOverallStatus(metrics) {
    const cashflowRate = metrics.cashflowRetirementRate;
    const assetProgress = metrics.targetAssetProgress;

    if (metrics.netAssets < 0) {
      return {
        title: '优先修复资产负债表',
        description: '当前优先级不是退休，而是修复资产负债表、建立安全垫，并降低高息负债压力。',
        caution: '本结果仅供自我观察，不构成投资、理财、保险或退休决策建议。',
      };
    }
    if (cashflowRate !== null && cashflowRate >= 1) {
      return {
        title: '现金流覆盖观察期',
        description: '从现金流角度看，稳定被动收入已覆盖目标生活成本。',
        caution: '这不代表可以立即辞职，仍需评估现金流稳定性、安全垫、通胀、医疗、家庭责任和极端风险。',
      };
    }
    if (assetProgress !== null && assetProgress >= 1) {
      return {
        title: '资产模型达标，现金流尚未达标',
        description: '按资产模型观察已达标，但现金流尚未完全覆盖生活成本，仍需工资或主动收入支持。',
        caution: '资产达标不等于现金流覆盖，本结果仅供自我观察。',
      };
    }
    if (assetProgress !== null && assetProgress >= 0.8) {
      return {
        title: '资产基础较好，现金流尚未覆盖',
        description: '你的资产基础已经较好，但现金流还没有完全覆盖目标生活成本。',
        caution: '目标资产进度只是辅助观察，核心仍是现金流退休率。',
      };
    }
    return {
      title: '资产积累与现金流建设阶段',
      description: '当前仍处于资产积累与现金流建设阶段，需要继续观察净资产、稳定现金流和安全垫。',
      caution: '本结果仅供自我观察，不构成投资、理财、保险或退休决策建议。',
    };
  }

  function getPosterSummaryByCashFlowRate(rate, stablePassiveIncome, netAssets) {
    if (Number(netAssets) < 0) {
      return {
        stageLabel: '资产负债修复中',
        summaryText: '当前优先级不是退休，而是先修复资产负债表。',
      };
    }
    if (toAmount(stablePassiveIncome) <= 0) {
      return {
        stageLabel: '打基础中',
        summaryText: '稳定现金流还没真正接班，现在主要还是靠自己扛。',
      };
    }
    const value = Number(rate);
    if (!Number.isFinite(value) || value < 0.2) {
      return {
        stageLabel: '刚刚起步',
        summaryText: '稳定现金流刚刚出现，大部分生活成本仍需要工资支持。',
      };
    }
    if (value < 0.5) {
      return {
        stageLabel: '正在积累',
        summaryText: '稳定现金流正在积累，已经开始分担一部分生活成本。',
      };
    }
    if (value < 0.8) {
      return {
        stageLabel: '明显改善',
        summaryText: '稳定现金流已经覆盖较多目标生活成本，选择权正在变多。',
      };
    }
    if (value < 1) {
      return {
        stageLabel: '高度接近自由',
        summaryText: '距离覆盖目标生活成本已经不远，下一步更要看稳定性和安全垫。',
      };
    }
    return {
      stageLabel: '现金流已覆盖',
      summaryText: '从现金流看，目标生活成本已被覆盖，但仍要看稳定性、安全垫和长期风险。',
    };
  }

  function calculateMetrics(input) {
    const data = input || {};
    const assets = ownValue(data, 'assets') || {};
    const currentMonthlyCost = toAmount(ownValue(data, 'currentMonthlyCost'));
    const targetMonthlyCost = toAmount(ownValue(data, 'targetMonthlyCost'));
    const baseAssets = sumAmounts(assets, [
      'cash',
      'funds',
      'stocks',
      'gold',
      'other',
    ]);
    const propertyValue = firstAmount(assets, [
      'propertyValue',
      'propertyEquity',
      'propertyNetValue',
      'realEstateNetValue',
    ]);
    const totalAssets = saturatingAdd(baseAssets, propertyValue);
    const debts = ownValue(data, 'debts') || {};
    const baseDebts = sumAmounts(debts, [
      'carLoan',
      'consumerLoan',
      'other',
    ]);
    const mortgageBalance = firstAmount(debts, ['mortgageBalance', 'mortgage']);
    const totalDebts = saturatingAdd(baseDebts, mortgageBalance);
    const netAssets = totalAssets - totalDebts;
    const calculatedRetirementTarget = targetMonthlyCost * 12 * 25;
    const retirementTargetAssets = targetMonthlyCost > 0
      && Number.isFinite(calculatedRetirementTarget)
      ? calculatedRetirementTarget
      : null;
    const monthlyPassiveIncome = sumMonthlyIncome(ownValue(data, 'passiveIncome'), [
      'dividends',
      'rent',
      'interest',
      'reits',
      'pension',
      'annuity',
      'royalties',
      'other',
    ]);
    const semiPassiveIncome = ownValue(data, 'semiPassiveIncome') || {};
    const monthlySemiPassiveIncome = toMonthly(
      ownValue(semiPassiveIncome, 'amount'),
      ownValue(semiPassiveIncome, 'frequency')
    );
    const cashflowRetirementRate = safeRatio(monthlyPassiveIncome, targetMonthlyCost);
    const targetAssetProgress = safeRatio(netAssets, retirementTargetAssets);
    const laborDependencyRate = safeRatio(
      Math.max(0, targetMonthlyCost - monthlyPassiveIncome),
      targetMonthlyCost
    );
    const assetWorkPower = saturatingAdd(monthlyPassiveIncome, monthlySemiPassiveIncome);
    const safetyMonths = safeRatio(toAmount(ownValue(assets, 'cash')), currentMonthlyCost);
    const statusInput = {
      netAssets,
      cashflowRetirementRate,
      targetAssetProgress,
    };
    const statuses = {
      cashFlowStatus: deriveCashFlowStatus(cashflowRetirementRate),
      assetStatus: deriveAssetStatus(targetAssetProgress),
      overallStatus: deriveOverallStatus(statusInput),
      posterSummary: getPosterSummaryByCashFlowRate(
        cashflowRetirementRate,
        monthlyPassiveIncome,
        netAssets
      ),
    };

    return {
      totalAssets,
      totalDebts,
      netAssets,
      retirementTargetAssets,
      monthlyPassiveIncome,
      monthlySemiPassiveIncome,
      cashflowRetirementRate,
      assetRetirementRate: targetAssetProgress,
      targetAssetProgress,
      laborDependencyRate,
      assetWorkPower,
      safetyMonths,
      stage: classifyStage(cashflowRetirementRate),
      statuses,
      cashflowCovered: cashflowRetirementRate !== null && cashflowRetirementRate >= 1,
      assetTargetReached: targetAssetProgress !== null && targetAssetProgress >= 1,
    };
  }

  function finiteNetAssets(value) {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : 0;
  }

  function unavailableEstimate(summary) {
    return Object.assign(summary, {
      status: 'unavailable',
      monthsRemaining: null,
      estimatedAge: null,
      daysRemaining: null,
    });
  }

  function estimateRetirement(input) {
    const data = input || {};
    const age = toAmount(ownValue(data, 'age'));
    const targetMonthlyCost = toAmount(ownValue(data, 'targetMonthlyCost'));
    const monthlyPassiveIncome = toAmount(ownValue(data, 'monthlyPassiveIncome'));
    const netAssets = finiteNetAssets(ownValue(data, 'netAssets'));
    const monthlyIncome = saturatingAdd(
      toAmount(ownValue(data, 'monthlySalary')),
      toAmount(ownValue(data, 'monthlySideIncome'))
    );
    const monthlySpend = [
      'monthlyLivingExpense',
      'monthlyFixedExpense',
      'monthlyDebtPayment',
    ].reduce(function (total, key) {
      return saturatingAdd(total, toAmount(ownValue(data, key)));
    }, 0);
    const monthlyInvestable = Math.max(0, monthlyIncome - monthlySpend);
    const remainingMonthlyCost = Math.max(0, targetMonthlyCost - monthlyPassiveIncome);
    const calculatedTarget = remainingMonthlyCost * 12 / 0.04;
    const adjustedTargetAssets = Number.isFinite(calculatedTarget)
      ? calculatedTarget
      : null;
    const summary = {
      age,
      monthlyIncome,
      monthlySpend,
      monthlyInvestable,
      remainingMonthlyCost,
      adjustedTargetAssets,
      assetGap: null,
    };

    if (adjustedTargetAssets === null) {
      return unavailableEstimate(summary);
    }

    if (netAssets >= adjustedTargetAssets) {
      return Object.assign(summary, {
        assetGap: 0,
        status: 'reached',
        monthsRemaining: 0,
        estimatedAge: age,
        daysRemaining: 0,
      });
    }

    const calculatedGap = adjustedTargetAssets - netAssets;
    if (!Number.isFinite(calculatedGap)) {
      return unavailableEstimate(summary);
    }
    summary.assetGap = calculatedGap;

    if (monthlyInvestable <= 0) {
      return unavailableEstimate(summary);
    }

    const calculatedMonthsRemaining = calculatedGap / monthlyInvestable;
    const monthsRemaining = Math.round(calculatedMonthsRemaining * 100) / 100;
    const calculatedAge = age + monthsRemaining / 12;
    const estimatedAge = Math.round(calculatedAge * 10) / 10;
    const daysRemaining = Math.round(monthsRemaining * 365.2425 / 12);
    if (!Number.isFinite(monthsRemaining)
      || !Number.isFinite(estimatedAge)
      || !Number.isFinite(daysRemaining)) {
      return unavailableEstimate(summary);
    }

    return Object.assign(summary, {
      status: 'estimated',
      monthsRemaining,
      estimatedAge,
      daysRemaining,
    });
  }

  function calculateAccelerators(input) {
    const data = input || {};
    const baseline = estimateRetirement(data);
    const increments = [100, 500, 1000];

    if (baseline.status !== 'estimated') {
      return increments.map(function (addedMonthlyIncome) {
        return {
          addedMonthlyIncome,
          status: baseline.status,
          monthsEarlier: null,
          yearsEarlier: null,
        };
      });
    }

    return increments.map(function (addedMonthlyIncome) {
      const increasedPassiveIncome = saturatingAdd(
        toAmount(ownValue(data, 'monthlyPassiveIncome')),
        addedMonthlyIncome
      );
      const scenario = estimateRetirement(Object.assign({}, data, {
        monthlyPassiveIncome: increasedPassiveIncome,
      }));

      if (scenario.status === 'unavailable') {
        return {
          addedMonthlyIncome,
          status: scenario.status,
          monthsEarlier: null,
          yearsEarlier: null,
        };
      }

      const monthsEarlier = Math.max(
        0,
        Math.round(baseline.monthsRemaining - scenario.monthsRemaining)
      );
      return {
        addedMonthlyIncome,
        status: scenario.status,
        monthsEarlier,
        yearsEarlier: Math.round(monthsEarlier / 12 * 10) / 10,
      };
    });
  }

  function formatCurrency(value) {
    const amount = Number(value);
    if (value === null || value === '' || !Number.isFinite(amount)) {
      return '暂无法计算';
    }

    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  function formatPercent(value) {
    const rate = Number(value);
    if (value === null || value === '' || !Number.isFinite(rate)) {
      return '暂无法计算';
    }

    return new Intl.NumberFormat('zh-CN', {
      style: 'percent',
      maximumFractionDigits: 1,
    }).format(rate);
  }

  return {
    toAmount,
    toMonthly,
    calculateMetrics,
    deriveCashFlowStatus,
    deriveAssetStatus,
    deriveOverallStatus,
    getPosterSummaryByCashFlowRate,
    estimateRetirement,
    calculateAccelerators,
    formatCurrency,
    formatPercent,
  };
});
