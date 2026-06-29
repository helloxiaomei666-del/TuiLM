const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const miniRoot = path.join(repoRoot, "wechat-miniapp");
const errors = [];
const warnings = [];

function rel(file) {
  return path.relative(repoRoot, file).replace(/\\/g, "/");
}

function read(file) {
  return fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
}

function exists(file, message) {
  if (!fs.existsSync(file)) {
    errors.push(message || `${rel(file)} is missing`);
    return false;
  }
  return true;
}

function parseJson(file) {
  try {
    return JSON.parse(read(file));
  } catch (error) {
    errors.push(`${rel(file)} is invalid JSON: ${error.message}`);
    return null;
  }
}

function walk(dir, predicate = () => true) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(file, predicate);
    return predicate(file) ? [file] : [];
  });
}

function checkPageFiles(pagePath) {
  ["js", "json", "wxml", "wxss"].forEach((ext) => {
    exists(path.join(miniRoot, `${pagePath}.${ext}`), `${pagePath}.${ext} is missing`);
  });
}

function checkComponentRef(ownerFile, componentPath) {
  if (!componentPath.startsWith("/")) {
    errors.push(`${rel(ownerFile)} uses non-root component path ${componentPath}`);
    return;
  }
  const componentBase = path.join(miniRoot, componentPath.slice(1));
  ["js", "json", "wxml", "wxss"].forEach((ext) => {
    exists(`${componentBase}.${ext}`, `${componentPath}.${ext} referenced by ${rel(ownerFile)} is missing`);
  });
}

function checkRequireRefs(file) {
  const source = read(file);
  const matches = source.matchAll(/require\(["']([^"']+)["']\)/g);
  for (const match of matches) {
    const specifier = match[1];
    if (!specifier.startsWith(".")) continue;
    const resolvedBase = path.resolve(path.dirname(file), specifier);
    if (!fs.existsSync(resolvedBase) && !fs.existsSync(`${resolvedBase}.js`)) {
      errors.push(`${rel(file)} requires missing module ${specifier}`);
    }
  }
}

function checkNoNetworkCalls(files) {
  const networkPatterns = [
    /\bwx\.request\s*\(/,
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\bnavigator\.sendBeacon\b/,
  ];
  files.forEach((file) => {
    const source = read(file);
    const relativeFile = rel(file);
    networkPatterns.forEach((pattern) => {
      if (pattern.test(source)) {
        const isAllowedQuoteClientRequest =
          relativeFile === "wechat-miniapp/utils/quote-client.js" && String(pattern) === String(/\bwx\.request\s*\(/) && source.includes("/api/quotes");
        if (!isAllowedQuoteClientRequest) {
          errors.push(`${relativeFile} contains network call pattern ${pattern}`);
        }
      }
    });
  });
}

function checkNoHardcodedSecrets(files) {
  const secretPatterns = [
    /api[_-]?key\s*[:=]\s*["'][^"']+/i,
    /access[_-]?token\s*[:=]\s*["'][^"']+/i,
    /secret\s*[:=]\s*["'][^"']+/i,
  ];
  files.forEach((file) => {
    const source = read(file);
    secretPatterns.forEach((pattern) => {
      if (pattern.test(source)) {
        errors.push(`${rel(file)} appears to contain a hardcoded secret pattern ${pattern}`);
      }
    });
  });
}

function checkMiniappJsCompatibility(files) {
  const riskyPatterns = [
    { pattern: /\?\./, label: "optional chaining" },
    { pattern: /\?\?/, label: "nullish coalescing" },
  ];
  files.forEach((file) => {
    const source = read(file);
    riskyPatterns.forEach(({ pattern, label }) => {
      if (pattern.test(source)) {
        errors.push(`${rel(file)} contains ${label}; use conservative ES6 syntax for miniapp compatibility`);
      }
    });
  });
}

function checkMiniappCssCompatibility(files) {
  const riskyPatterns = [
    /display\s*:\s*grid/,
    /grid-template/,
    /::before/,
    /::after/,
    /conic-gradient/,
    /radial-gradient/,
    /var\(/,
  ];
  files.forEach((file) => {
    const source = read(file);
    riskyPatterns.forEach((pattern) => {
      if (pattern.test(source)) {
        errors.push(`${rel(file)} contains risky WXSS pattern ${pattern}`);
      }
    });
  });
}

function checkAssetPageWxssSelectors() {
  const file = path.join(miniRoot, "pages/assets/assets.wxss");
  if (!exists(file, "pages/assets/assets.wxss is missing")) return;

  const disallowedSelectorPatterns = [
    /:(first-child|last-child|nth-child|nth-of-type|first-of-type|last-of-type)/,
    /(^|[\s,>+~])(view|text|button|input|label|picker)(?=[\s.#:{])/,
  ];
  read(file)
    .split(/\r?\n/)
    .forEach((line, index) => {
      const selectorPart = line.split("{")[0];
      if (!line.includes("{")) return;
      disallowedSelectorPatterns.forEach((pattern) => {
        if (pattern.test(selectorPart)) {
          errors.push(`${rel(file)}:${index + 1} uses a selector unsupported by WeChat WXSS: ${selectorPart.trim()}`);
        }
      });
    });
}

function checkWxmlBindings(files) {
  const arithmeticBinding = /\{\{[^}]*[+\-*/()][^}]*\}\}/;
  files.forEach((file) => {
    const source = read(file);
    source.split(/\r?\n/).forEach((line, index) => {
      if (arithmeticBinding.test(line) && !/[=!]==|!==|&&|\|\|/.test(line)) {
        errors.push(`${rel(file)}:${index + 1} contains arithmetic binding; precompute it in JS instead`);
      }
    });
  });
}

function readPngSize(file) {
  const buffer = fs.readFileSync(file);
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") {
    errors.push(`${rel(file)} is not a PNG file`);
    return null;
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function checkTabIcon(file) {
  if (!exists(file, `tab icon ${rel(file)} is missing`)) return;
  const size = readPngSize(file);
  if (!size) return;
  if (size.width < 40 || size.height < 40) {
    errors.push(`${rel(file)} is too small for a tab icon: ${size.width}x${size.height}`);
  }
  if (size.width > 120 || size.height > 120) {
    warnings.push(`${rel(file)} is larger than typical miniapp tab icons: ${size.width}x${size.height}`);
  }
}

function checkLegalBoundary() {
  const appConfig = parseJson(path.join(miniRoot, "app.json"));
  if (!appConfig) return;

  if (!appConfig.pages.includes("pages/legal/legal")) {
    errors.push("pages/legal/legal must be registered in app.json");
  }

  const overviewWxml = path.join(miniRoot, "pages/overview/overview.wxml");
  const overviewJs = path.join(miniRoot, "pages/overview/overview.js");
  const legalJs = path.join(miniRoot, "pages/legal/legal.js");
  if (exists(overviewWxml) && !read(overviewWxml).includes("隐私与免责声明")) {
    errors.push("overview page must expose privacy and disclaimer entry text");
  }
  if (exists(overviewJs) && !read(overviewJs).includes("/pages/legal/legal")) {
    errors.push("overview page must navigate to /pages/legal/legal");
  }
  if (exists(legalJs)) {
    const legal = read(legalJs);
    ["不构成投资建议", "不承诺收益", "未确认结果不得持久化"].forEach((text) => {
      if (!legal.includes(text)) {
        errors.push(`legal page is missing boundary copy: ${text}`);
      }
    });
  }
}

function main() {
  if (!exists(miniRoot, "wechat-miniapp directory is missing")) return;

  const appConfig = parseJson(path.join(miniRoot, "app.json"));
  if (!appConfig) return;

  if (!Array.isArray(appConfig.pages) || !appConfig.pages.length) {
    errors.push("app.json must declare pages");
  } else {
    appConfig.pages.forEach(checkPageFiles);
  }

  const tabItems = appConfig.tabBar?.list || [];
  if (tabItems.length !== 5) {
    errors.push(`tabBar should expose 5 MVP tabs, found ${tabItems.length}`);
  }
  tabItems.forEach((item) => {
    if (!appConfig.pages.includes(item.pagePath)) {
      errors.push(`tab page ${item.pagePath} is not registered in app.json pages`);
    }
    ["iconPath", "selectedIconPath"].forEach((key) => {
      if (!item[key]) {
        errors.push(`tab page ${item.pagePath} is missing ${key}`);
        return;
      }
      checkTabIcon(path.join(miniRoot, item[key]));
    });
  });

  const jsonFiles = walk(miniRoot, (file) => file.endsWith(".json"));
  jsonFiles.forEach(parseJson);
  jsonFiles.forEach((file) => {
    const config = parseJson(file);
    const usingComponents = config?.usingComponents || {};
    Object.values(usingComponents).forEach((componentPath) => checkComponentRef(file, componentPath));
  });

  const jsFiles = walk(miniRoot, (file) => file.endsWith(".js"));
  const wxssFiles = walk(miniRoot, (file) => file.endsWith(".wxss"));
  const wxmlFiles = walk(miniRoot, (file) => file.endsWith(".wxml"));
  jsFiles.forEach(checkRequireRefs);
  checkNoNetworkCalls(jsFiles);
  checkNoHardcodedSecrets(jsFiles);
  checkMiniappJsCompatibility(jsFiles);
  checkMiniappCssCompatibility(wxssFiles);
  checkAssetPageWxssSelectors();
  checkWxmlBindings(wxmlFiles);
  checkLegalBoundary();

  const projectConfig = parseJson(path.join(miniRoot, "project.config.json"));
  const privateConfigPath = path.join(miniRoot, "project.private.config.json");
  const privateConfig = fs.existsSync(privateConfigPath) ? parseJson(privateConfigPath) : null;
  const hasPrivateAppId = privateConfig?.appid && privateConfig.appid !== "touristappid";
  if (projectConfig?.appid === "touristappid" && !hasPrivateAppId) {
    warnings.push(
      "project.config.json uses touristappid; create wechat-miniapp/project.private.config.json before uploading a real experience version."
    );
  }

  if (warnings.length) {
    console.log("Warnings:");
    warnings.forEach((warning) => console.log(`- ${warning}`));
  }

  if (errors.length) {
    console.error("Miniapp validation failed:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log("Miniapp validation passed.");
  console.log(`Checked ${appConfig.pages.length} pages, ${jsonFiles.length} JSON files, ${jsFiles.length} JS files.`);
}

main();
