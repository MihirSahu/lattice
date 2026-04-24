import assert from "node:assert/strict";
import test from "node:test";
import { resolveQueryLimit } from "../lib/server/query-engine-utils.ts";

test("resolveQueryLimit uses the explicit request limit when provided", () => {
  assert.equal(resolveQueryLimit(2, 6), 2);
});

test("resolveQueryLimit falls back to the configured default when the request omits limit", () => {
  assert.equal(resolveQueryLimit(undefined, 9), 9);
});
