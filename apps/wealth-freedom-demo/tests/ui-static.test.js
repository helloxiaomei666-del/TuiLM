const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const test = require("node:test");

const htmlSource = readFileSync("index.html", "utf8");

test("manual drag monthly amount accepts non-hundred values", () => {
  const match = htmlSource.match(/<input name="manualDragAmount"[^>]+>/);

  assert.ok(match, "manual drag amount input should exist");
  assert.match(match[0], /step="0\.01"/);
  assert.match(match[0], /inputmode="decimal"/);
});
