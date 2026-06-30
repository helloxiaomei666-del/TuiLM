const test = require('node:test');
const assert = require('node:assert/strict');

const { buildShareLines } = require('../js/share-card.js');

test('buildShareLines creates the V0.2 freedom progress card copy', () => {
  const lines = buildShareLines({
    freedomProgress: '40.0%',
    targetAssetProgress: '89.3%',
    assetMonthlyIncome: '¥2,200.00 / 月',
    wageDependency: '60.0%',
    stageLabel: '资产开始打工中',
    summaryText: '资产已经开始上班，但主力员工还是我自己。',
  });

  const text = lines.join('\n');

  for (const expected of [
    '测一测你的自由进度｜退了吗',
    '我的自由进度',
    '40.0%',
    '现在有 40.0% 的生活成本，不用完全靠工资来扛。',
    '资产开始打工中',
    '目标资产进度',
    '净资产占目标资产',
    '资产月收入',
    '工资依赖',
    '动态小结',
    '资产已经开始上班，但主力员工还是我自己。',
    '不是想躺平，只是想多一点选择生活的权利。',
    '不构成投资、理财、保险或退休决策建议',
    '你也可以测测自己的自由进度',
  ]) {
    assert.match(text, new RegExp(expected));
  }

  for (const forbidden of [
    '资产退休率',
    '资产工作力',
    '劳动依赖率',
    '预计退休年龄',
    '距离目标状态',
    '关闭',
    '保存 PNG',
    '分享预览',
    '已达到目标状态',
    '可以退休',
    '财务自由',
  ]) {
    assert.doesNotMatch(text, new RegExp(forbidden));
  }
});
