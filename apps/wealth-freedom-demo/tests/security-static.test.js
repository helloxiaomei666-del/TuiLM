const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const scanTargets = [
  "README.md",
  "docs",
  "quote-service",
  "scripts",
  "tests",
  path.join("wechat-miniapp", "app.js"),
  path.join("wechat-miniapp", "app.json"),
  path.join("wechat-miniapp", "app.wxss"),
  path.join("wechat-miniapp", "pages"),
  path.join("wechat-miniapp", "utils"),
];

const ignoredNames = new Set([
  ".git",
  ".runtime",
  "node_modules",
  "project.config.json",
  "project.private.config.json",
]);

const textExtensions = new Set([
  ".js",
  ".json",
  ".md",
  ".ps1",
  ".wxml",
  ".wxss",
]);

const allowedPlaceholderValues = new Set([
  "redacted-provider-value",
  "<real-appid>",
  "<your-appid>",
  "wx_your_appid_here",
]);

function collectTextFiles(target) {
  const absolute = path.join(repoRoot, target);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) {
    return textExtensions.has(path.extname(absolute)) ? [absolute] : [];
  }

  const files = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (ignoredNames.has(entry.name)) continue;
    const child = path.join(absolute, entry.name);
    if (entry.isDirectory()) files.push(...collectTextFiles(path.relative(repoRoot, child)));
    else if (entry.isFile() && textExtensions.has(path.extname(child))) files.push(child);
  }
  return files;
}

function getLineNumber(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function findSecretLikeValues(file, text) {
  const findings = [];
  const directPatterns = [
    ["private key block", /-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----/g],
    ["OpenAI-style key", /sk-[A-Za-z0-9_-]{20,}/g],
    ["AWS access key", /AKIA[0-9A-Z]{16}/g],
    ["GitHub token", /ghp_[A-Za-z0-9]{36}/g],
    ["Slack token", /xox[baprs]-[A-Za-z0-9-]{20,}/g],
  ];

  for (const [label, regex] of directPatterns) {
    for (const match of text.matchAll(regex)) {
      findings.push({
        file,
        line: getLineNumber(text, match.index || 0),
        label,
      });
    }
  }

  const assignmentPattern = /(?:api[_-]?key|access[_-]?token|secret)\s*[:=]\s*["']([^"']{8,})["']/gi;
  for (const match of text.matchAll(assignmentPattern)) {
    const value = match[1];
    if (allowedPlaceholderValues.has(value)) continue;
    findings.push({
      file,
      line: getLineNumber(text, match.index || 0),
      label: "secret assignment",
    });
  }

  return findings;
}

test("repository docs and quote service do not contain provider secrets", () => {
  const files = Array.from(new Set(scanTargets.flatMap(collectTextFiles))).sort();
  const findings = files.flatMap((file) => findSecretLikeValues(file, fs.readFileSync(file, "utf8")));

  assert.deepEqual(
    findings.map((finding) => ({
      file: path.relative(repoRoot, finding.file),
      line: finding.line,
      label: finding.label,
    })),
    [],
  );
});
