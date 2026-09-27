import assert from "node:assert/strict";
import test from "node:test";
import { cn } from "../lib/utils.ts";

test("component overrides retain mobile visibility, desktop display, and requested sizing", () => {
  const classes = cn(
    "linear-focus inline-flex h-10 w-10 rounded-full",
    "hidden h-9 w-9 rounded-2xl lg:inline-flex",
    false,
    undefined
  ).split(" ");

  for (const value of ["linear-focus", "hidden", "h-9", "w-9", "rounded-2xl", "lg:inline-flex"]) {
    assert.ok(classes.includes(value), value);
  }
  for (const value of ["inline-flex", "h-10", "w-10", "rounded-full"]) {
    assert.ok(!classes.includes(value), value);
  }
});
