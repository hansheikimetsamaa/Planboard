// Contains pure filtering, sorting, and date-conversion helpers for task views.

import type {
  DateFormat,
  DeadlineMode,
  EntryCategory,
  EntryView,
  Filters,
} from "./types/contracts";

const dotNetEpochTicks = 621355968000000000n;
const ticksPerMillisecond = 10000n;

export type CompactCategoryChoice = {
  category: EntryCategory;
  custom: string;
};

// A new city starts with varied, useful prompts. Once the player has saved tasks, those
// choices naturally yield to the categories they have actually been using in that city.
export const compactDraftCategoryDefaults = [
  9, // General
  0, // Traffic
  4, // Zoning & Development
  5, // City Services
] as readonly EntryCategory[];

export function categoryChoiceKey(category: EntryCategory, custom: string): string {
  const cleanCustom = custom.trim();
  return cleanCustom ? `custom:${cleanCustom.toLocaleLowerCase()}` : `standard:${category}`;
}

export function compactDraftCategoryChoices(
  entries: EntryView[],
  activeDraftId: number,
  currentChoice?: CompactCategoryChoice,
  maximum = 4,
): CompactCategoryChoice[] {
  const choices: CompactCategoryChoice[] = [];
  const seen = new Set<string>();
  const add = (choice: CompactCategoryChoice) => {
    const key = categoryChoiceKey(choice.category, choice.custom);
    if (seen.has(key) || choices.length === maximum) return;
    seen.add(key);
    choices.push(choice);
  };

  // A category selected in the currently open editor should be visible immediately, but it
  // becomes lasting history only after Save. The transient entry itself is never considered.
  if (currentChoice) add(currentChoice);

  [...entries]
    .filter((entry) => entry.id !== activeDraftId)
    .sort((left, right) => compareTicksDesc(left.updatedUtcTicks, right.updatedUtcTicks))
    .forEach((entry) => add({ category: entry.category, custom: entry.categoryName || "" }));

  compactDraftCategoryDefaults.forEach((category) => add({ category, custom: "" }));
  return choices;
}

export function isValidDateInput(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

export function dateInputToTicks(value: string): string {
  if (!value || !isValidDateInput(value)) return "0";
  const milliseconds = Date.parse(`${value}T00:00:00Z`);
  return (BigInt(milliseconds) * ticksPerMillisecond + dotNetEpochTicks).toString();
}

export function ticksToDateInput(value: string): string {
  try {
    const ticks = BigInt(value || "0");
    if (ticks <= 0n) return "";
    const milliseconds = Number((ticks - dotNetEpochTicks) / ticksPerMillisecond);
    return new Date(milliseconds).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

// Dates stay as ISO strings in state and saves. This formatter changes only the
// readable presentation selected in settings, so comparisons remain stable.
export function formatDateInput(value: string, format: DateFormat = "iso"): string {
  if (!isValidDateInput(value)) return "";
  const [year, month, day] = value.split("-");
  if (format === "dayMonthYear") return `${day}/${month}/${year}`;
  if (format === "monthDayYear") return `${month}/${day}/${year}`;
  return value;
}

export function filterAndSort(
  entries: EntryView[],
  filters: Filters,
  deadlineMode: DeadlineMode = "real",
): EntryView[] {
  const query = filters.query.trim().toLocaleLowerCase();
  const result = entries.filter((entry) => {
    if (filters.tab === "open" && entry.status !== 0) return false;
    if (filters.tab === "doing" && entry.status !== 1) return false;
    if (filters.tab === "done" && entry.status !== 2) return false;
    if (filters.unfinishedOnly && entry.status === 2) return false;
    if (filters.kind >= 0 && entry.kind !== filters.kind) return false;
    if (filters.category >= 0 && entry.category !== filters.category) return false;
    if (filters.status >= 0 && entry.status !== filters.status) return false;
    if (filters.priority >= 0 && entry.priority !== filters.priority) return false;
    if (filters.location === "located" && !entry.hasLocation) return false;
    if (filters.location === "list" && entry.hasLocation) return false;
    if (filters.missingLinksOnly && entry.linkState !== 2) return false;
    if (filters.overdueOnly && !(deadlineMode === "game" ? entry.gameOverdue : entry.realOverdue))
      return false;
    return (
      !query ||
      entry.title.toLocaleLowerCase().includes(query) ||
      entry.description.toLocaleLowerCase().includes(query) ||
      (entry.categoryName || "").toLocaleLowerCase().includes(query)
    );
  });

  return result.sort((a, b) => {
    switch (filters.sort) {
      case "priority":
        return (
          b.priority - a.priority || Number(BigInt(b.updatedUtcTicks) - BigInt(a.updatedUtcTicks))
        );
      case "category":
        return a.category - b.category || a.title.localeCompare(b.title);
      case "deadline":
        return dueSort(
          deadlineMode === "game" ? a.gameDueDateTicks : a.realDueDateTicks,
          deadlineMode === "game" ? b.gameDueDateTicks : b.realDueDateTicks,
        );
      default:
        return compareTicksDesc(a.updatedUtcTicks, b.updatedUtcTicks);
    }
  });
}

function dueSort(left: string, right: string): number {
  const a = BigInt(left || "0");
  const b = BigInt(right || "0");
  if (a === 0n && b === 0n) return 0;
  if (a === 0n) return 1;
  if (b === 0n) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareTicksDesc(left: string, right: string): number {
  const a = BigInt(left || "0");
  const b = BigInt(right || "0");
  return a > b ? -1 : a < b ? 1 : 0;
}
