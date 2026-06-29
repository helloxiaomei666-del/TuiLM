const { yuan } = require("./format");

function clampIndex(length, index = 0) {
  if (!length) return 0;
  return Math.min(Math.max(Number(index) || 0, 0), length - 1);
}

function getRouteYears(result) {
  const points = result && result.points ? result.points : [];
  return points.map((point, index) => {
    const gap = (result.target || 0) - point.assets;
    const year = Math.round(point.month / 12);
    return {
      index,
      month: point.month,
      year,
      assets: point.assets,
      netInput: point.netInput,
      title: `第 ${year} 年`,
      assetText: yuan(point.assets),
      gapText: gap > 0 ? `距目标还差 ${yuan(gap)}` : `已超过目标 ${yuan(Math.abs(gap))}`,
      netInputText: yuan(point.netInput),
    };
  });
}

function getSelectedRouteYear(result, index = 0) {
  const years = getRouteYears(result);
  if (!years.length) return null;
  return years[clampIndex(years.length, index)];
}

function percent(value, maxValue, fallback = 0) {
  if (!maxValue || maxValue <= 0) return `${fallback}%`;
  return `${Math.max(0, Math.min(100, (value / maxValue) * 100)).toFixed(1)}%`;
}

function pickChartIndices(length, reachedIndex) {
  if (!length) return [];
  const maxIndex = length - 1;
  const wanted = new Set([0, maxIndex]);
  if (reachedIndex >= 0) wanted.add(reachedIndex);

  const segmentCount = Math.min(6, maxIndex);
  for (let step = 1; step < segmentCount; step += 1) {
    wanted.add(Math.round((maxIndex * step) / segmentCount));
  }

  return Array.from(wanted)
    .filter((index) => index >= 0 && index < length)
    .sort((a, b) => a - b);
}

function getRouteChart(result, index = 0) {
  const years = getRouteYears(result);
  const target = Number(result && result.target) || 0;
  if (!years.length) {
    return {
      targetText: yuan(target),
      targetLineBottom: "0%",
      reachedText: "暂无路线数据",
      points: [],
    };
  }

  const reachedIndex = findFirstIndex(years, (item) => target > 0 && item.assets >= target);
  const maxAsset = years.reduce((max, item) => Math.max(max, item.assets), 0);
  const maxValue = Math.max(target, maxAsset, 1);
  const indices = pickChartIndices(years.length, reachedIndex);
  const points = indices.map((pointIndex) => {
    const item = years[pointIndex];
    const states = [];
    if (pointIndex === 0) states.push("is-current");
    if (pointIndex === reachedIndex) states.push("is-reached");
    if (target > 0 && item.assets >= target) states.push("is-above-target");
    return {
      index: pointIndex,
      title: item.title,
      assetText: item.assetText,
      gapText: item.gapText,
      barHeight: percent(item.assets, maxValue, 6),
      stateClass: states.join(" "),
      markerText: pointIndex === reachedIndex ? "达成" : "",
    };
  });

  return {
    targetText: yuan(target),
    targetLineBottom: percent(target, maxValue, 0),
    reachedText: reachedIndex >= 0 ? `${years[reachedIndex].title}达成目标` : "当前假设下暂未达成",
    points,
  };
}

function findFirstIndex(rows, predicate) {
  for (let index = 0; index < rows.length; index += 1) {
    if (predicate(rows[index], index)) return index;
  }
  return -1;
}

function getRouteDiagnostics(result, index = 0) {
  const years = getRouteYears(result);
  if (!years.length) {
    return {
      title: "路线诊断",
      cards: [],
      trajectory: [],
    };
  }

  const selectedIndex = clampIndex(years.length, index);
  const selected = years[selectedIndex];
  const target = Number(result && result.target) || 0;
  const gap = target - selected.assets;
  const reachedIndex = findFirstIndex(years, (item) => target > 0 && item.assets >= target);
  const depletionIndex = findFirstIndex(years, (item) => item.assets <= 0);
  const positiveCashflowIndex = findFirstIndex(years, (item) => item.netInput >= 0);

  const cashflowCard =
    selected.netInput >= 0
      ? {
          label: "现金流状态",
          value: `每月可投 ${selected.netInputText}`,
          note: "现金流为正，路线主要受目标金额、资产估值和假设收益影响。",
        }
      : {
          label: "现金流状态",
          value: `每月缺口 ${yuan(Math.abs(selected.netInput))}`,
          note: "现金流为负，资产会先被支出消耗；这不是投资建议，只是现金流测算。",
        };

  let reachabilityCard;
  if (target > 0 && selected.assets >= target) {
    reachabilityCard = {
      label: "目标可达性",
      value: "该年已达到目标",
      note: `按当前假设，到第 ${selected.year} 年资产已覆盖目标。`,
    };
  } else if (reachedIndex >= 0) {
    reachabilityCard = {
      label: "目标可达性",
      value: `预计第 ${years[reachedIndex].year} 年达到`,
      note: `到第 ${selected.year} 年仍差 ${yuan(Math.max(gap, 0))}。`,
    };
  } else {
    reachabilityCard = {
      label: "目标可达性",
      value: "按当前假设暂不可达",
      note: `到第 ${selected.year} 年仍差 ${yuan(Math.max(gap, 0))}。先把记录补全，再看现金流是否能转正。`,
    };
  }

  let nodeCard;
  if (depletionIndex >= 0) {
    nodeCard = {
      label: "关键节点",
      value: `资产预计第 ${years[depletionIndex].year} 年耗尽`,
      note:
        selectedIndex >= depletionIndex
          ? "选中年份已经处在资产耗尽之后，后续路线需要先修正现金流假设。"
          : "在当前现金流和收益假设下，资产会先触及 0。",
    };
  } else if (positiveCashflowIndex >= 0) {
    nodeCard = {
      label: "关键节点",
      value: `现金流第 ${years[positiveCashflowIndex].year} 年转正`,
      note:
        positiveCashflowIndex === 0
          ? "现金流从当前年份开始为正。"
          : "工资增长等假设会让现金流在后续年份转正，仍需用真实记录校验。",
    };
  } else {
    nodeCard = {
      label: "关键节点",
      value: "未看到转正节点",
      note: "当前模拟范围内现金流未转正，也未触及资产耗尽点。",
    };
  }

  const trajectoryStart = Math.max(0, selectedIndex - 4);
  const trajectory = years.slice(trajectoryStart, selectedIndex + 1).map((item) => ({
    title: item.title,
    assetText: item.assetText,
    netInputText: item.netInputText,
  }));

  return {
    title: `${selected.title}路线诊断`,
    cards: [cashflowCard, reachabilityCard, nodeCard],
    trajectory,
  };
}

module.exports = {
  getRouteChart,
  getRouteYears,
  getSelectedRouteYear,
  getRouteDiagnostics,
};
