const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const cssPath = path.join(root, 'styles.css');
const readTextIfExists = (filePath) => (
  fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : ''
);
const html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, 'utf8') : '';
const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
const readme = readTextIfExists(path.join(root, 'README.md'));
const productNotes = readTextIfExists(path.join(root, 'docs', 'product-notes.md'));

function isRemoteResourceUrl(value) {
  return /^(?:https?:)?\/\//i.test(value.trim());
}

function findRemoteResourceUrls(source) {
  const remoteUrls = [];
  const resourceAttributePattern = /\b(src|href|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
  let match;

  while ((match = resourceAttributePattern.exec(source)) !== null) {
    const attribute = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? '';

    if (attribute === 'srcset') {
      for (const candidate of value.split(',')) {
        const url = candidate.trim().split(/\s+/)[0] ?? '';
        if (url && isRemoteResourceUrl(url)) {
          remoteUrls.push(url);
        }
      }
      continue;
    }

    if (isRemoteResourceUrl(value)) {
      remoteUrls.push(value.trim());
    }
  }

  return remoteUrls;
}

test('page shell files exist', () => {
  assert.equal(fs.existsSync(htmlPath), true, 'index.html must exist');
  assert.equal(fs.existsSync(cssPath), true, 'styles.css must exist');
});

test('README documents local usage and project isolation boundaries', () => {
  assert.match(readme, /现有《退了吗》\s*\/\s*wealth-freedom-demo 项目未被修改/);
  assert.match(readme, /python -m http\.server 4173/);
  assert.match(readme, /http:\/\/127\.0\.0\.1:4173/);
  assert.match(readme, /node --test tests\/\*\.test\.js/);
  assert.match(readme, /当前净资产 = 总资产 - 总负债/);
  assert.match(readme, /房产估值/);
  assert.match(readme, /剩余房贷/);
  assert.match(readme, /目标资产进度只是辅助观察/);
  assert.match(readme, /现金流覆盖也不代表可以立即辞职/);
  assert.match(readme, /Canvas/);
});

test('product notes document core retirement estimate caveats', () => {
  assert.match(productNotes, /4%/);
  assert.match(productNotes, /零收益保守模型/);
  assert.match(productNotes, /尚未领取的养老金不计入当前被动收入/);
  assert.match(productNotes, /目标资产进度/);
  assert.match(productNotes, /资产模型达标不等于现金流覆盖/);
  assert.match(productNotes, /数据只保存在当前浏览器/);
  assert.doesNotMatch(productNotes, /房产净值|资产退休率|资产工作力|劳动依赖率|已达到目标状态/);
});

test('page exposes the required application views', () => {
  for (const id of ['landing-view', 'form-view', 'report-view', 'poster-view']) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  }
});

test('page is packaged as a WeChat-style freedom progress H5 entry', () => {
  for (const required of [
    '测一测你的自由进度',
    '看看你现在有多少生活成本',
    '已经不用完全靠工资来扛',
    '30 秒开始',
    '不登录',
    '不上传',
    '本地生成结果',
    '开始测一测',
    '继续上次测算',
    '本测算仅用于个人财务观察，不构成投资、理财、保险或退休决策建议。',
  ]) {
    assert.match(html, new RegExp(required), `missing H5 landing copy: ${required}`);
  }

  assert.match(html, /id=["']continue-test["'][^>]*hidden/);
});

test('single-page shell exposes landing form result and poster states', () => {
  assert.match(html, /\bdata-app-view=["']landing["']/);
  assert.match(html, /\bdata-app-view=["']form["']/);
  assert.match(html, /\bdata-app-view=["']result["']/);
  assert.match(html, /\bdata-app-view=["']poster["']/);
});

test('form contains exactly five numbered steps', () => {
  const steps = [...html.matchAll(/<fieldset\b[^>]*\bdata-step=["'](\d+)["'][^>]*>/gi)]
    .map((match) => match[1]);

  assert.deepEqual(steps, ['1', '2', '3', '4', '5']);
});

test('form uses guided freedom report copy for all five steps', () => {
  for (const required of [
    '生成你的自由进度报告',
    '设定你的生活目标',
    '盘点你已经拥有的资产',
    '扣除你仍要偿还的负债',
    '看看你每月能留下多少钱',
    '计算资产每月替你赚多少钱',
    '这一页会影响什么',
    '目标退休资产',
    '当前总资产',
    '净资产 = 总资产 - 总负债',
    '生成我的自由进度报告',
    '继续填写资产',
    '继续填写负债',
    '继续填写收支',
    '继续填写资产收入',
    '仅用于记录测算背景，当前不会联网获取城市数据',
    '数据仅保存在当前浏览器，不会上传',
  ]) {
    assert.match(html, new RegExp(required), `missing guided copy: ${required}`);
  }

  for (const forbidden of [
    '填写你的退休进度信息',
    '房产净值',
    '攒钱进度',
    '已达到目标状态',
    '可以退休',
    '财务自由',
  ]) {
    assert.doesNotMatch(html, new RegExp(forbidden), `forbidden copy still present: ${forbidden}`);
  }
});

test('form exposes desktop stepper labels and mobile next-step context', () => {
  assert.match(html, /\bid=["']stepper["']/);
  for (const label of ['生活目标', '资产', '负债', '收支', '被动收入']) {
    assert.match(html, new RegExp(label), `missing stepper label: ${label}`);
  }
  assert.match(html, /\bid=["']next-step-label["']/);
  assert.match(html, /下一步：资产/);
});

test('form contains every required named input', () => {
  const names = [
    'age', 'city', 'desiredRetirementAge', 'currentMonthlyCost', 'targetMonthlyCost',
    'cash', 'funds', 'stocks', 'gold', 'propertyValue', 'otherAssets',
    'mortgageBalance', 'carLoan', 'consumerLoan', 'otherDebt',
    'monthlySalary', 'monthlySideIncome', 'monthlyLivingExpense',
    'monthlyFixedExpense', 'monthlyDebtPayment',
  ];

  for (const name of names) {
    assert.match(
      html,
      new RegExp(`<input\\b[^>]*\\bname=["']${name}["'][^>]*>`, 'i'),
      `missing input[name="${name}"]`,
    );
  }
});

test('page uses V0.2 property value and mortgage balance wording', () => {
  assert.match(html, /房产估值/);
  assert.match(html, /剩余房贷/);
  assert.match(html, /不要在这里扣除房贷/);
  assert.doesNotMatch(html, /房产净值/);
  assert.doesNotMatch(html, /\bname=["']propertyEquity["']/);
  assert.doesNotMatch(html, /\bname=["']mortgage["']/);
});

test('each passive income row has amount and frequency controls', () => {
  const passiveItems = [
    'dividends', 'rent', 'interest', 'reits', 'pension', 'annuity',
    'royalties', 'otherPassive', 'semiPassive',
  ];

  for (const item of passiveItems) {
    const amountInput = html.match(
      new RegExp(`<input\\b[^>]*\\bname=["']${item}["'][^>]*>`, 'i'),
    );
    assert.ok(amountInput, `missing ${item} amount input`);

    const describedBy = amountInput[0].match(/\baria-describedby=["']([^"']+)["']/i);
    assert.ok(describedBy, `${item} amount input must describe an inline error`);
    const errorId = describedBy[1].split(/\s+/)[0];
    assert.match(
      html,
      new RegExp(`<span\\b(?=[^>]*\\bid=["']${errorId}["'])(?=[^>]*\\bclass=["'][^"']*\\bfield-error\\b[^"']*["'])[^>]*>`, 'i'),
      `${item} must reference a .field-error span`,
    );

    const select = html.match(
      new RegExp(`<select\\b[^>]*\\bname=["']${item}Frequency["'][^>]*>([\\s\\S]*?)<\\/select>`, 'i'),
    );
    assert.ok(select, `missing ${item} frequency select`);

    for (const frequency of ['month', 'quarter', 'year', 'irregular']) {
      assert.match(
        select[1],
        new RegExp(`<option\\b[^>]*\\bvalue=["']${frequency}["']`, 'i'),
        `${item} must support ${frequency}`,
      );
    }
  }
});

test('page includes the complete short disclosure', () => {
  assert.match(html, /本工具仅用于个人财务状态测算和自我观察/);
  assert.match(html, /不构成投资建议、理财建议、保险建议或退休决策建议/);
});

test('remote resource scanner detects unquoted and srcset resource URLs', () => {
  const source = [
    '<script src=//cdn.example/app.js></script>',
    '<img srcset="//cdn.example/a.png 1x, /local.png 2x">',
    '<link href="https://cdn.example/style.css">',
    "<img src='http://cdn.example/a.png'>",
  ].join('\n');

  assert.deepEqual(findRemoteResourceUrls(source), [
    '//cdn.example/app.js',
    '//cdn.example/a.png',
    'https://cdn.example/style.css',
    'http://cdn.example/a.png',
  ]);
});

test('remote resource scanner allows local resource paths', () => {
  const source = [
    '<script src="js/app.js"></script>',
    '<link href=styles.css>',
    '<img srcset="/local.png 1x, ./x.png 2x">',
  ].join('\n');

  assert.deepEqual(findRemoteResourceUrls(source), []);
});

test('page does not load remote resources', () => {
  const remoteHtmlResources = findRemoteResourceUrls(html);

  assert.deepEqual(
    remoteHtmlResources,
    [],
    `remote HTML resource URL found: ${remoteHtmlResources.join(', ')}`,
  );
  assert.doesNotMatch(css, /https?:\/\//i, 'CSS http(s) resource URL found');
  assert.doesNotMatch(css, /@import\b/i, 'CSS @import is not allowed');
  assert.doesNotMatch(
    css,
    /url\(\s*["']?\s*(?:https?:)?\/\//i,
    'remote or protocol-relative url() found',
  );
});

test('share canvas exposes an updatable text equivalent', () => {
  const canvas = html.match(
    /<canvas\b(?=[^>]*\bid=["']share-canvas["'])[^>]*>/i,
  );
  assert.ok(canvas, 'missing #share-canvas');
  assert.match(
    canvas[0],
    /\baria-describedby=["'][^"']*\bshare-summary\b[^"']*["']/i,
  );

  const summary = html.match(
    /<([a-z][\w-]*)\b(?=[^>]*\bid=["']share-summary["'])(?=[^>]*\baria-live=["'](?:polite|assertive)["'])[^>]*>([\s\S]*?)<\/\1>/i,
  );
  assert.ok(summary, 'missing live #share-summary text equivalent');
  assert.match(summary[2].replace(/<[^>]+>/g, ''), /\S/, 'share summary must not be empty');
});

test('report exposes required output hooks and CTA copy', () => {
  const requiredOutputIds = [
    'result-summary-title',
    'cashflow-rate',
    'retirement-stage',
    'result-summary-main',
    'asset-rate',
    'asset-work-power',
    'labor-rate',
    'safety-months',
    'estimated-age',
    'countdown-days',
    'accelerator-list',
  ];
  const idMatches = [...html.matchAll(/\bid=["']([^"']+)["']/gi)]
    .map((match) => match[1]);

  for (const id of requiredOutputIds) {
    assert.equal(
      idMatches.filter((candidate) => candidate === id).length,
      1,
      `#${id} must exist exactly once`,
    );
  }

  const idPositions = requiredOutputIds.map((id) => html.indexOf(`id="${id}"`));
  for (let index = 1; index < idPositions.length; index += 1) {
    assert.ok(
      idPositions[index] > idPositions[index - 1],
      `#${requiredOutputIds[index]} must appear after #${requiredOutputIds[index - 1]}`,
    );
  }

  assert.match(html, /我的自由进度/);
  assert.match(html, /测算完成/);
  assert.match(html, /现在有 <span id="result-summary-rate-inline">/);
  assert.match(html, /保存自由进度卡/);
  assert.match(html, /重新测算/);
  assert.match(html, /返回首页/);
  assert.doesNotMatch(html, /导出 PNG|生成 Canvas|保存 PNG/);
});

test('result hero is a warm freedom progress card instead of an internal report', () => {
  const summaryCard = html.match(/<section class="result-summary-card[\s\S]*?<\/section>/);
  assert.ok(summaryCard, 'missing result summary card');
  assert.match(summaryCard[0], /测算完成/);
  assert.match(summaryCard[0], /<h3 id="result-summary-title">我的自由进度<\/h3>/);
  assert.match(summaryCard[0], /<p id="cashflow-rate" class="result-summary-percent">—<\/p>/);
  assert.match(summaryCard[0], /<p id="retirement-stage" class="metric-status result-summary-stage">等待生成结果<\/p>/);
  assert.match(summaryCard[0], /<p id="result-summary-main" class="result-summary-detail">/);
  assert.match(summaryCard[0], /<button id="open-poster-view" class="button button--primary result-summary-action" type="button">保存自由进度卡<\/button>/);
  assert.doesNotMatch(summaryCard[0], /现金流退休率\s*\/\s*自由进度/);

  const indicatorGridIndex = html.indexOf('result-metrics-grid');
  assert.ok(indicatorGridIndex > html.indexOf('class="result-summary-card'), 'auxiliary metrics should sit below the hero card');
  assert.match(html, /净资产占目标资产/);
  assert.match(html, /每月被动 \/ 半被动收入/);
  assert.match(html, /仍需工资覆盖生活成本/);
});

test('result stylesheet uses share-card visual language for the hero', () => {
  assert.match(css, /\.result-summary-card[\s\S]*background:\s*linear-gradient\([^;]*(#fffaf6|#fbf4ed)/);
  assert.match(css, /\.result-summary-card[\s\S]*box-shadow:\s*0 18px 48px rgba\(116, 89, 74, 0\.12\)/);
  assert.match(css, /\.result-summary-percent\b/);
  assert.match(css, /\.result-metrics-grid\b/);
  assert.match(css, /\.metric-card--featured[\s\S]*background:\s*linear-gradient\([^;]*(#fffaf6|#fbf4ed)/);
  assert.doesNotMatch(css, /#cad8fa/);
});

test('poster preview gives mobile-friendly image saving guidance', () => {
  assert.match(html, /保存自由进度卡/);
  assert.match(html, /保存图片/);
  assert.match(html, /复制分享文案/);
  assert.match(html, /返回结果页/);
  assert.match(html, /长按图片保存到相册/);
  assert.match(html, /如果无法自动保存，请长按图片保存/);
  assert.match(html, /图片仅在当前设备生成，不会上传/);
});

test('poster is an independent page view instead of a modal dialog', () => {
  assert.match(
    html,
    /<section\b(?=[^>]*\bid=["']poster-view["'])(?=[^>]*\bdata-app-view=["']poster["'])[\s\S]*?<\/section>/,
  );
  assert.doesNotMatch(html, /<dialog\b/);
  assert.doesNotMatch(html, /id=["']share-dialog["']/);
  assert.doesNotMatch(html, /id=["']close-share-dialog["']/);
  assert.doesNotMatch(html, /aria-label=["']关闭分享预览["']/);
  assert.doesNotMatch(html, /class=["'][^"']*\bicon-button\b/);
});

test('poster page hides share copy until the copy action is requested', () => {
  assert.match(html, /id=["']copy-share-copy["']/);
  assert.match(html, /id=["']share-copy-feedback["']/);
  assert.match(html, /id=["']manual-share-copy["'][^>]*hidden/);
  assert.doesNotMatch(html, /<p[^>]*>[\s\S]*我的自由进度是[\s\S]*<\/p>/);
});

test('report page uses V0.2 user-facing metric wording and explanations', () => {
  for (const required of [
    '自由进度',
    '目标资产进度',
    '净资产占目标资产',
    '资产月收入',
    '每月被动 / 半被动收入',
    '工资依赖',
    '仍需工资覆盖生活成本',
    '安全垫月数',
    '这些指标怎么算',
    '当前净资产 = 总资产 - 总负债',
    '总资产包括现金、基金、股票、黄金、房产估值和其他资产',
    '总负债包括剩余房贷、车贷、消费贷和其他负债',
    '年生活成本约 25 倍',
    '本结果仅用于个人财务观察，不构成投资、理财、保险或退休决策建议。',
  ]) {
    assert.match(html, new RegExp(required));
  }

  for (const forbidden of [
    '房产净值',
    '已达到目标状态',
    '可以退休',
    '财务自由',
  ]) {
    assert.doesNotMatch(html, new RegExp(forbidden));
  }
});

test('page explains local-only storage and exposes result data clearing', () => {
  assert.match(html, /数据仅保存在当前浏览器，不会上传/);
  assert.match(html, /公共设备/);
  assert.match(html, /清空本地数据/);
  assert.match(
    html,
    /<button\b(?=[^>]*\bid=["']clear-result-data["'])[^>]*>清空本次数据<\/button>/,
  );
});

test('stylesheet contains accessibility and responsive foundations', () => {
  assert.match(css, /:root\s*\{/);
  assert.match(css, /min-height\s*:\s*44px/);
  assert.match(css, /@media\s*\(\s*max-width\s*:\s*640px\s*\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.result-summary-card\b/);
  assert.match(css, /\.formula-explainer\b/);
  assert.match(css, /\.poster-view\b/);
  assert.match(css, /\.poster-actions\b/);
  assert.match(css, /\.toast\b/);
  assert.match(css, /overflow-x\s*:\s*hidden/);
  assert.match(css, /font-size\s*:\s*16px/);
  assert.match(css, /max-width\s*:\s*100%/);
  assert.match(css, /100dvh|100svh/);
});

test('focus outline uses a dedicated high-contrast color token', () => {
  const token = css.match(/--color-focus\s*:\s*(#[0-9a-f]{6})/i);
  assert.ok(token, 'missing --color-focus token');

  const channels = token[1]
    .slice(1)
    .match(/.{2}/g)
    .map((pair) => Number.parseInt(pair, 16) / 255)
    .map((channel) => (
      channel <= 0.03928
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4
    ));
  const luminance = (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
  const contrastOnWhite = 1.05 / (luminance + 0.05);
  assert.ok(contrastOnWhite >= 3, `focus color contrast is only ${contrastOnWhite.toFixed(2)}:1`);

  const focusRule = css.match(/:focus-visible\s*\{([\s\S]*?)\}/);
  assert.ok(focusRule, 'missing :focus-visible rule');
  assert.match(focusRule[1], /outline(?:-color)?\s*:[^;]*var\(--color-focus\)/);
});

test('stylesheet defines a reusable spacing scale', () => {
  for (let index = 1; index <= 6; index += 1) {
    assert.match(css, new RegExp(`--space-${index}\\s*:`), `missing --space-${index}`);
  }
});

test('page base uses the warm share-card visual palette', () => {
  const bodyRule = css.match(/body\s*\{([\s\S]*?)\}/);
  assert.ok(bodyRule, 'missing body rule');
  assert.match(
    bodyRule[1],
    /background\s*:\s*(?:#F8F3EA|var\(--color-bg\))/i,
  );
  for (const token of ['#F8F3EA', '#FAF7F2', '#2F2A26', '#8B8078', '#9F7A70', '#E4D8CD']) {
    assert.match(css, new RegExp(token, 'i'), `missing warm token ${token}`);
  }
  assert.match(css, /--radius-small\s*:\s*14px/);
  assert.match(css, /--radius-large\s*:\s*24px/);
  assert.match(css, /\.stepper\b/);
  assert.match(css, /\.impact-card\b/);
  assert.match(css, /\.live-summary--card\b/);
});
