// Defines and edits the list filters applied to Planboard entries.

import { Button } from "cs2/ui";
import { usePlanboardLocale } from "../labels";
import { DeadlineMode, EntryPriority, Filters } from "../types/contracts";
import { Choice, Toggle } from "./EntryControls";
import styles from "./mainPanel.module.scss";

export const baseFilters: Filters = {
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

export function initialFilters(): Filters {
  try {
    const saved = JSON.parse(localStorage.getItem("planboard.listPreferences") || "null");
    const savedSort = saved?.sort;
    const sort =
      savedSort === "priority" || savedSort === "category" || savedSort === "deadline"
        ? savedSort
        : savedSort === "realDue" || savedSort === "gameDue"
          ? "deadline"
          : "updated";
    const tab =
      saved?.tab === "open" || saved?.tab === "doing" || saved?.tab === "done" ? saved.tab : "all";
    return { ...baseFilters, tab, sort };
  } catch {
    return baseFilters;
  }
}

export function FilterPanel({
  filters: f,
  deadlineMode,
  onChange,
}: {
  filters: Filters;
  deadlineMode: DeadlineMode;
  onChange: (filters: Filters) => void;
}) {
  const {
      kindLabels: k,
      categoryLabels: c,
      statusLabels: s,
      priorityLabels: p,
    } = usePlanboardLocale(),
    all = { label: "All", value: -1 };

  return (
    <div className={styles.filters}>
      <div className={styles.filterGrid}>
        <Choice
          label="Kind"
          value={f.kind}
          onChange={(kind) => onChange({ ...f, kind })}
          options={[all, ...k.map((label, value) => ({ label, value }))]}
        />
        <Choice
          label="Category"
          value={f.category}
          onChange={(category) => onChange({ ...f, category })}
          options={[all, ...c.map((label, value) => ({ label, value }))]}
        />
        <Choice
          label="Status"
          value={f.status}
          onChange={(status) => onChange({ ...f, status })}
          options={[all, ...s.map((label, value) => ({ label, value }))]}
        />
        <Choice
          label="Priority"
          value={f.priority}
          onChange={(priority) => onChange({ ...f, priority })}
          options={[
            all,
            ...p.map((label, value) => ({
              label,
              value,
              tone:
                value === EntryPriority.None
                  ? "none"
                  : value === EntryPriority.Low
                    ? "low"
                    : value === EntryPriority.Medium
                      ? "medium"
                      : "high",
            })),
          ]}
        />
        <Choice
          label="Location"
          value={f.location}
          onChange={(location) => onChange({ ...f, location })}
          options={[
            { label: "All", value: "all" },
            { label: "With pin location", value: "located" },
            { label: "Only in list", value: "list" },
          ]}
        />
        <Choice
          label="Sort"
          value={f.sort}
          onChange={(sort) => onChange({ ...f, sort })}
          options={[
            { label: "Recently updated", value: "updated" },
            { label: "Priority", value: "priority" },
            { label: "Category", value: "category" },
            {
              label: deadlineMode === "game" ? "In-game deadline" : "Real-life deadline",
              value: "deadline",
            },
          ]}
        />
      </div>
      <div className={styles.quickFilterRow}>
        <div className={styles.quickFilterButtons}>
          <Toggle
            label="Unfinished"
            value={f.unfinishedOnly}
            onChange={(unfinishedOnly) => onChange({ ...f, unfinishedOnly })}
          />
          <Toggle
            label="Overdue"
            value={f.overdueOnly}
            onChange={(overdueOnly) => onChange({ ...f, overdueOnly })}
          />
          <Toggle
            label="Missing links"
            value={f.missingLinksOnly}
            onChange={(missingLinksOnly) => onChange({ ...f, missingLinksOnly })}
          />
        </div>
        <Button
          variant="flat"
          className={styles.resetFilters}
          onSelect={() => onChange(baseFilters)}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
