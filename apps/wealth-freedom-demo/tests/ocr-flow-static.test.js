const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const test = require("node:test");

const appSource = readFileSync("app.js", "utf8");
const htmlSource = readFileSync("index.html", "utf8");

function functionBody(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);
  const next = appSource.indexOf("\nfunction ", start + 1);
  return appSource.slice(start, next === -1 ? appSource.length : next);
}

test("OCR result card exists with confirm and cancel actions", () => {
  assert.match(htmlSource, /id="ocrConfirmation"/);
  assert.match(htmlSource, /id="ocrResultList"/);
  assert.match(htmlSource, /id="confirmOcrButton"/);
  assert.match(htmlSource, /id="cancelOcrButton"/);
});

test("screenshot import creates pending OCR result without writing form fields", () => {
  const body = functionBody("handleScreenshotImport");

  assert.match(body, /pendingOcrResult\s*=/);
  assert.doesNotMatch(body, /setHoldingField\(/);
});

test("only explicit confirmation writes OCR result into the holding form", () => {
  const body = functionBody("confirmPendingOcrResult");

  assert.match(body, /setHoldingField\(/);
  assert.match(body, /confirmedOcrResultId\s*=/);
});

test("unconfirmed screenshot OCR cannot be saved as a holding", () => {
  const body = functionBody("addHoldingFromForm");

  assert.match(body, /inputMode === "screenshot" && hasScreenshotFile && pendingOcrResult/);
  assert.match(body, /inputMode === "screenshot" && hasScreenshotFile && !confirmedOcrResultId/);
  assert.match(body, /return false/);
});
