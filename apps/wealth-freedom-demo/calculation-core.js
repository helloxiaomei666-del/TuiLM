(function attachWealthCalculation(global) {
  const defaultAssetCategories = {
    cash: { label: "现金", apiProvider: "cash.manual" },
    stock: { label: "基金", apiProvider: "quotes.equityOrFund" },
    bond: { label: "债券", apiProvider: "quotes.bondOrBondFund" },
    commodity: { label: "商品", apiProvider: "quotes.commodity" },
  };

  const defaultQuoteApiAdapters = {
    stock: "/api/quotes/equity-fund",
    bond: "/api/quotes/bond",
    commodity: "/api/quotes/commodity",
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function numberOr(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function progressFromAssets(assets, target) {
    return Math.min(100, (assets / Math.max(target, 1)) * 100);
  }

  function getManualDragTotal(manualDrags = []) {
    return manualDrags.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }

  function getHoldingCategory(holding = {}, assetCategories = defaultAssetCategories) {
    if (assetCategories[holding.type]) return holding.type;
    if (holding.type === "fund" || holding.type === "stock") return "stock";
    if (holding.type === "gold" || holding.type === "other") return "commodity";
    return "cash";
  }

  function getHoldingValue(holding = {}) {
    if (typeof holding.currentValue === "number") return holding.currentValue;
    if (typeof holding.value === "number") return holding.value;
    if (holding.quantity && holding.currentPrice) return holding.quantity * holding.currentPrice;
    return 0;
  }

  function getHoldingCost(holding = {}) {
    if (typeof holding.costAmount === "number") return holding.costAmount;
    if (holding.quantity && holding.costPrice) return holding.quantity * holding.costPrice;
    if (typeof holding.cost === "number") return holding.cost;
    return getHoldingValue(holding);
  }

  function getHoldingPnl(holding = {}) {
    const value = getHoldingValue(holding);
    const cost = getHoldingCost(holding);
    return {
      value,
      cost,
      totalPnl: value - cost,
      todayPnl: Number.isFinite(Number(holding.todayPnl)) ? Number(holding.todayPnl) : value * numberOr(holding.dailyChange, 0),
    };
  }

  function normalizeHolding(holding = {}, options = {}) {
    const assetCategories = options.assetCategories || defaultAssetCategories;
    const quoteApiAdapters = options.quoteApiAdapters || defaultQuoteApiAdapters;
    const rawType = holding.type || "cash";
    const type =
      assetCategories[rawType] ? rawType : rawType === "fund" || rawType === "stock" ? "stock" : rawType === "gold" ? "commodity" : "cash";
    const legacyValue = numberOr(holding.currentValue, numberOr(holding.value, 0));
    const legacyCost = numberOr(holding.costAmount, numberOr(holding.cost, legacyValue));
    const explicitQuantity = numberOr(holding.quantity, 0);
    let currentPrice = numberOr(holding.currentPrice, numberOr(holding.nav, numberOr(holding.spotPrice, 0)));
    let costPrice = numberOr(holding.costPrice, numberOr(holding.costNav, numberOr(holding.costSpotPrice, 0)));
    let quantity = explicitQuantity;

    if (type === "cash") {
      const amount = legacyValue || numberOr(holding.currentPrice, 0) || legacyCost;
      return {
        ...holding,
        type,
        instrument: "cash",
        name: holding.name || "现金账户",
        platform: holding.platform || "现金账户",
        code: holding.code || "",
        quantity: 1,
        costPrice: amount,
        currentPrice: amount,
        currentValue: amount,
        costAmount: amount,
        todayPnl: numberOr(holding.todayPnl, 0),
        updatedAt: holding.updatedAt || "手动录入",
        source: holding.source || "手动录入",
        apiProvider: holding.apiProvider || assetCategories.cash.apiProvider,
        quoteEndpoint: null,
        ocrEndpoint: null,
      };
    }

    if (!quantity && currentPrice > 0 && legacyValue > 0) quantity = legacyValue / currentPrice;
    if (!quantity && costPrice > 0 && legacyCost > 0) quantity = legacyCost / costPrice;
    if (!quantity) quantity = 1;
    if (!currentPrice) currentPrice = legacyValue / Math.max(quantity, 1);
    if (!costPrice) costPrice = legacyCost / Math.max(quantity, 1);

    const currentValue = quantity * currentPrice;
    const costAmount = quantity * costPrice;
    const todayPnl = Number.isFinite(Number(holding.todayPnl))
      ? Number(holding.todayPnl)
      : currentValue * numberOr(holding.dailyChange, 0);

    return {
      ...holding,
      type,
      instrument: holding.instrument || (type === "stock" ? "fund" : type === "bond" ? "bondFund" : "commodityFund"),
      name: holding.name || assetCategories[type]?.label || "未命名资产",
      platform: holding.platform || "手动录入",
      code: holding.code || "",
      quantity,
      costPrice,
      currentPrice,
      currentValue,
      costAmount,
      todayPnl,
      updatedAt: holding.updatedAt || "旧数据迁移",
      source: holding.source || "手动录入",
      apiProvider: holding.apiProvider || assetCategories[type]?.apiProvider,
      quoteEndpoint: holding.quoteEndpoint || quoteApiAdapters[type],
      ocrEndpoint: holding.ocrEndpoint || null,
    };
  }

  function getHoldingTotals(holdings = [], options = {}) {
    const rows = holdings.map((holding) => {
      const normalized = normalizeHolding(holding, options);
      return {
        ...normalized,
        ...getHoldingPnl(normalized),
        category: getHoldingCategory(normalized, options.assetCategories || defaultAssetCategories),
      };
    });
    const cash = rows.filter((item) => item.category === "cash").reduce((sum, item) => sum + item.value, 0);
    const investments = rows.filter((item) => item.category !== "cash").reduce((sum, item) => sum + item.value, 0);
    const todayPnl = rows.reduce((sum, item) => sum + item.todayPnl, 0);
    return { rows, cash, investments, total: cash + investments, todayPnl };
  }

  function deriveSalaryGrowth(values) {
    const history = [values.salaryYear3, values.salaryYear2, values.salaryYear1, values.salary].map((item, index) => ({
      index,
      value: Math.max(0, numberOr(item, 0)),
    }));
    const positiveHistory = history.filter((item) => item.value > 0);
    const hasZeroHistory = history.slice(0, 3).some((item) => item.value === 0);

    if (positiveHistory.length < 2) {
      return {
        rate: 0,
        confidence: hasZeroHistory ? "历史工资不足" : "数据不足",
        points: history.map((item) => item.value),
        positivePoints: positiveHistory.map((item) => item.value),
        years: 0,
      };
    }

    const first = positiveHistory[0];
    const last = positiveHistory[positiveHistory.length - 1];
    const years = Math.max(last.index - first.index, 1);
    const rate = (Math.pow(last.value / first.value, 1 / years) - 1) * 100;
    const volatility =
      positiveHistory.slice(1).reduce((sum, item, index) => {
        const lastValue = positiveHistory[index].value;
        return sum + Math.abs(item.value / lastValue - 1);
      }, 0) / Math.max(positiveHistory.length - 1, 1);

    return {
      rate: clamp(rate, -20, 30),
      confidence: hasZeroHistory ? "含0收入年份" : volatility > 0.16 ? "波动较大" : "相对稳定",
      points: history.map((item) => item.value),
      positivePoints: positiveHistory.map((item) => item.value),
      years,
    };
  }

  function deriveInvestmentReturn(values) {
    const rows = [
      { start: values.assetStart3, end: values.assetEnd3, contribution: values.assetContribution3 },
      { start: values.assetStart2, end: values.assetEnd2, contribution: values.assetContribution2 },
      { start: values.assetStart1, end: values.assetEnd1, contribution: values.assetContribution1 },
    ].filter((row) => row.start > 0 || row.end > 0);

    if (!rows.length) return { rate: 0, confidence: "数据不足", yearly: [] };

    const yearly = rows.map((row) => {
      const capitalBase = Math.max(row.start + row.contribution / 2, 1);
      const profit = row.end - row.start - row.contribution;
      return { ...row, profit, capitalBase, rate: clamp((profit / capitalBase) * 100, -60, 80) };
    });
    const weightedProfit = yearly.reduce((sum, row) => sum + row.profit, 0);
    const weightedCapital = yearly.reduce((sum, row) => sum + row.capitalBase, 0);
    const weightedRate = weightedCapital > 0 ? (weightedProfit / weightedCapital) * 100 : 0;
    const swing = Math.max(...yearly.map((row) => row.rate)) - Math.min(...yearly.map((row) => row.rate));

    return {
      rate: clamp(weightedRate, -30, 35),
      confidence: swing > 18 ? "波动较大" : "相对稳定",
      yearly,
    };
  }

  function monthlyRate(annualReturn) {
    return Math.pow(1 + annualReturn / 100, 1 / 12) - 1;
  }

  function getModel(values, overrides = {}) {
    const salaryBacktest = deriveSalaryGrowth(values);
    const returnBacktest = deriveInvestmentReturn(values);
    return {
      ...values,
      annualReturn: returnBacktest.rate,
      salaryGrowth: salaryBacktest.rate,
      salaryBacktest,
      returnBacktest,
      ...overrides,
    };
  }

  function simulate(values, overrides = {}) {
    const config = getModel(values, overrides);
    let assets = config.cash + config.investments;
    let salary = config.salary;
    const sideIncome = config.sideIncome;
    const target = Math.max(config.target, 1);
    const rate = monthlyRate(config.annualReturn);
    const salaryGrowth = Math.pow(1 + config.salaryGrowth / 100, 1 / 12) - 1;
    const fixedOutflow =
      config.livingCost + config.mortgage + config.carLoan + config.otherDebt + (config.manualDragOutflow || 0);
    const points = [{ month: 0, assets, netInput: salary + sideIncome - fixedOutflow }];
    let months = 0;
    let reachedMonth = assets >= target ? 0 : null;
    const firstMonthlyInvestable = salary + sideIncome - fixedOutflow;

    while (months < 720) {
      months += 1;
      const netInput = salary + sideIncome - fixedOutflow;
      assets = assets * (1 + rate) + netInput;
      salary *= 1 + salaryGrowth;

      if (reachedMonth === null && assets >= target) reachedMonth = months;
      if (months % 12 === 0) points.push({ month: months, assets, netInput });
      if (reachedMonth !== null && months >= Math.max(120, reachedMonth + 36)) break;
    }

    return {
      ...config,
      months: reachedMonth ?? 720,
      reached: reachedMonth !== null,
      finalAssets: assets,
      currentAssets: config.cash + config.investments,
      monthlyInvestable: firstMonthlyInvestable,
      points,
    };
  }

  function delayCompared(base, alternative) {
    if (!base.reached && !alternative.reached) return 0;
    if (!base.reached && alternative.reached) return 720 - alternative.months;
    if (base.reached && !alternative.reached) return 720 - base.months;
    return base.months - alternative.months;
  }

  function getSecurityAccountTotal(accounts = {}) {
    return [
      accounts.pension?.balance,
      accounts.housingFund?.balance,
      accounts.supplementalHousingFund?.balance,
      accounts.enterpriseAnnuity?.balance,
      accounts.occupationalAnnuity?.balance,
    ].reduce((sum, value) => sum + numberOr(value, 0), 0);
  }

  function getSecurityRetirementIncomeMonthly(accounts = {}) {
    return [
      accounts.pension?.estimatedMonthlyBenefit,
      accounts.enterpriseAnnuity?.estimatedMonthlyBenefit,
      accounts.occupationalAnnuity?.estimatedMonthlyBenefit,
    ].reduce((sum, value) => sum + numberOr(value, 0), 0);
  }

  function getHousingLoanOffsetMonthly(accounts = {}, mortgage = 0) {
    const rawOffset =
      numberOr(accounts.housingFund?.loanOffsetMonthly, 0) +
      numberOr(accounts.supplementalHousingFund?.loanOffsetMonthly, 0);
    return clamp(rawOffset, 0, Math.max(0, numberOr(mortgage, 0)));
  }

  function getSecuritySupport(values, baseResult, securityAccounts = {}, pensionYearsTarget = 20) {
    const total = getSecurityAccountTotal(securityAccounts);
    const target = Math.max(values.target, 1);
    const monthlyRetirementIncome = getSecurityRetirementIncomeMonthly(securityAccounts);
    const incomeEquivalentTarget = monthlyRetirementIncome * 12 / 0.04;
    const housingLoanOffsetMonthly = getHousingLoanOffsetMonthly(securityAccounts, values.mortgage);
    const targetRelief = total + incomeEquivalentTarget;
    const adjustedTarget = Math.max(1, target - targetRelief);
    const supportedResult = simulate(
      {
        ...values,
        mortgage: Math.max(0, numberOr(values.mortgage, 0) - housingLoanOffsetMonthly),
      },
      { target: adjustedTarget },
    );
    return {
      total,
      monthlyRetirementIncome,
      incomeEquivalentTarget,
      housingLoanOffsetMonthly,
      targetRelief,
      balanceFactor: total / target,
      supportFactor: targetRelief / target,
      reducedMonths: Math.max(0, delayCompared(baseResult, supportedResult)),
      pensionProgress: clamp((numberOr(securityAccounts.pension?.yearsPaid, 0) / pensionYearsTarget) * 100, 0, 100),
    };
  }

  function stableHash(value) {
    return String(value).split("").reduce((hash, char) => {
      return (hash * 31 + char.charCodeAt(0)) % 1000003;
    }, 17);
  }

  function mockQuoteRate(holding, seed, assetCategories = defaultAssetCategories) {
    const ranges = { stock: 0.018, bond: 0.0035, commodity: 0.012 };
    const category = getHoldingCategory(holding, assetCategories);
    const range = ranges[category] || 0;
    const hash = stableHash(`${holding.id}:${holding.code}:${seed}`);
    return ((hash / 1000003) * 2 - 1) * range;
  }

  function roundedPrice(value) {
    if (value >= 100) return Number(value.toFixed(2));
    if (value >= 1) return Number(value.toFixed(4));
    return Number(value.toFixed(6));
  }

  function refreshMockHoldings(holdings = [], options = {}) {
    const assetCategories = options.assetCategories || defaultAssetCategories;
    const seed = options.seed || 1;
    const refreshedAt = options.refreshedAt || "";
    const nextHoldings = holdings.map((holding) => {
      const normalized = normalizeHolding(holding, options);
      if (getHoldingCategory(normalized, assetCategories) === "cash") return normalized;

      const previousValue = getHoldingValue(normalized);
      const nextPrice = roundedPrice(Math.max(0.0001, normalized.currentPrice * (1 + mockQuoteRate(normalized, seed, assetCategories))));
      const currentValue = normalized.quantity * nextPrice;
      return {
        ...normalized,
        currentPrice: nextPrice,
        currentValue,
        costAmount: normalized.quantity * normalized.costPrice,
        todayPnl: currentValue - previousValue,
        updatedAt: refreshedAt,
        source: normalized.source || "Mock 行情刷新",
      };
    });
    return {
      holdings: nextHoldings,
      totals: getHoldingTotals(nextHoldings, options),
    };
  }

  function dragInsights(values, base, tests = []) {
    return tests
      .filter((item) => Object.entries(item.test).some(([key, value]) => Number(values[key]) > Number(value)))
      .map((item) => {
        const result = simulate(values, item.test);
        return { ...item, isFlexible: false, result, savedMonths: Math.max(0, delayCompared(base, result)) };
      })
      .filter((item) => item.savedMonths > 0)
      .sort((a, b) => b.savedMonths - a.savedMonths)
      .slice(0, 4);
  }

  function getManualDragInsights(manualDrags = [], values, base) {
    return manualDrags.map((item) => {
      const result = simulate(values, {
        manualDragOutflow: Math.max(0, values.manualDragOutflow - (Number(item.amount) || 0)),
      });
      const isFlexible = item.category === "other";
      const defaultDetail = isFlexible ? "其他类拖累项可先复盘是否仍有必要。" : "这类支出已计入现金流，若后续减少会同步影响退休时间。";
      return {
        id: item.id,
        title: item.title,
        detail: item.detail || defaultDetail,
        source: "manual",
        isManual: true,
        isFlexible,
        savedMonths: Math.max(0, delayCompared(base, result)),
        result,
      };
    });
  }

  function formatDragImpactText(item = {}, options = {}) {
    const savedMonths = Math.max(0, Number(item.savedMonths) || 0);
    const monthsFormatter = options.monthsFormatter || ((months) => `${months} 个月`);
    if ((item.isManual || item.source === "manual" || item.isFlexible) && savedMonths > 0) {
      return `若减少可提前约 ${monthsFormatter(savedMonths)}`;
    }
    if (item.isManual || item.source === "manual") {
      return "已计入现金流";
    }
    return `影响约 ${monthsFormatter(savedMonths)}`;
  }

  const api = {
    clamp,
    numberOr,
    progressFromAssets,
    getManualDragTotal,
    normalizeHolding,
    getHoldingTotals,
    getHoldingValue,
    getHoldingCost,
    getHoldingCategory,
    getHoldingPnl,
    deriveSalaryGrowth,
    deriveInvestmentReturn,
    monthlyRate,
    getModel,
    simulate,
    delayCompared,
    getSecurityAccountTotal,
    getSecuritySupport,
    stableHash,
    mockQuoteRate,
    roundedPrice,
    refreshMockHoldings,
    dragInsights,
    getManualDragInsights,
    formatDragImpactText,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.WealthCalculation = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
