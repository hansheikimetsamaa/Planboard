import test from "node:test";
import assert from "node:assert/strict";
import {
  compactDraftCategoryChoices,
  dateInputToTicks,
  filterAndSort,
  formatDateInput,
  isValidDateInput,
  ticksToDateInput,
} from "../UI/src/model.ts";

// Node's lightweight TypeScript loader cannot execute enum declarations. These binding values
// mirror EntryCategory; the contract suite separately keeps the C# and TypeScript enum order aligned.
const category = {
  Traffic: 0,
  Roads: 1,
  ZoningDevelopment: 4,
  CityServices: 5,
  Utilities: 6,
  General: 9,
};

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

test("date display preferences do not alter the stored ISO date", () => {
  const value = "2026-08-29";
  assert.equal(formatDateInput(value), value);
  assert.equal(formatDateInput(value, "dayMonthYear"), "29/08/2026");
  assert.equal(formatDateInput(value, "monthDayYear"), "08/29/2026");
  assert.equal(formatDateInput("not-a-date", "dayMonthYear"), "");
});

// Compact draft choices are city-specific: recently saved categories take precedence without
// turning a transient, uncommitted placement into lasting category history.
test("compact draft categories are recent, varied, and safe for custom values", () => {
  const entries = [
    entry(1, { category: category.Traffic, updatedUtcTicks: "10" }),
    entry(2, { category: category.Roads, updatedUtcTicks: "20" }),
    entry(3, {
      category: category.General,
      categoryName: "Old Town",
      updatedUtcTicks: "30",
    }),
    entry(4, { category: category.Roads, updatedUtcTicks: "40" }),
    entry(5, { category: category.General, updatedUtcTicks: "50" }),
  ];

  assert.deepEqual(compactDraftCategoryChoices(entries, 5), [
    { category: category.Roads, custom: "" },
    { category: category.General, custom: "Old Town" },
    { category: category.Traffic, custom: "" },
    { category: category.General, custom: "" },
  ]);
  assert.deepEqual(
    compactDraftCategoryChoices(entries, 5, {
      category: category.Utilities,
      custom: "",
    }).map((choice) => choice.category),
    [category.Utilities, category.Roads, category.General, category.Traffic],
  );
  assert.deepEqual(
    compactDraftCategoryChoices([], 99).map((choice) => choice.category),
    [category.General, category.Traffic, category.ZoningDevelopment, category.CityServices],
  );
  assert.deepEqual(compactDraftCategoryChoices(entries, 5, undefined, 3), [
    { category: category.Roads, custom: "" },
    { category: category.General, custom: "Old Town" },
    { category: category.Traffic, custom: "" },
  ]);
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
