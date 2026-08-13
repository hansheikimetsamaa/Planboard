import test from "node:test";
import assert from "node:assert/strict";
import {
  dateInputToTicks,
  filterAndSort,
  isValidDateInput,
  ticksToDateInput,
} from "../UI/src/model.ts";

// These fixtures describe the smallest complete entry needed by the filtering domain.
// Individual tests override only the fields relevant to the rule under test.
const baseFilters = {
  query: "",
  tab: "all",
  kind: -1,
  category: -1,
  status: -1,
  priority: -1,
  location: "all",
  missingLinksOnly: false,
  overdueOnly: false,
  unfinishedOnly: false,
  sort: "updated",
};

// Keep the shared entry factory close to the binding contract so test data stays realistic.
const entry = (id, overrides = {}) => ({
  id,
  title: `Entry ${id}`,
  description: "",
  kind: 1,
  category: 9,
  status: 0,
  priority: 0,
  createdUtcTicks: String(id),
  updatedUtcTicks: String(id),
  realDueDateTicks: "0",
  gameDueDateTicks: "0",
  realOverdue: false,
  gameOverdue: false,
  spatialKind: 0,
  hasLocation: false,
  x: 0,
  y: 0,
  z: 0,
  linkState: 0,
  hasDistrict: false,
  markerMoved: false,
  ...overrides,
});

// Date conversion deliberately rejects invalid input instead of relying on JavaScript normalization.
test("date-only values round-trip through .NET ticks", () => {
  for (const value of ["2026-07-31", "2030-01-01", "2000-02-29"])
    assert.equal(ticksToDateInput(dateInputToTicks(value)), value);
  assert.equal(dateInputToTicks(""), "0");
  assert.equal(ticksToDateInput("0"), "");
});

test("impossible and malformed dates are rejected instead of normalized", () => {
  for (const value of ["2026-02-29", "2026-02-31", "2026-13-01", "not-a-date"]) {
    assert.equal(isValidDateInput(value), false);
    assert.equal(dateInputToTicks(value), "0");
  }
  assert.equal(isValidDateInput("2028-02-29"), true);
});

// Filtering is pure UI-domain logic and should compose regardless of the order controls are used.
test("tabs and unfinished filter respect status", () => {
  const entries = [entry(1), entry(2, { status: 1 }), entry(3, { status: 2 })];
  assert.deepEqual(
    filterAndSort(entries, { ...baseFilters, tab: "open" }).map((x) => x.id),
    [1],
  );
  assert.deepEqual(
    filterAndSort(entries, { ...baseFilters, tab: "doing" }).map((x) => x.id),
    [2],
  );
  assert.deepEqual(
    filterAndSort(entries, { ...baseFilters, tab: "done" }).map((x) => x.id),
    [3],
  );
  assert.deepEqual(
    filterAndSort(entries, { ...baseFilters, unfinishedOnly: true }).map((x) => x.id),
    [2, 1],
  );
});

test("location, missing-link, overdue, priority and search filters combine", () => {
  const entries = [
    entry(1, {
      title: "Fix bridge",
      hasLocation: true,
      linkState: 2,
      realOverdue: true,
      priority: 3,
    }),
    entry(2, { title: "Future park", kind: 2 }),
  ];
  const filtered = filterAndSort(entries, {
    ...baseFilters,
    query: "bridge",
    location: "located",
    missingLinksOnly: true,
    overdueOnly: true,
    priority: 3,
  });
  assert.deepEqual(
    filtered.map((x) => x.id),
    [1],
  );
});

test("due-date sorting puts undated entries last", () => {
  const entries = [
    entry(1),
    entry(2, { realDueDateTicks: "20" }),
    entry(3, { realDueDateTicks: "10" }),
  ];
  assert.deepEqual(
    filterAndSort(entries, { ...baseFilters, sort: "deadline" }).map((x) => x.id),
    [3, 2, 1],
  );
});

// The active deadline mode decides which preserved date is used for sorting and overdue checks.
test("preferred deadline mode controls sorting and overdue filtering", () => {
  const entries = [
    entry(1, { realDueDateTicks: "30", gameDueDateTicks: "10", realOverdue: true }),
    entry(2, { realDueDateTicks: "10", gameDueDateTicks: "30", gameOverdue: true }),
  ];
  assert.deepEqual(
    filterAndSort(entries, { ...baseFilters, sort: "deadline" }, "real").map((x) => x.id),
    [2, 1],
  );
  assert.deepEqual(
    filterAndSort(entries, { ...baseFilters, sort: "deadline" }, "game").map((x) => x.id),
    [1, 2],
  );
  assert.deepEqual(
    filterAndSort(entries, { ...baseFilters, overdueOnly: true }, "real").map((x) => x.id),
    [1],
  );
  assert.deepEqual(
    filterAndSort(entries, { ...baseFilters, overdueOnly: true }, "game").map((x) => x.id),
    [2],
  );
});
