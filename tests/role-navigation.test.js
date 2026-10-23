import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultView,
  navigationFor,
  resolveView,
} from "../src/role-navigation.js";

test("business accounts land in their hiring workspace and cannot navigate to the youth marketplace or personal passport", () => {
  assert.equal(defaultView("business"), "dashboard");
  assert.equal(resolveView("business", "discover"), "dashboard");
  assert.equal(resolveView("business", "passport"), "dashboard");
  assert.ok(navigationFor("business").some(([view]) => view === "applicants"));
  assert.ok(navigationFor("business").some(([view]) => view === "tasks"));
  assert.equal(resolveView("business", "confirmations"), "confirmations");
});
test("young people keep opportunities and their own experience without business management screens", () => {
  assert.equal(defaultView("talent"), "discover");
  for (const view of ["dashboard", "tasks", "applicants"])
    assert.equal(resolveView("talent", view), "discover");
  assert.equal(resolveView("talent", "passport"), "passport");
  assert.equal(resolveView("talent", "projects"), "projects");
});
