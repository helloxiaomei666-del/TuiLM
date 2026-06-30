(function (root, factory) {
  const shareCard = factory();

  root.RetirementShareCard = shareCard;

  if (typeof module === 'object' && module.exports) {
    module.exports = shareCard;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const CARD_WIDTH = 1080;
  const CARD_HEIGHT = 1600;
  const DEFAULT_FILENAME = '我的自由进度卡.png';

  function safeText(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    return String(value);
  }

  function buildShareLines(data) {
    const source = data || {};
    const freedomProgress = safeText(
      source.freedomProgress || source.cashflowRetirementRate,
      '暂无法计算'
    );
    const targetAssetProgress = safeText(
      source.targetAssetProgress || source.assetRetirementRate,
      '暂无法计算'
    );
    const assetMonthlyIncome = safeText(
      source.assetMonthlyIncome || source.assetWorkPower,
      '暂无法计算'
    );
    const wageDependency = safeText(
      source.wageDependency || source.laborDependencyRate,
      '暂无法计算'
    );
    const stageLabel = safeText(source.stageLabel, '等待测算');
    const summaryText = safeText(source.summaryText, '填写数据后生成你的自由进度小结。');

    return [
      '测一测你的自由进度｜退了吗',
      '我的自由进度',
      freedomProgress,
      `现在有 ${freedomProgress} 的生活成本，不用完全靠工资来扛。`,
      stageLabel,
      '目标资产进度',
      '净资产占目标资产',
      targetAssetProgress,
      '资产月收入',
      '每月被动 / 半被动收入',
      assetMonthlyIncome,
      '工资依赖',
      '仍需工资覆盖生活成本',
      wageDependency,
      '动态小结',
      summaryText,
      '不是想躺平，只是想多一点选择生活的权利。',
      '本结果仅用于个人财务观察，不构成投资、理财、保险或退休决策建议。',
      '你也可以测测自己的自由进度',
    ];
  }

  function wrapText(context, text, maxWidth) {
    const characters = String(text).split('');
    const lines = [];
    let line = '';

    characters.forEach(function (character) {
      const candidate = `${line}${character}`;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = character;
      } else {
        line = candidate;
      }
    });

    if (line) lines.push(line);
    return lines;
  }

  function drawWrappedText(context, text, x, y, maxWidth, lineHeight) {
    const lines = wrapText(context, text, maxWidth);
    lines.forEach(function (line, index) {
      context.fillText(line, x, y + index * lineHeight);
    });
    return y + lines.length * lineHeight;
  }

  function drawRoundRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function drawMetricCard(context, x, y, width, title, subtitle, value) {
    context.save();
    context.shadowColor = 'rgba(116, 89, 74, 0.12)';
    context.shadowBlur = 22;
    context.shadowOffsetY = 10;
    context.fillStyle = '#fffaf6';
    drawRoundRect(context, x, y, width, 160, 28);
    context.fill();
    context.restore();

    context.fillStyle = '#7a6f68';
    context.font = '400 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    context.fillText(title, x + 32, y + 44);

    context.fillStyle = '#a18f84';
    context.font = '400 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    context.fillText(subtitle, x + 32, y + 78);

    context.fillStyle = '#2f2925';
    context.font = '700 34px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    context.fillText(value, x + 32, y + 126);
  }

  function parsePercent(text) {
    const matched = String(text).match(/-?\d+(?:\.\d+)?/);
    if (!matched) return 0;
    const value = Number(matched[0]) / 100;
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  }

  function drawShareCard(canvas, data) {
    if (!canvas || typeof canvas.getContext !== 'function') return null;

    const context = canvas.getContext('2d');
    if (!context) return null;

    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;

    const lines = buildShareLines(data);
    const margin = 78;
    const contentWidth = CARD_WIDTH - margin * 2;
    const progressRate = parsePercent(lines[2]);

    const gradient = context.createLinearGradient(0, 0, 0, CARD_HEIGHT);
    gradient.addColorStop(0, '#fbf5ee');
    gradient.addColorStop(1, '#f3ebe2');
    context.fillStyle = gradient;
    context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    context.fillStyle = 'rgba(207, 160, 135, 0.22)';
    context.beginPath();
    context.arc(880, 150, 180, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(189, 147, 127, 0.14)';
    context.beginPath();
    context.arc(130, 1330, 230, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = '#7a6f68';
    context.font = '500 26px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    context.fillText(lines[0], margin, 94);

    context.fillStyle = '#2f2925';
    context.font = '700 54px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    context.fillText(lines[1], margin, 185);

    const centerX = CARD_WIDTH / 2;
    const centerY = 390;
    context.lineWidth = 28;
    context.strokeStyle = '#eadbd0';
    context.beginPath();
    context.arc(centerX, centerY, 150, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = '#b97860';
    context.lineCap = 'round';
    context.beginPath();
    context.arc(
      centerX,
      centerY,
      150,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * progressRate
    );
    context.stroke();

    context.fillStyle = '#2f2925';
    context.font = '800 86px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    context.textAlign = 'center';
    context.fillText(lines[2], centerX, centerY + 18);
    context.textAlign = 'left';

    context.fillStyle = '#6f625a';
    context.font = '400 31px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    drawWrappedText(context, lines[3], margin, 620, contentWidth, 48);

    context.fillStyle = '#b97860';
    drawRoundRect(context, margin, 705, 320, 56, 28);
    context.fill();
    context.fillStyle = '#fffaf6';
    context.font = '600 27px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    context.fillText(lines[4], margin + 30, 742);

    const cardWidth = (contentWidth - 32) / 3;
    drawMetricCard(context, margin, 820, cardWidth, lines[5], lines[6], lines[7]);
    drawMetricCard(context, margin + cardWidth + 16, 820, cardWidth, lines[8], lines[9], lines[10]);
    drawMetricCard(context, margin + (cardWidth + 16) * 2, 820, cardWidth, lines[11], lines[12], lines[13]);

    context.save();
    context.fillStyle = '#fffaf6';
    drawRoundRect(context, margin, 1050, contentWidth, 210, 34);
    context.fill();
    context.restore();

    context.fillStyle = '#b97860';
    context.font = '700 30px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    context.fillText(lines[14], margin + 34, 1102);
    context.fillStyle = '#3d342f';
    context.font = '500 35px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    drawWrappedText(context, lines[15], margin + 34, 1160, contentWidth - 68, 48);

    context.fillStyle = '#2f2925';
    context.font = '600 34px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    drawWrappedText(context, lines[16], margin, 1330, contentWidth, 50);

    context.fillStyle = '#7a6f68';
    context.font = '400 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    drawWrappedText(context, lines[17], margin, 1450, contentWidth, 36);

    context.fillStyle = '#b97860';
    context.font = '500 27px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    context.fillText(lines[18], margin, 1545);

    return lines;
  }

  function downloadShareCard(canvas, filename) {
    if (!canvas || typeof canvas.toDataURL !== 'function') return false;

    const doc = canvas.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc || typeof doc.createElement !== 'function') return false;

    const link = doc.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = filename || DEFAULT_FILENAME;
    link.style.display = 'none';

    const parent = doc.body || doc.documentElement;
    if (parent && typeof parent.appendChild === 'function') {
      parent.appendChild(link);
    }
    if (typeof link.click === 'function') {
      link.click();
    }
    if (link.parentNode && typeof link.parentNode.removeChild === 'function') {
      link.parentNode.removeChild(link);
    }

    return true;
  }

  return {
    buildShareLines,
    drawShareCard,
    downloadShareCard,
  };
});
