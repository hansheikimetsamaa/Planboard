// Composes the primary Planboard window and its list, editor, and filter states.

import { Component, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";

import { trigger, useValue } from "cs2/api";
import { Button, Panel } from "cs2/ui";

import {
  currentGameDate$,
  currentRealDate$,
  dataIssues$,
  dataReadOnly$,
  deadlineMode$,
  entries$,
  panelVisible$,
  placementEntryId$,
  placementState$,
  selectedEntryId$,
  undoAvailable$,
  windowLayoutRevision$,
} from "../bindings";
import { usePlanboardLocale } from "../labels";
import { filterAndSort } from "../model";

import {
  Binding,
  DataIssueView,
  EntryCategory,
  EntryKind,
  EntryPriority,
  EntryStatus,
  EntryView,
  PlacementState,
} from "../types/contracts";

import { DataIssuesPanel, ReadOnlyNotice } from "./DataIssuesPanel";
import { Editor, EditorPayload, NewEditor, type CreateEntry } from "./TaskEditors";
import { baseFilters, FilterPanel, initialFilters } from "./FilterPanel";
import { EntryRow, ListPopoverKind, ScrollableTaskList } from "./TaskList";
import { usePanelGeometry } from "./usePanelGeometry";
import styles from "./mainPanel.module.scss";

const emptyEntries: EntryView[] = [];
const emptyIssues: DataIssueView[] = [];

// Gameface remains responsive when the list is rendered in bounded, deliberate pages.
const listPageSize = 200;

type PendingDelete = { id: number; payload?: EditorPayload };
type ActiveListPopover = { entryId: number; kind: ListPopoverKind } | null;

// Keep the host component small so a panel error can be contained without unmounting the UI module.
export function MainPanel() {
  const visible = useValue(panelVisible$) ?? false;
  return visible ? (
    <Boundary>
      <PanelContent />
    </Boundary>
  ) : null;
}

// A failed extension should leave the player a working way to close the panel rather than trapping it.
class Boundary extends Component<
  {
    children: ReactNode;
  },
  {
    failed: boolean;
  }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Planboard panel failed", error, info);
  }
  render() {
    return this.state.failed ? (
      <div className={styles.error}>
        <strong>Planboard could not open.</strong>
        <Button
          variant="flat"
          onSelect={() => trigger(Binding.group, Binding.setPanelVisible, false)}
        >
          Close
        </Button>
      </div>
    ) : (
      this.props.children
    );
  }
}

function PanelContent() {
  // These bindings are the C# to Gameface contract for the panel's current state.
  const entries = useValue(entries$) ?? emptyEntries;
  const issues = useValue(dataIssues$) ?? emptyIssues;
  const readOnly = useValue(dataReadOnly$) ?? false;
  const selectedId = useValue(selectedEntryId$) ?? 0;
  const placementState = useValue(placementState$) ?? 0;
  const placementEntryId = useValue(placementEntryId$) ?? 0;
  const undoAvailable = useValue(undoAvailable$) ?? false;
  const layoutRevision = useValue(windowLayoutRevision$) ?? 0;
  const deadlineMode = useValue(deadlineMode$) ?? "real";
  const realToday = useValue(currentRealDate$) ?? "";
  const gameToday = useValue(currentGameDate$) ?? "";

  // Local state describes temporary UI choices. Saved task state remains authoritative in C#.
  const [filters, setFilters] = useState(initialFilters);
  const [creating, setCreating] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [categoryChip, setCategoryChip] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [deletedId, setDeletedId] = useState<number | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [activeListPopover, setActiveListPopover] = useState<ActiveListPopover>(null);
  const [visibleCount, setVisibleCount] = useState(listPageSize);

  const pendingCreate = useRef(false);
  const listOverlayHost = useRef<HTMLDivElement>(null);
  const { t, kindLabels, categoryLabels, statusLabels } = usePlanboardLocale();
  const geometry = usePanelGeometry("main", 520, 420, 0.9, 0.85);
  const layoutMounted = useRef(false);

  // Ignore the initial binding value; later revisions are explicit requests to restore the default layout.
  useEffect(() => {
    if (layoutMounted.current) geometry.reset();
    else layoutMounted.current = true;
  }, [layoutRevision]);

  // Defer only text matching so tab and filter controls respond immediately while typing stays smooth.
  const deferredQuery = useDeferredValue(filters.query);
  const effectiveFilters = useMemo(
    () => ({ ...filters, query: deferredQuery }),
    [filters, deferredQuery],
  );

  const categoryFor = (entry: EntryView) =>
    entry.categoryName || categoryLabels[entry.category] || categoryLabels[EntryCategory.General];

  const categoryNames = useMemo(() => Array.from(new Set(entries.map(categoryFor))), [entries]);

  const baseFiltered = useMemo(
    () => filterAndSort(entries, effectiveFilters, deadlineMode),
    [entries, effectiveFilters, deadlineMode],
  );
  const filtered = useMemo(
    () =>
      categoryChip
        ? baseFiltered.filter((entry) => categoryFor(entry) === categoryChip)
        : baseFiltered,
    [baseFiltered, categoryChip],
  );

  const visibleEntries = filtered.slice(0, visibleCount);
  const selected = entries.find((entry) => entry.id === detailId);

  const counts = useMemo(
    () => ({
      all: entries.length,
      open: entries.filter((x) => x.status === EntryStatus.Open).length,
      doing: entries.filter((x) => x.status === EntryStatus.Doing).length,
      done: entries.filter((x) => x.status === EntryStatus.Done).length,
    }),
    [entries],
  );

  // List preferences are a convenience only; they never participate in saved city data.
  useEffect(() => {
    try {
      localStorage.setItem(
        "planboard.listPreferences",
        JSON.stringify({ tab: filters.tab, sort: filters.sort }),
      );
    } catch {
      // Storage can be unavailable in embedded UI contexts, so use this session's defaults instead.
    }
  }, [filters.tab, filters.sort]);

  // Selection comes from the game, including a newly created entry after C# assigns its identifier.
  useEffect(() => {
    if (selectedId > 0) {
      setDetailId(selectedId);
      if (pendingCreate.current) {
        setCreatedId(selectedId);
        pendingCreate.current = false;
      }
    }
  }, [selectedId]);

  useEffect(() => {
    if (detailId !== null && !entries.some((entry) => entry.id === detailId)) {
      setDetailId(null);
    }
  }, [entries, detailId]);

  // Highlights and creation notices are short-lived feedback, not persisted entry state.
  useEffect(() => {
    if (highlightedId !== null) {
      const timer = window.setTimeout(() => setHighlightedId(null), 2400);
      return () => window.clearTimeout(timer);
    }
  }, [highlightedId]);
  useEffect(() => {
    if (createdId === null) return;
    const timer = window.setTimeout(() => setCreatedId(null), 5000);
    return () => window.clearTimeout(timer);
  }, [createdId]);

  useEffect(() => setVisibleCount(listPageSize), [filters, categoryChip]);

  const resetFilters = () => {
    setFilters(baseFilters);
    setCategoryChip(null);
  };
  const create: CreateEntry = (
    title: string,
    description: string,
    kind: EntryKind,
    category: EntryCategory,
    categoryName: string,
    status: EntryStatus,
    priority: EntryPriority,
    realDueTicks: string,
    gameDueTicks: string,
    place: boolean,
  ): string | null => {
    if (entries.length >= 10000) return "Planboard has reached its 10,000 item limit.";

    // Wait for C# selection before opening the new entry, avoiding a UI-only placeholder record.
    pendingCreate.current = true;
    setCreating(false);
    trigger(
      Binding.group,
      Binding.createEntry,
      title,
      kind,
      category,
      categoryName,
      place,
      description,
      status,
      priority,
      realDueTicks,
      gameDueTicks,
    );
    return null;
  };

  // Preserve the closest visible row so deleting an item does not leave the player without context.
  const deleteImmediately = (id: number, payload?: EditorPayload) => {
    const index = filtered.findIndex((entry) => entry.id === id);
    const nearest = filtered[index + 1] ?? filtered[index - 1];
    setDeletedId(id);
    setHighlightedId(nearest?.id ?? null);
    setDetailId(null);
    trigger(Binding.group, Binding.deleteEntry, id, ...(payload ?? []));
  };

  const requestDelete = (id: number, payload?: EditorPayload) => {
    setPendingDelete({ id, payload });
  };

  const confirmDelete = () => {
    if (pendingDelete === null) return;
    deleteImmediately(pendingDelete.id, pendingDelete.payload);
    setPendingDelete(null);
  };
  const undo = () => {
    trigger(Binding.group, Binding.undoDelete);
    if (deletedId !== null) setHighlightedId(deletedId);
    setDeletedId(null);
  };
  const hiddenCreated = createdId !== null && !filtered.some((x) => x.id === createdId);

  // Category chips are derived from the current entries so custom categories need no separate store.
  const categoryChips =
    categoryNames.length > 0 ? (
      <div className={styles.chips}>
        {categoryNames.map((name) => (
          <Button
            key={name}
            variant="flat"
            selected={categoryChip === name}
            className={categoryChip === name ? styles.chipActive : ""}
            onSelect={() => setCategoryChip(categoryChip === name ? null : name)}
          >
            {name}
          </Button>
        ))}
      </div>
    ) : null;
  return (
    <Panel
      key={geometry.panelKey}
      draggable
      initialPosition={geometry.initialPosition}
      style={geometry.panelStyle}
      onMouseUp={geometry.onPanelMouseUp}
      className={styles.panelShell}
      contentClassName={styles.panelContent}
      header={
        <div className={styles.title}>
          <strong>{t("Title", "Planboard")}</strong>
        </div>
      }
      showCloseHint
      onClose={() => trigger(Binding.group, Binding.setPanelVisible, false)}
    >
      <div ref={listOverlayHost} className={styles.panel}>
        {readOnly ? (
          <ReadOnlyNotice issues={issues} />
        ) : (
          <>
            {placementState >= PlacementState.ChoosingLocation &&
              placementState <= PlacementState.InvalidPreview && (
                <div className={styles.banner}>
                  <span>Pinning #{placementEntryId} - click the map</span>
                  <Button
                    variant="flat"
                    onSelect={() => trigger(Binding.group, Binding.cancelPlacement)}
                  >
                    Cancel
                  </Button>
                </div>
              )}

            {pendingDelete !== null && (
              <div className={styles.deleteConfirm}>
                <span>Delete this entry?</span>
                <div className={styles.deleteConfirmActions}>
                  <Button variant="flat" onSelect={() => setPendingDelete(null)}>
                    Cancel
                  </Button>
                  <Button variant="flat" onSelect={confirmDelete}>
                    Delete
                  </Button>
                </div>
              </div>
            )}

            {!selected && !creating && (
              <>
                <div className={styles.listHeader}>
                  <div>
                    <strong>Map tasks</strong>
                    <span>Notes, issues and ideas tied to your city</span>
                  </div>
                  <input
                    className={styles.searchInput}
                    value={filters.query}
                    aria-label={t("SearchPlaceholder", "Search tasks and notes")}
                    placeholder={t("SearchPlaceholder", "Search tasks and notes")}
                    onChange={(event) => setFilters({ ...filters, query: event.target.value })}
                  />
                  <Button
                    variant="flat"
                    className={styles.plusButton}
                    title="Create a new item"
                    onSelect={() => setCreating(true)}
                  >
                    +
                  </Button>
                </div>
                <div className={styles.navigation}>
                  <div className={styles.tabs}>
                    {(["all", "open", "doing", "done"] as const).map((tab) => (
                      <Button
                        key={tab}
                        variant="flat"
                        selected={filters.tab === tab}
                        className={filters.tab === tab ? styles.active : ""}
                        onSelect={() => setFilters({ ...filters, tab })}
                      >
                        <span>{tab === "all" ? "All" : tab[0].toUpperCase() + tab.slice(1)}</span>
                        <span>{counts[tab]}</span>
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="flat"
                    className={styles.filterButton}
                    onSelect={() => setShowFilters(!showFilters)}
                  >
                    Filters {showFilters ? "-" : "+"}
                  </Button>
                </div>
                {showFilters ? (
                  <div className={styles.filterArea}>
                    {categoryChips}
                    <FilterPanel
                      filters={filters}
                      deadlineMode={deadlineMode}
                      onChange={setFilters}
                    />
                  </div>
                ) : (
                  categoryChips
                )}{" "}
                {hiddenCreated && (
                  <div className={styles.hiddenNotice}>
                    New item is hidden by current filters.
                    <Button variant="flat" onSelect={resetFilters}>
                      Clear filters
                    </Button>
                  </div>
                )}
                <ScrollableTaskList>
                  {filtered.length ? (
                    <>
                      {visibleEntries.map((entry) => (
                        <EntryRow
                          key={entry.id}
                          entry={entry}
                          category={categoryFor(entry)}
                          kindLabel={kindLabels[entry.kind]}
                          statusLabels={statusLabels}
                          highlighted={entry.id === highlightedId}
                          activePopover={
                            activeListPopover?.entryId === entry.id ? activeListPopover.kind : null
                          }
                          onPopoverChange={(kind) =>
                            setActiveListPopover(kind ? { entryId: entry.id, kind } : null)
                          }
                          overlayHost={listOverlayHost}
                          onOpen={() => {
                            trigger(Binding.group, Binding.selectEntry, entry.id);
                            setDetailId(entry.id);
                          }}
                          onDelete={() => deleteImmediately(entry.id)}
                        />
                      ))}
                      {visibleEntries.length < filtered.length && (
                        <Button
                          variant="flat"
                          className={styles.showMore}
                          onSelect={() => setVisibleCount((count) => count + listPageSize)}
                        >
                          Show more ({filtered.length - visibleEntries.length} remaining)
                        </Button>
                      )}
                    </>
                  ) : (
                    <div className={styles.empty}>
                      <strong>No matching tasks</strong>
                      <span>Adjust the filters or add something new.</span>
                      <Button variant="flat" onSelect={resetFilters}>
                        Clear filters
                      </Button>
                    </div>
                  )}
                </ScrollableTaskList>
                <div className={styles.footer}>
                  <Button variant="flat" className={styles.resetWindow} onSelect={geometry.reset}>
                    Reset window
                  </Button>
                </div>
              </>
            )}

            {creating && (
              <div className={styles.detailView}>
                <NewEditor
                  deadlineMode={deadlineMode}
                  realToday={realToday}
                  gameToday={gameToday}
                  onCancel={() => setCreating(false)}
                  onCreate={create}
                />
              </div>
            )}

            {selected && (
              <div className={styles.detailView}>
                <Editor
                  key={selected.id}
                  entry={selected}
                  deadlineMode={deadlineMode}
                  realToday={realToday}
                  gameToday={gameToday}
                  onBack={() => {
                    trigger(Binding.group, Binding.selectEntry, 0);
                    setDetailId(null);
                  }}
                  onDelete={(payload) => requestDelete(selected.id, payload)}
                />
              </div>
            )}

            {undoAvailable && (
              <div className={styles.undoToast}>
                <span>Entry deleted</span>
                <Button variant="flat" onSelect={undo}>
                  Undo
                </Button>
              </div>
            )}

            {issues.length > 0 && (
              <div className={styles.issues}>
                <Button variant="flat" onSelect={() => setShowIssues(!showIssues)}>
                  Data issues ({issues.length}) {showIssues ? "-" : "+"}
                </Button>
                {showIssues && <DataIssuesPanel issues={issues} />}
              </div>
            )}

            <div className={styles.resizeHandle} onMouseDown={geometry.startResize}></div>
          </>
        )}
      </div>
    </Panel>
  );
}
