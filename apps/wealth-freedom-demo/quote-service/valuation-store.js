const fs = require("node:fs");
const path = require("node:path");

const defaultRuntimeDir = path.join(__dirname, "..", ".runtime");
const defaultFileName = "valuation-snapshots.json";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createValuationStore(options = {}) {
  const filePath = options.filePath || path.join(options.runtimeDir || defaultRuntimeDir, defaultFileName);

  function readAll() {
    if (!fs.existsSync(filePath)) return {};
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeAll(data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }

  function getSnapshots(userId = "demo") {
    const data = readAll();
    const snapshots = data[userId];
    return Array.isArray(snapshots) ? clone(snapshots) : [];
  }

  function saveSnapshots(userId = "demo", snapshots = []) {
    const data = readAll();
    data[userId] = clone(snapshots);
    writeAll(data);
    return getSnapshots(userId);
  }

  return {
    filePath,
    getSnapshots,
    saveSnapshots,
  };
}

module.exports = {
  createValuationStore,
  defaultRuntimeDir,
};
