import { Component, ReactNode, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ErrorInfo } from "react";
import { trigger, useValue } from "cs2/api";
import { Button, Panel } from "cs2/ui";
import { currentGameDate$, currentRealDate$, dataIssues$, dataReadOnly$, deadlineMode$, entries$, panelVisible$, placementEntryId$, placementState$, selectedEntryId$, undoAvailable$, windowLayoutRevision$ } from "../bindings";
import { usePlanboardLocale } from "../labels";
import { dateInputToTicks, filterAndSort, isValidDateInput, ticksToDateInput } from "../model";
import { Binding, DataIssueView, DeadlineMode, EntryCategory, EntryKind, EntryPriority, EntryStatus, EntryView, Filters, LinkState, PlacementState } from "../types/contracts";
import { KindIcon } from "./KindIcon";
import { StatusIcon } from "./StatusIcon";
import { usePanelGeometry } from "./usePanelGeometry";
import { CategoryPicker, Choice, KindPicker, Segmented, StatusPicker, Toggle } from "./EntryControls";
import styles from "./mainPanel.module.scss";
const emptyEntries: EntryView[] = [], emptyIssues: DataIssueView[] = [];
const baseFilters: Filters = { query: "", tab: "all", kind: -1, category: -1, status: -1, priority: -1, location: "all", missingLinksOnly: false, overdueOnly: false, unfinishedOnly: false, sort: "updated" };
const listPageSize = 200;
type EditorPayload = (string | number)[];
type PendingDelete = { id: number; payload?: EditorPayload };
function initialFilters(): Filters { try {
    const saved = JSON.parse(localStorage.getItem("planboard.listPreferences") || "null");
    const savedSort = saved?.sort;
    const sort = savedSort === "priority" || savedSort === "category" || savedSort === "deadline"
        ? savedSort
        : savedSort === "realDue" || savedSort === "gameDue" ? "deadline" : "updated";
    return { ...baseFilters, tab: saved?.tab ?? "all", sort };
}
catch {
    return baseFilters;
} }
export function MainPanel() { const visible = useValue(panelVisible$) ?? false; return visible ? <Boundary><PanelContent /></Boundary> : null; }
class Boundary extends Component<{
    children: ReactNode;
}, {
    failed: boolean;
}> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch(error: unknown, info: ErrorInfo) { console.error("Planboard panel failed", error, info); }
    render() { return this.state.failed ? <div className={styles.error}><strong>Planboard could not open.</strong><Button variant="flat" onSelect={() => trigger(Binding.group, Binding.setPanelVisible, false)}>Close</Button></div> : this.props.children; }
}
function PanelContent() {
    const entries = useValue(entries$) ?? emptyEntries, issues = useValue(dataIssues$) ?? emptyIssues, readOnly = useValue(dataReadOnly$) ?? false, selectedId = useValue(selectedEntryId$) ?? 0, placementState = useValue(placementState$) ?? 0, placementEntryId = useValue(placementEntryId$) ?? 0, undoAvailable = useValue(undoAvailable$) ?? false, layoutRevision = useValue(windowLayoutRevision$) ?? 0;
    const deadlineMode = useValue(deadlineMode$) ?? "real";
    const realToday = useValue(currentRealDate$) ?? "";
    const gameToday = useValue(currentGameDate$) ?? "";
    const [filters, setFilters] = useState(initialFilters), [creating, setCreating] = useState(false), [showFilters, setShowFilters] = useState(false), [showIssues, setShowIssues] = useState(false), [detailId, setDetailId] = useState<number | null>(null), [categoryChip, setCategoryChip] = useState<string | null>(null), [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null), [highlightedId, setHighlightedId] = useState<number | null>(null), [deletedId, setDeletedId] = useState<number | null>(null), [createdId, setCreatedId] = useState<number | null>(null), [visibleCount, setVisibleCount] = useState(listPageSize);
    const pendingCreate = useRef(false);
    const { t, kindLabels, categoryLabels, statusLabels } = usePlanboardLocale();
    const geometry = usePanelGeometry("main", 520, 420, .9, .85);
    const layoutMounted = useRef(false);
    useEffect(() => { if (layoutMounted.current)
        geometry.reset();
    else
        layoutMounted.current = true; }, [layoutRevision]);
    const deferredQuery = useDeferredValue(filters.query);
    const effectiveFilters = useMemo(() => ({ ...filters, query: deferredQuery }), [filters, deferredQuery]);
    const categoryFor = (entry: EntryView) => entry.categoryName || categoryLabels[entry.category] || categoryLabels[EntryCategory.General];
    const categoryNames = useMemo(() => Array.from(new Set(entries.map(categoryFor))), [entries]);
    const baseFiltered = useMemo(() => filterAndSort(entries, effectiveFilters, deadlineMode), [entries, effectiveFilters, deadlineMode]);
    const filtered = useMemo(() => categoryChip ? baseFiltered.filter(entry => categoryFor(entry) === categoryChip) : baseFiltered, [baseFiltered, categoryChip]);
    const visibleEntries = filtered.slice(0, visibleCount);
    const selected = entries.find(entry => entry.id === detailId);
    const counts = useMemo(() => ({ all: entries.length, open: entries.filter(x => x.status !== EntryStatus.Done).length, done: entries.filter(x => x.status === EntryStatus.Done).length }), [entries]);
    useEffect(() => {
        try {
            localStorage.setItem("planboard.listPreferences", JSON.stringify({ tab: filters.tab, sort: filters.sort }));
        }
        catch { }
    }, [filters.tab, filters.sort]);
    useEffect(() => { if (selectedId > 0) {
        setDetailId(selectedId);
        if (pendingCreate.current) {
            setCreatedId(selectedId);
            pendingCreate.current = false;
        }
    } }, [selectedId]);
    useEffect(() => { if (detailId !== null && !entries.some(entry => entry.id === detailId))
        setDetailId(null); }, [entries, detailId]);
    useEffect(() => { if (highlightedId !== null) {
        const timer = window.setTimeout(() => setHighlightedId(null), 2400);
        return () => window.clearTimeout(timer);
    } }, [highlightedId]);
    useEffect(() => {
        if (createdId === null)
            return;
        const timer = window.setTimeout(() => setCreatedId(null), 5000);
        return () => window.clearTimeout(timer);
    }, [createdId]);
    useEffect(() => setVisibleCount(listPageSize), [filters, categoryChip]);
    const resetFilters = () => { setFilters(baseFilters); setCategoryChip(null); };
    const create = (title: string, description: string, kind: EntryKind, category: EntryCategory, categoryName: string, status: EntryStatus, priority: EntryPriority, realDueTicks: string, gameDueTicks: string, place: boolean): string | null => {
        if (entries.length >= 10000)
            return "Planboard has reached its 10,000 item limit.";
        pendingCreate.current = true;
        setCreating(false);
        trigger(Binding.group, Binding.createEntry, title, kind, category, categoryName, place, description, status, priority, realDueTicks, gameDueTicks);
        return null;
    };
    const deleteImmediately = (id: number, payload?: EditorPayload) => { const index = filtered.findIndex(x => x.id === id), nearest = filtered[index + 1] ?? filtered[index - 1]; setDeletedId(id); setHighlightedId(nearest?.id ?? null); setDetailId(null); trigger(Binding.group, Binding.deleteEntry, id, ...(payload ?? [])); };
    const requestDelete = (id: number, payload?: EditorPayload) => setPendingDelete({ id, payload });
    const confirmDelete = () => { if (pendingDelete === null)
        return; deleteImmediately(pendingDelete.id, pendingDelete.payload); setPendingDelete(null); };
    const undo = () => { trigger(Binding.group, Binding.undoDelete); if (deletedId !== null)
        setHighlightedId(deletedId); setDeletedId(null); };
    const hiddenCreated = createdId !== null && !filtered.some(x => x.id === createdId);
    return <Panel key={geometry.panelKey} draggable initialPosition={geometry.initialPosition}
style={geometry.panelStyle} onMouseUp={geometry.onPanelMouseUp} className={styles.panelShell} contentClassName={styles.panelContent} header={<div className={styles.title}><strong>{t("Title", "Planboard")}</strong><span>{t("Subtitle", "City Tasks & Map Notes & ToDo")} | {entries.length} items</span></div>} showCloseHint onClose={() => trigger(Binding.group, Binding.setPanelVisible, false)}><div className={styles.panel}>
  {readOnly ? <ReadOnlyNotice issues={issues}/> : <>
  {placementState >= PlacementState.ChoosingLocation && placementState <= PlacementState.InvalidPreview && <div className={styles.banner}><span>Pinning #{placementEntryId} - click the map</span><Button variant="flat" onSelect={() => trigger(Binding.group, Binding.cancelPlacement)}>Cancel</Button></div>}
  {pendingDelete !== null && <div className={styles.deleteConfirm}><span>Delete this entry?</span><div className={styles.deleteConfirmActions}><Button variant="flat" onSelect={() => setPendingDelete(null)}>Cancel</Button><Button variant="flat" onSelect={confirmDelete}>Delete</Button></div></div>}
  {!selected && !creating && <><div className={styles.listHeader}><div><strong>Map tasks</strong><span>Notes, issues and ideas tied to your city</span></div><input className={styles.searchInput} value={filters.query} aria-label={t("SearchPlaceholder", "Search tasks and notes")} placeholder={t("SearchPlaceholder", "Search tasks and notes")} onChange={event => setFilters({ ...filters, query: event.target.value })}/><Button variant="flat" className={styles.plusButton} title="Create a new item" onSelect={() => setCreating(true)}>+</Button></div>
  <div className={styles.navigation}><div className={styles.tabs}>{(["all", "open", "done"] as const).map(tab => <Button key={tab} variant="flat" selected={filters.tab === tab} className={filters.tab === tab ? styles.active : ""} onSelect={() => setFilters({ ...filters, tab })}><span>{tab === "all" ? "All" : tab === "open" ? "Open" : "Completed"}</span><span>{counts[tab]}</span></Button>)}</div><Button variant="flat" className={styles.filterButton} onSelect={() => setShowFilters(!showFilters)}>Filters {showFilters ? "-" : "+"}</Button></div>
  {categoryNames.length > 0 && <div className={styles.chips}>{categoryNames.map(name => <Button key={name} variant="flat" selected={categoryChip === name} className={categoryChip === name ? styles.chipActive : ""} onSelect={() => setCategoryChip(categoryChip === name ? null : name)}>{name}</Button>)}</div>}{showFilters && <FilterPanel filters={filters} deadlineMode={deadlineMode} onChange={setFilters}/>} {hiddenCreated && <div className={styles.hiddenNotice}>New item is hidden by current filters.<Button variant="flat" onSelect={resetFilters}>Clear filters</Button></div>}
  <div className={styles.taskList}>{filtered.length ? <>{visibleEntries.map(entry => <EntryRow key={entry.id} entry={entry} category={categoryFor(entry)} kindLabel={kindLabels[entry.kind]} statusLabel={statusLabels[entry.status]} highlighted={entry.id === highlightedId} onOpen={() => { trigger(Binding.group, Binding.selectEntry, entry.id); setDetailId(entry.id); }} onDelete={() => deleteImmediately(entry.id)}/>)}{visibleEntries.length < filtered.length && <Button variant="flat" className={styles.showMore} onSelect={() => setVisibleCount(count => count + listPageSize)}>Show more ({filtered.length - visibleEntries.length} remaining)</Button>}</> : <div className={styles.empty}><strong>No matching tasks</strong><span>Adjust the filters or add something new.</span><Button variant="flat" onSelect={resetFilters}>Clear filters</Button></div>}</div>
  <div className={styles.footer}><Toggle label="Unfinished only" value={filters.unfinishedOnly} onChange={unfinishedOnly => setFilters({ ...filters, unfinishedOnly })}/><Button variant="flat" onSelect={geometry.reset}>Reset window</Button></div></>}
  {creating && <div className={styles.detailView}><NewEditor deadlineMode={deadlineMode} realToday={realToday} gameToday={gameToday} onCancel={() => setCreating(false)} onCreate={create}/></div>}
  {selected && <div className={styles.detailView}><Editor key={selected.id} entry={selected} deadlineMode={deadlineMode} realToday={realToday} gameToday={gameToday} onBack={() => { trigger(Binding.group, Binding.selectEntry, 0); setDetailId(null); }} onDelete={payload => requestDelete(selected.id, payload)}/></div>}
  {undoAvailable && <div className={styles.undoToast}><span>Entry deleted</span><Button variant="flat" onSelect={undo}>Undo</Button></div>}
  {issues.length > 0 && <div className={styles.issues}><Button variant="flat" onSelect={() => setShowIssues(!showIssues)}>Data issues ({issues.length}) {showIssues ? "-" : "+"}</Button>{showIssues && <DataIssuesPanel issues={issues}/>}</div>}
  <div className={styles.resizeHandle} onMouseDown={geometry.startResize}></div>
  </>}
 </div></Panel>;
}
function ReadOnlyNotice({ issues }: { issues: DataIssueView[] }) {
    return <div className={styles.readOnlyNotice} role="alert"><strong>Planboard data needs a newer compatible version</strong><p>Editing is disabled and Planboard will block saving this city to prevent replacing its data.</p><p>Quit without saving, install the Planboard version that created this city, and load it again. If you must save first, make a backup and verify the game preserves disabled-mod data before disabling Planboard.</p><DataIssuesPanel issues={issues}/></div>;
}
function DataIssuesPanel({ issues }: { issues: DataIssueView[] }) {
    return <div className={styles.dataIssuesPanel}>{issues.map((issue, index) => <div key={`${issue.entryId}-${index}`} className={issue.severity === 1 ? styles.dataIssueError : styles.dataIssueWarning}><strong>{issue.severity === 1 ? "Error" : "Warning"}{issue.entryId > 0 ? ` · Entry #${issue.entryId}` : ""}</strong><span>{issue.message}</span>{issue.severity === 1 && <small>Restore a backup or use a compatible Planboard version before saving.</small>}</div>)}</div>;
}
function FilterPanel({ filters: f, deadlineMode, onChange }: {
    filters: Filters;
    deadlineMode: DeadlineMode;
    onChange: (filters: Filters) => void;
}) { const { kindLabels: k, categoryLabels: c, statusLabels: s, priorityLabels: p } = usePlanboardLocale(), all = { label: "All", value: -1 }; return <div className={styles.filters}><Choice label="Kind" value={f.kind} onChange={kind => onChange({ ...f, kind })} options={[all, ...k.map((label, value) => ({ label, value }))]}/><Choice label="Category" value={f.category} onChange={category => onChange({ ...f, category })} options={[all, ...c.map((label, value) => ({ label, value }))]}/><Choice label="Status" value={f.status} onChange={status => onChange({ ...f, status })} options={[all, ...s.map((label, value) => ({ label, value }))]}/><Choice label="Priority" value={f.priority} onChange={priority => onChange({ ...f, priority })} options={[all, ...p.map((label, value) => ({ label, value, tone: value === EntryPriority.None ? "none" : value === EntryPriority.Low ? "low" : value === EntryPriority.Medium ? "medium" : "high" }))]}/><Choice label="Location" value={f.location} onChange={location => onChange({ ...f, location })} options={[{ label: "All", value: "all" }, { label: "Located", value: "located" }, { label: "List-only", value: "list" }]}/><Choice label="Sort" value={f.sort} onChange={sort => onChange({ ...f, sort })} options={[{ label: "Recently updated", value: "updated" }, { label: "Priority", value: "priority" }, { label: "Category", value: "category" }, { label: deadlineMode === "game" ? "In-game deadline" : "Real-life deadline", value: "deadline" }]}/><Toggle label="Unfinished only" value={f.unfinishedOnly} onChange={unfinishedOnly => onChange({ ...f, unfinishedOnly })}/><Toggle label="Overdue only" value={f.overdueOnly} onChange={overdueOnly => onChange({ ...f, overdueOnly })}/><Toggle label="Missing links" value={f.missingLinksOnly} onChange={missingLinksOnly => onChange({ ...f, missingLinksOnly })}/><Button variant="flat" onSelect={() => onChange(baseFilters)}>Reset</Button></div>; }
function EntryRow({ entry, category, kindLabel, statusLabel, highlighted, onOpen, onDelete }: {
    entry: EntryView;
    category: string;
    kindLabel: string;
    statusLabel: string;
    highlighted: boolean;
    onOpen: () => void;
    onDelete: () => void;
}) { const [menu, setMenu] = useState(false), [editing, setEditing] = useState(false), [title, setTitle] = useState(entry.title); const openTimer = useRef<number | null>(null); useEffect(() => () => { if (openTimer.current !== null) window.clearTimeout(openTimer.current); }, []); const scheduleOpen = () => { if (openTimer.current !== null) window.clearTimeout(openTimer.current); openTimer.current = window.setTimeout(() => { openTimer.current = null; onOpen(); }, 220); }; const beginRename = () => { if (openTimer.current !== null) window.clearTimeout(openTimer.current); openTimer.current = null; setEditing(true); }; const saveTitle = () => { const value = title.trim(); setEditing(false); if (value && value !== entry.title)
    trigger(Binding.group, Binding.updateEntry, entry.id, value, entry.description, entry.kind, entry.category, entry.categoryName, entry.status, entry.priority, entry.realDueDateTicks, entry.gameDueDateTicks); }; return <div className={`${styles.taskRow} ${entry.status === EntryStatus.Done ? styles.taskDone : ""} ${highlighted ? styles.taskHighlight : ""}`}>{editing ? <input autoFocus className={styles.rowRename} value={title} onChange={e => setTitle(e.target.value)} onBlur={saveTitle} onKeyDown={e => { if (e.key === "Enter")
    saveTitle(); if (e.key === "Escape") {
    setTitle(entry.title);
    setEditing(false);
} }}/> : <Button variant="flat" className={styles.rowOpen} onSelect={scheduleOpen} onDoubleClick={beginRename}><span className={`${styles.kindBadge} ${entry.kind === EntryKind.Issue ? styles.kindIssue : entry.kind === EntryKind.Idea ? styles.kindIdea : styles.kindNote}`}><KindIcon kind={entry.kind}/></span><span className={styles.taskMain}><strong>{entry.title}</strong><span>{kindLabel} - {category}</span></span><span className={styles.rowStatus} title={statusLabel}><StatusIcon status={entry.status}/>{statusLabel}</span></Button>}<Button variant="flat" className={styles.rowMenuButton} onSelect={() => setMenu(!menu)}>...</Button>{menu && <div className={styles.rowMenu}><Button variant="flat" onSelect={() => { setMenu(false); entry.hasLocation ? trigger(Binding.group, Binding.navigateToEntry, entry.id) : trigger(Binding.group, Binding.beginPlacement, entry.id); }}>{entry.hasLocation ? "View pin" : "Add pin"}</Button><Button variant="flat" onSelect={() => { setMenu(false); onDelete(); }}>Delete</Button></div>}</div>; }
const calendarMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const calendarWeekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function calendarDate(value: string) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
}
function calendarInput(date: Date) {
    return `${date.getUTCFullYear().toString().padStart(4, "0")}-${(date.getUTCMonth() + 1).toString().padStart(2, "0")}-${date.getUTCDate().toString().padStart(2, "0")}`;
}
function calendarToday() { return calendarInput(new Date()); }
function calendarMonth(value: string) { return value.slice(0, 7); }
function addCalendarDays(value: string, days: number) {
    const next = calendarDate(value);
    next.setUTCDate(next.getUTCDate() + days);
    return calendarInput(next);
}
function DeadlineCalendar({ deadlineMode, value, currentDate, onChange, overlayHost }: {
    deadlineMode: DeadlineMode;
    value: string;
    currentDate: string;
    onChange: (value: string) => void;
    overlayHost: { current: HTMLDivElement | null };
}) {
    const reference = isValidDateInput(currentDate) ? currentDate : calendarToday();
    const [open, setOpen] = useState(false);
    const [monthKey, setMonthKey] = useState(() => calendarMonth(isValidDateInput(value) ? value : reference));
    useEffect(() => {
        if (!open) setMonthKey(calendarMonth(isValidDateInput(value) ? value : reference));
    }, [deadlineMode, reference, value, open]);
    const monthStart = calendarDate(`${monthKey}-01`);
    const monthIndex = monthStart.getUTCMonth();
    const firstCell = new Date(Date.UTC(monthStart.getUTCFullYear(), monthIndex, 1 - monthStart.getUTCDay()));
    const days = Array.from({ length: 42 }, (_, index) => {
        const date = new Date(firstCell.getTime());
        date.setUTCDate(firstCell.getUTCDate() + index);
        return { value: calendarInput(date), label: date.getUTCDate(), outside: date.getUTCMonth() !== monthIndex };
    });
    const changeMonth = (offset: number) => {
        const next = new Date(Date.UTC(monthStart.getUTCFullYear(), monthIndex + offset, 1));
        setMonthKey(calendarMonth(calendarInput(next)));
    };
    const label = deadlineMode === "game" ? "In-game deadline" : "Real-life deadline";
    const context = deadlineMode === "game" ? "City today" : "Today";
    const popup = open && overlayHost.current ? createPortal(<div className={styles.calendarOverlay} onMouseDown={() => setOpen(false)}>
      <div className={styles.calendarPanel} onMouseDown={event => event.stopPropagation()}>
        <div className={styles.calendarHeader}><Button variant="flat" onSelect={() => changeMonth(-1)}>&lt;</Button><strong>{calendarMonths[monthIndex]} {monthStart.getUTCFullYear()}</strong><Button variant="flat" onSelect={() => changeMonth(1)}>&gt;</Button></div>
        <div className={styles.calendarWeekdays}>{calendarWeekdays.map(day => <span key={day}>{day}</span>)}</div>
        <div className={styles.calendarWeeks}>{Array.from({ length: 6 }, (_, week) => <div key={week}>{days.slice(week * 7, week * 7 + 7).map(day => <Button key={day.value} variant="flat" selected={day.value === value} className={`${styles.calendarDay} ${day.outside ? styles.calendarOutside : ""} ${day.value === reference ? styles.calendarToday : ""} ${day.value === value ? styles.calendarSelected : ""}`} onSelect={() => { onChange(day.value); setOpen(false); }}>{day.label}</Button>)}</div>)}</div>
        <div className={styles.calendarFooter}><span>{context}: {reference}</span><div><Button variant="flat" onSelect={() => { onChange(reference); setOpen(false); }}>{deadlineMode === "game" ? "City today" : "Today"}</Button>{deadlineMode === "game" && <Button variant="flat" onSelect={() => { onChange(addCalendarDays(reference, 7)); setOpen(false); }}>Next week</Button>}<Button variant="flat" onSelect={() => { onChange(""); setOpen(false); }}>Clear</Button></div></div>
      </div>
    </div>, overlayHost.current) : null;
    return <div className={styles.deadlineCalendar}><span>{label}</span><Button variant="flat" aria-label={label} title={`Set ${label}`} className={styles.deadlineTrigger} onSelect={() => setOpen(!open)}><span className={styles.calendarGlyph} aria-hidden="true"></span><span>{value ? `${deadlineMode === "game" ? "City" : "Real"} · ${value}` : "No deadline"}</span><span>{open ? "-" : "+"}</span></Button>{popup}</div>;
}
function NewEditor({ deadlineMode, realToday, gameToday, onCancel, onCreate }: {
    deadlineMode: DeadlineMode;
    realToday: string;
    gameToday: string;
    onCancel: () => void;
    onCreate: (title: string, description: string, kind: EntryKind, category: EntryCategory, categoryName: string, status: EntryStatus, priority: EntryPriority, realDueTicks: string, gameDueTicks: string, place: boolean) => string | null;
}) {
    const { kindLabels: k, categoryLabels: c, statusLabels: s, priorityLabels: p } = usePlanboardLocale();
    const [title, setTitle] = useState(""), [description, setDescription] = useState(""), [kind, setKind] = useState(EntryKind.Task), [category, setCategory] = useState(EntryCategory.General), [categoryName, setCategoryName] = useState(""), [status, setStatus] = useState(EntryStatus.Open), [priority, setPriority] = useState(EntryPriority.None), [real, setReal] = useState(""), [game, setGame] = useState(""), [error, setError] = useState<string | null>(null);
    const overlayHost = useRef<HTMLDivElement>(null);
    const submit = (place: boolean) => {
        const cleanTitle = title.trim();
        if (!cleanTitle) {
            setError("Give this item a title first.");
            return;
        }
        if ((real && !isValidDateInput(real)) || (game && !isValidDateInput(game))) {
            setError("Use a valid date in YYYY-MM-DD format.");
            return;
        }
        setError(onCreate(cleanTitle, description, kind, category, categoryName, status, priority, dateInputToTicks(real), dateInputToTicks(game), place));
    };
    return <div ref={overlayHost} className={styles.editorShell} onKeyDown={event => {
        if (event.key === "Escape") onCancel();
        if (event.key === "Enter" && event.ctrlKey) {
            event.preventDefault();
            submit(true);
        }
    }}><div className={styles.detailTopbar}><Button variant="flat" onSelect={onCancel}>&lt; Planboard</Button><span className={styles.newLabel}>New item</span></div><div className={styles.editor}>
      <input aria-label="Title" className={styles.titleInput} value={title} maxLength={160} placeholder="What needs attention?" onChange={event => { setTitle(event.target.value); setError(null); }} onKeyDown={event => {
        if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            submit(event.ctrlKey);
        }
      }}/>
      {error && <div className={styles.createError}>{error}</div>}
      <div className={styles.locationCard}><div className={styles.locationInfo}><span className={styles.pinGlyph}>P</span><span className={styles.locationText}><strong>Not yet placed on the map</strong><span>Create and immediately choose its location</span></span></div><div className={styles.locationActions}><Button variant="flat" title="Create and place on map (Ctrl+Enter)" onSelect={() => submit(true)}>Create &amp; place</Button></div></div>
      <div className={styles.grid}><KindPicker value={kind} labels={k} onChange={setKind}/><div className={styles.categoryDeadline}><CategoryPicker value={category} custom={categoryName} labels={c} onChange={setCategory} onCustom={setCategoryName}/><DeadlineCalendar deadlineMode={deadlineMode} value={deadlineMode === "game" ? game : real} currentDate={deadlineMode === "game" ? gameToday : realToday} onChange={value => deadlineMode === "game" ? setGame(value) : setReal(value)} overlayHost={overlayHost}/></div><StatusPicker value={status} labels={s} onChange={setStatus}/><Segmented label="Priority" value={priority} onChange={value => setPriority(value as EntryPriority)} options={p.map((label, value) => ({ label, value }))}/></div>
      <div className={styles.field}><span>Description</span><textarea aria-label="Description" className={styles.descriptionInput} value={description} maxLength={4000} onChange={event => setDescription(event.target.value)}/></div>
    </div><div className={styles.createActions}><Button variant="flat" onSelect={onCancel}>Cancel</Button><Button variant="primary" title="Create item (Enter)" onSelect={() => submit(false)}>Create item</Button></div></div>;
}
function Editor({ entry, deadlineMode, realToday, gameToday, onBack, onDelete }: {
    entry: EntryView;
    deadlineMode: DeadlineMode;
    realToday: string;
    gameToday: string;
    onBack: () => void;
    onDelete: (payload: EditorPayload) => void;
}) { const { kindLabels: k, categoryLabels: c, statusLabels: s, priorityLabels: p } = usePlanboardLocale(); const [title, setTitle] = useState(entry.title), [description, setDescription] = useState(entry.description), [kind, setKind] = useState(entry.kind), [category, setCategory] = useState(entry.category), [categoryName, setCategoryName] = useState(entry.categoryName), [status, setStatus] = useState(entry.status), [priority, setPriority] = useState(entry.priority), [real, setReal] = useState(ticksToDateInput(entry.realDueDateTicks)), [game, setGame] = useState(ticksToDateInput(entry.gameDueDateTicks));
    const overlayHost = useRef<HTMLDivElement>(null);
    const initialPayload = useRef([entry.title, entry.description, entry.kind, entry.category, entry.categoryName, entry.status, entry.priority, entry.realDueDateTicks, entry.gameDueDateTicks]);
    const latestPayload = useRef(initialPayload.current);
    const savedPayload = useRef(JSON.stringify(initialPayload.current));
    const invalidDate = (real && !isValidDateInput(real)) || (game && !isValidDateInput(game));
    latestPayload.current = [title, description, kind, category, categoryName, status, priority, real && !isValidDateInput(real) ? entry.realDueDateTicks : dateInputToTicks(real), game && !isValidDateInput(game) ? entry.gameDueDateTicks : dateInputToTicks(game)];
    const persist = (payload: (string | number)[]) => {
        if (!String(payload[0]).trim() || invalidDate)
            return;
        const signature = JSON.stringify(payload);
        if (signature === savedPayload.current)
            return;
        trigger(Binding.group, Binding.updateEntry, entry.id, ...payload);
        savedPayload.current = signature;
    };
    useEffect(() => {
        const timer = window.setTimeout(() => persist(latestPayload.current), 350);
        return () => window.clearTimeout(timer);
    }, [title, description, kind, category, categoryName, status, priority, real, game]);
    useEffect(() => () => persist(latestPayload.current), []);
    const locationContext = entry.hasDistrict ? "Pinned in a district" : entry.linkState === LinkState.Valid ? "Pinned to a city object" : "Pinned to map"; return <div ref={overlayHost} className={styles.editorShell}><div className={styles.detailTopbar}><Button variant="flat" onSelect={onBack}>&lt; Planboard</Button><Button variant="flat" className={styles.deleteButton} onSelect={() => onDelete(latestPayload.current)}>Delete</Button></div><div className={styles.editor}><input aria-label="Title" className={styles.titleInput} value={title} maxLength={160} onChange={e => setTitle(e.target.value)}/><div className={styles.locationCard}><div className={styles.locationInfo}><span className={styles.pinGlyph}>P</span><span className={styles.locationText}><strong>{entry.hasLocation ? locationContext : "Not yet placed on the map"}</strong><span>{entry.hasLocation ? `Map coordinates ${Math.round(entry.x)}, ${Math.round(entry.z)}` : "Add a pin to give this entry spatial context"}</span></span></div><div className={styles.locationActions}>{entry.hasLocation && <Button variant="flat" onSelect={() => trigger(Binding.group, Binding.navigateToEntry, entry.id)}>View</Button>}<Button variant="flat" onSelect={() => trigger(Binding.group, Binding.beginPlacement, entry.id)}>{entry.hasLocation ? "Move" : "Place on map"}</Button></div></div><div className={styles.grid}><KindPicker value={kind} labels={k} onChange={setKind}/><div className={styles.categoryDeadline}><CategoryPicker value={category} custom={categoryName} labels={c} onChange={setCategory} onCustom={setCategoryName}/><DeadlineCalendar deadlineMode={deadlineMode} value={deadlineMode === "game" ? game : real} currentDate={deadlineMode === "game" ? gameToday : realToday} onChange={value => deadlineMode === "game" ? setGame(value) : setReal(value)} overlayHost={overlayHost}/></div><StatusPicker value={status} labels={s} onChange={setStatus}/><Segmented label="Priority" value={priority} onChange={v => setPriority(v as EntryPriority)} options={p.map((label, value) => ({ label, value }))}/></div><div className={styles.field}><span>Description</span><textarea aria-label="Description" className={styles.descriptionInput} value={description} maxLength={4000} onChange={e => setDescription(e.target.value)}/></div>{entry.hasLocation && <Button variant="flat" className={styles.removePin} onSelect={() => trigger(Binding.group, Binding.removeLocation, entry.id)}>Remove map pin</Button>}</div><div className={styles.autosave}><span></span>Changes save automatically</div></div>; }
