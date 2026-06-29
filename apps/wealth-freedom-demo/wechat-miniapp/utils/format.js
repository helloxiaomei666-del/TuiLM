function yuan(value, digits = 1) {
  const number = Number(value) || 0;
  const abs = Math.abs(number);
  if (abs >= 10000) {
    return `${(number / 10000).toFixed(digits)} 万`;
  }
  return `${Math.round(number).toLocaleString("zh-CN")} 元`;
}

function percent(value, digits = 1) {
  return `${(Number(value) || 0).toFixed(digits)}%`;
}

function futureDate(months, reached) {
  if (!reached) return "暂不可达";
  const date = new Date();
  date.setMonth(date.getMonth() + Math.max(0, Math.round(months)));
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
}

function ageText(age, months, reached) {
  if (!reached) return "需要重新设定目标";
  const totalMonths = Math.max(0, Math.round(months));
  const years = Math.floor(totalMonths / 12);
  const remainMonths = totalMonths % 12;
  const targetAge = Number(age) + years;
  return remainMonths ? `约 ${targetAge} 岁 ${remainMonths} 个月` : `约 ${targetAge} 岁`;
}

module.exports = {
  yuan,
  percent,
  futureDate,
  ageText,
};
