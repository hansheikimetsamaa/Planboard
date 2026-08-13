import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Source-level regression checks protect engine-facing behaviour that cannot run
// inside Node. Each assertion names a deliberate contract rather than an implementation detail.
const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const readUi = async (...paths) => (await Promise.all(paths.map(read))).join("\n");

// Placement drafts must either become a valid saved entry or disappear completely.
test("unfinished placement drafts are transient and excluded from saves", async () => {
  const data = await read("../Code/Systems/TaskDataSystem.cs");
  const ui = await read("../Code/UI/TaskUISystem.cs");
  assert.match(data, /_transientEntryIds/);
  assert.match(data, /Where\(entry => !_transientEntryIds\.Contains\(entry\.Id\)\)/);
  assert.match(ui, /CreateEntry\(title, kind, EntryCategory\.General, transient: true\)/);
  assert.match(ui, /CommitTransientEntry\(_createPlacementEntryId\)/);
});

// Tool shutdown is also the cancellation path when another CS2 tool takes ownership.
test("switching tools cancels an unfinished placement without replacing the newly active tool", async () => {
  const tool = await read("../Code/Tools/TaskPlacementToolSystem.cs");
  const stopHandler = tool.match(
    /protected override void OnStopRunning\(\)[\s\S]*?\n        }\n\n        public override void InitializeRaycast/,
  );
  assert.ok(stopHandler, "OnStopRunning handler was not found");
  assert.match(stopHandler[0], /bool interruptedPlacement = EntryId > 0/);
  assert.match(stopHandler[0], /State = PlacementState\.Cancelled;[\s\S]*EntryId = 0;/);
  assert.doesNotMatch(stopHandler[0], /m_ToolSystem\.activeTool/);
});

// Planboard mirrors the game's scoped tool actions instead of registering global mouse shortcuts.
test("placement follows Traffic's scoped tool-action pattern", async () => {
  const settings = await read("../Code/Settings.cs");
  const mod = await read("../Code/Mod.cs");
  const tool = await read("../Code/Tools/TaskPlacementToolSystem.cs");

  assert.match(settings, /PlacementToolUsage = "Planboard\.Tool"/);
  assert.match(
    settings,
    /SettingsUIMouseAction\([\s\S]*ApplyPlacementAction[\s\S]*PlacementToolUsage/,
  );
  assert.match(settings, /UseVanillaToolBindings/);
  assert.match(
    settings,
    /SettingsUIDisableByCondition\(typeof\(Settings\), nameof\(UseVanillaToolBindings\)\)/,
  );
  assert.match(settings, /SettingsUITabOrder\(GeneralTab, KeybindingsTab\)/);
  assert.match(
    settings,
    /SettingsUISection\(KeybindingsTab, ToolsSection\)[\s\S]*UseVanillaToolBindings/,
  );
  assert.match(settings, /SettingsUISection\(KeybindingsTab, ToolsSection\)[\s\S]*ApplyPlacement/);
  assert.match(settings, /SettingsUISection\(KeybindingsTab, ToolsSection\)[\s\S]*CancelPlacement/);
  assert.doesNotMatch(settings, /SettingsUIBindingMimic/);
  assert.match(settings, /RegisterPlacementBindingMirror\("Apply", ApplyPlacementAction\)/);
  assert.match(
    settings,
    /RegisterPlacementBindingMirror\("Secondary Apply", CancelPlacementAction\)/,
  );
  assert.match(settings, /Apply tool action/);
  assert.match(settings, /Cancel tool action/);
  assert.match(mod, /Settings\.InitializePlacementBindings\(\)/);
  assert.match(mod, /Settings\?\.DisablePlacementBindingMirrors\(\)/);
  assert.match(tool, /_applyPlacementAction\.WasPressedThisFrame\(\)/);
  assert.match(tool, /_cancelPlacementAction\.WasPressedThisFrame\(\)/);
  assert.match(tool, /cancelAction\.WasPressedThisFrame\(\)/);
  assert.match(tool, /SetActionEnabled\(_applyPlacementAction, true\)/);
});

// A newer save format must remain intact; replacing it with an empty older save would lose data.
test("unsupported save formats fail closed instead of serializing empty Planboard data", async () => {
  const data = await read("../Code/Systems/TaskDataSystem.cs");
  const ui = await read("../Code/UI/TaskUISystem.cs");
  const panel = await readUi(
    "../UI/src/components/MainPanel.tsx",
    "../UI/src/components/TaskEditors.tsx",
    "../UI/src/components/DataIssuesPanel.tsx",
    "../UI/src/components/FilterPanel.tsx",
    "../UI/src/components/TaskList.tsx",
    "../UI/src/components/DeadlineCalendar.tsx",
    "../UI/src/components/EntryControls.tsx",
  );
  assert.match(data, /public bool IsReadOnly => _unsupportedFormatVersion\.HasValue/);
  assert.match(data, /Refusing to save an empty replacement/);
  assert.match(data, /_pendingValidation = false;[\s\S]*Touch\(\);[\s\S]*return;/);
  assert.match(data, /if \(!IsReadOnly\) _pendingValidation = true;/);
  assert.match(ui, /UIBindingConstants\.DataReadOnly/);
  assert.match(panel, /readOnly \? \([\s\S]*<ReadOnlyNotice issues=\{issues\}/);
});

// The editor and draft flows cross the C# binding boundary, so keep their transaction rules explicit.
test("sticky save commits one complete backend transaction", async () => {
  const draft = await read("../UI/src/components/DraftNotePanel.tsx");
  const ui = await read("../Code/UI/TaskUISystem.cs");
  assert.match(draft, /Binding\.commitDraft/);
  assert.doesNotMatch(draft, /Binding\.updateEntry[\s\S]*Binding\.finishDraft/);
  assert.match(ui, /private void CommitDraft\(IJsonReader reader\)/);
});

// The draft editor keeps essential task fields visible instead of hiding them behind a secondary mode.
test("draft priority and description are direct form fields", async () => {
  const draft = await read("../UI/src/components/DraftNotePanel.tsx");
  const priorityIndex = draft.indexOf("<PriorityPicker");
  const descriptionIndex = draft.indexOf('aria-label="Description"');
  assert.ok(priorityIndex >= 0 && priorityIndex < descriptionIndex);
  assert.match(draft, /PriorityPicker value=\{priority\} labels=\{priorityLabels\}/);
  assert.doesNotMatch(draft, /Add details|showDetails|detailsToggle/);
  const editors = await read("../UI/src/components/TaskEditors.tsx");
  const draftStyles = await read("../UI/src/components/draftNote.module.scss");
  assert.match(editors, /<PriorityPicker value=\{priority\} labels=\{p\}/);
  assert.doesNotMatch(draftStyles, /^\.priority/m);
});

// Keep a mounted editor tied to its entry so a selection change cannot save into the wrong task.
test("entry editor identity and pending autosave are protected", async () => {
  const panel = await readUi(
    "../UI/src/components/MainPanel.tsx",
    "../UI/src/components/TaskEditors.tsx",
    "../UI/src/components/DataIssuesPanel.tsx",
    "../UI/src/components/FilterPanel.tsx",
    "../UI/src/components/TaskList.tsx",
    "../UI/src/components/DeadlineCalendar.tsx",
    "../UI/src/components/EntryControls.tsx",
  );
  assert.match(panel, /<Editor[\s\S]*key=\{selected\.id\}/);
  assert.match(panel, /useEffect\(\(\) => \(\) => persist\(latestPayload\.current\), \[\]\)/);
  assert.match(panel, /signature === savedPayload\.current/);
});

// Marker state spans ECS, the map overlay, and navigation. These checks prevent one surface
// from silently invalidating the others when marker behaviour changes.
test("marker synchronization preserves surviving marker entities", async () => {
  const markers = await read("../Code/Systems/TaskMarkerSystem.cs");
  assert.match(markers, /_markers\.TryGetValue\(entry\.Id/);
  assert.doesNotMatch(markers, /DestroyEntity\(_runtimeMarkerQuery\)/);
  assert.match(markers, /if \(desired\.Contains\(entryId\)\) continue/);
});

test("marker overlay uses direct GameSystemBase component handles", async () => {
  const overlay = await read("../Code/Rendering/TaskMarkerOverlaySystem.cs");
  assert.doesNotMatch(overlay, /SystemAPI\.GetComponentTypeHandle/);
  assert.match(overlay, /CompleteDependency\(\);/);
  assert.match(overlay, /GetComponentTypeHandle<RuntimeTaskMarker>\(true\)/);
  assert.match(overlay, /GetComponentTypeHandle<Transform>\(true\)/);
});

// Map presentation must respect the selected display mode while navigation remains reliable.
test("map visibility modes remain authoritative and do not force selected notes open", async () => {
  const overlay = await read("../UI/src/components/MapNotesOverlay.tsx");
  const ui = await read("../Code/UI/TaskUISystem.cs");
  assert.match(overlay, /if \(mode === MapDisplayMode\.Hidden \|\| draftId > 0\) return null;/);
  assert.match(
    overlay,
    /const openClass = mode === MapDisplayMode\.Notes \? styles\.alwaysOpen : "";/,
  );
  assert.match(
    ui,
    /private void SetPanelVisible\(bool visible\)\s*\{\s*_panelVisible = visible;\s*if \(!visible\) SelectedEntryId = 0;\s*\}/,
  );
  assert.match(
    ui,
    /private void SelectEntry\(int id\)\s*\{\s*if \(id == 0\)\s*\{\s*SelectedEntryId = 0;\s*return;\s*\}/,
  );
});

test("map note titles wrap inside their cards", async () => {
  const styles = await read("../UI/src/components/mapNotesOverlay.module.scss");
  assert.match(styles, /\.card\s*\{[^}]*box-sizing:\s*border-box/);
  assert.match(
    styles,
    /\.cardHeader strong\s*\{[^}]*min-width:\s*0[^}]*flex:\s*1 1 auto[^}]*overflow-wrap:\s*anywhere/,
  );
});

test("main panel retains the restored taller default without overriding manual sizes", async () => {
  const geometry = await read("../UI/src/components/usePanelGeometry.ts");
  assert.match(geometry, /main: \{ width: 650, height: 750/);
  assert.match(
    geometry,
    /parsed\?\.height === 500 \|\| parsed\?\.height === 560 \|\| parsed\?\.height === 690/,
  );
});

test("navigation falls back to an invisible coordinate anchor when a marker is hidden", async () => {
  const ui = await read("../Code/UI/TaskUISystem.cs");
  assert.match(
    ui,
    /_markers\.TryGetMarker\(id, out Entity marker\) \? marker : GetNavigationAnchor\(entry\.Position\)/,
  );
  assert.match(ui, /_navigationAnchor = EntityManager\.CreateEntity\(\);/);
  assert.match(
    ui,
    /EntityManager\.AddComponentData\(_navigationAnchor, new Transform\(position, Unity\.Mathematics\.quaternion\.identity\)\)/,
  );
  assert.match(
    ui,
    /protected override void OnDestroy\(\)[\s\S]*EntityManager\.DestroyEntity\(_navigationAnchor\)/,
  );
});

// Data repair needs enough information for the player to recover safely, not just a log message.
test("data repair reports preserve severity, affected entry, and recovery guidance", async () => {
  const data = await read("../Code/Systems/TaskDataSystem.cs");
  const ui = await read("../Code/UI/TaskUISystem.cs");
  const panel = await readUi(
    "../UI/src/components/MainPanel.tsx",
    "../UI/src/components/TaskEditors.tsx",
    "../UI/src/components/DataIssuesPanel.tsx",
    "../UI/src/components/FilterPanel.tsx",
    "../UI/src/components/TaskList.tsx",
    "../UI/src/components/DeadlineCalendar.tsx",
    "../UI/src/components/EntryControls.tsx",
  );
  assert.match(data, /List<TaskDataIssue>/);
  assert.match(data, /AddIssue\(DataIssueSeverity\.Warning, entry\.Id/);
  assert.match(ui, /writer\.TypeBegin\("Planboard\.DataIssue"\)/);
  assert.match(panel, /DataIssuesPanel issues=\{issues\}/);
  assert.match(panel, /Restore a backup or use a compatible Planboard version before saving/);
});

// Accessibility is part of the UI contract because these controls combine icons with free-form text.
test("informational icons and free-form inputs have accessible names", async () => {
  const kind = await read("../UI/src/components/KindIcon.tsx");
  const status = await read("../UI/src/components/StatusIcon.tsx");
  const panel = await readUi(
    "../UI/src/components/MainPanel.tsx",
    "../UI/src/components/TaskEditors.tsx",
    "../UI/src/components/DataIssuesPanel.tsx",
    "../UI/src/components/FilterPanel.tsx",
    "../UI/src/components/TaskList.tsx",
    "../UI/src/components/DeadlineCalendar.tsx",
    "../UI/src/components/EntryControls.tsx",
  );
  assert.match(kind, /alt=""\s*aria-hidden="true"/);
  assert.match(status, /alt=""\s*aria-hidden="true"/);
  assert.match(panel, /aria-label="Title"/);
  assert.match(panel, /aria-label="Description"/);
  assert.match(panel, /aria-label=\{label\}/);
  assert.match(panel, /currentRealDate\$/);
  assert.match(panel, /currentGameDate\$/);
});

// Loading a city or deleting an entry must clear transient UI state before the next interaction.
test("delete and city load clear active transient state", async () => {
  const ui = await read("../Code/UI/TaskUISystem.cs");
  assert.match(
    ui,
    /if \(_placement\.EntryId == id\) _placement\.CancelPlacement\(\);[\s\S]*_data\.DeleteEntry\(id\)/,
  );
  assert.match(
    ui,
    /protected override void OnGameLoaded\(Context serializationContext\)[\s\S]*_draftEntryId = 0;[\s\S]*_deletedEntry = null;/,
  );
});

// The selected deadline preference changes presentation and sorting, never deletes the other date.
test("one preferred deadline mode drives the UI without deleting inactive dates", async () => {
  const settings = await read("../Code/Settings.cs");
  const panel = await readUi(
    "../UI/src/components/MainPanel.tsx",
    "../UI/src/components/TaskEditors.tsx",
    "../UI/src/components/DataIssuesPanel.tsx",
    "../UI/src/components/FilterPanel.tsx",
    "../UI/src/components/TaskList.tsx",
    "../UI/src/components/DeadlineCalendar.tsx",
    "../UI/src/components/EntryControls.tsx",
  );
  const overlay = await read("../UI/src/components/MapNotesOverlay.tsx");
  assert.match(settings, /Preferred deadline|GetDeadlineModeOptions/);
  assert.match(settings, /DeadlineMode \{ get; set; \} = RealLifeDeadlineMode/);
  assert.match(settings, /SetDefaults\(\)[\s\S]*DeadlineMode = RealLifeDeadlineMode/);
  assert.match(settings, /Real-life calendar/);
  assert.match(panel, /deadlineMode === "game"/);
  assert.doesNotMatch(panel, /value: "realDue"|value: "gameDue"/);
  assert.match(overlay, /const overdue = deadlineMode === "game"/);
  assert.match(panel, /dateInputToTicks\(real\),\s*dateInputToTicks\(game\)/);
});

// New entries use the same complete editor as saved entries, avoiding divergent form behaviour.
test("new items use the full detail editor instead of an inline composer", async () => {
  const panel = await readUi(
    "../UI/src/components/MainPanel.tsx",
    "../UI/src/components/TaskEditors.tsx",
    "../UI/src/components/DataIssuesPanel.tsx",
    "../UI/src/components/FilterPanel.tsx",
    "../UI/src/components/TaskList.tsx",
    "../UI/src/components/DeadlineCalendar.tsx",
    "../UI/src/components/EntryControls.tsx",
  );
  const ui = await read("../Code/UI/TaskUISystem.cs");
  assert.match(panel, /<NewEditor[\s\S]*deadlineMode=/);
  assert.doesNotMatch(panel, /showComposer|className=\{styles\.composer\}/);
  assert.match(panel, /Create &amp; place/);
  assert.match(ui, /reader\.GetArgumentsCount\(\) >= 10/);
});

// These checks cover UI registration and scrolling workarounds that depend on Gameface behaviour.
test("toolbar controls render immediately before the native Economy icon", async () => {
  const index = await read("../UI/src/index.tsx");
  assert.match(index, /toolbar\/top\/toggles\.tsx"[\s\S]*"EconomyPanelToggle"/);
  assert.match(
    index,
    /createElement\(MapToolbar\)[\s\S]*createElement\(EconomyPanelToggle, props\)/,
  );
  assert.doesNotMatch(index, /money-field|GameBottomRight|FooterMount/);
});

test("detail deletion snapshots the latest editor payload before removal", async () => {
  const panel = await readUi(
    "../UI/src/components/MainPanel.tsx",
    "../UI/src/components/TaskEditors.tsx",
    "../UI/src/components/DataIssuesPanel.tsx",
    "../UI/src/components/FilterPanel.tsx",
    "../UI/src/components/TaskList.tsx",
    "../UI/src/components/DeadlineCalendar.tsx",
    "../UI/src/components/EntryControls.tsx",
  );
  const ui = await read("../Code/UI/TaskUISystem.cs");
  assert.match(panel, /Binding\.deleteEntry,\s*id,\s*\.\.\.\(payload \?\? \[\]\)/);
  assert.match(
    ui,
    /private void DeleteEntry\(IJsonReader reader\)[\s\S]*_data\.UpdateEntry\([\s\S]*_deletedEntry = entry\.Clone\(\)/,
  );
});

test("overflowing task lists expose an interactive Gameface-safe scrollbar", async () => {
  const panel = await readUi(
    "../UI/src/components/MainPanel.tsx",
    "../UI/src/components/TaskEditors.tsx",
    "../UI/src/components/DataIssuesPanel.tsx",
    "../UI/src/components/FilterPanel.tsx",
    "../UI/src/components/TaskList.tsx",
    "../UI/src/components/DeadlineCalendar.tsx",
    "../UI/src/components/EntryControls.tsx",
  );
  const styles = await read("../UI/src/components/mainPanel.module.scss");
  assert.match(panel, /function ScrollableTaskList/);
  assert.match(panel, /metrics\.scrollHeight > metrics\.clientHeight \+ 1/);
  assert.match(panel, /role="scrollbar"/);
  assert.match(panel, /onWheel=\{scrollWithWheel\}/);
  assert.match(panel, /event\.deltaMode === 1 \? 32/);
  assert.match(styles, /\.taskScrollFrame\s*\{[^}]*min-height:\s*0[^}]*flex:\s*1 1 auto/);
  assert.match(styles, /\.taskScrollbarThumb\s*\{/);
});
test("large task lists render in bounded pages", async () => {
  const panel = await readUi(
    "../UI/src/components/MainPanel.tsx",
    "../UI/src/components/TaskEditors.tsx",
    "../UI/src/components/DataIssuesPanel.tsx",
    "../UI/src/components/FilterPanel.tsx",
    "../UI/src/components/TaskList.tsx",
    "../UI/src/components/DeadlineCalendar.tsx",
    "../UI/src/components/EntryControls.tsx",
  );
  assert.match(panel, /const listPageSize = 200/);
  assert.match(panel, /filtered\.slice\(0, visibleCount\)/);
  assert.match(panel, /useDeferredValue\(filters\.query\)/);
  assert.match(panel, /filterAndSort\(entries, effectiveFilters, deadlineMode\)/);
});

test("core UI registration survives a missing native toolbar hook", async () => {
  const index = await read("../UI/src/index.tsx");
  const notice = await read("../UI/src/components/CompatibilityNotice.tsx");
  assert.ok(
    index.indexOf('moduleRegistry.append("Game", MainPanel)') <
      index.indexOf("moduleRegistry.extend("),
  );
  assert.match(index, /native toolbar hook is unavailable/);
  assert.match(index, /reportCompatibilityIssue/);
  assert.match(notice, /Open Planboard/);
});

// Both toolbar hooks are registered so changing the setting is immediate, but only one may render.
test("toolbar location uses the supported top-left hook with a footer fallback", async () => {
  const index = await read("../UI/src/index.tsx");
  const toolbar = await read("../UI/src/components/ToggleButton.tsx");
  const styles = await read("../UI/src/components/mapToolbar.module.scss");
  const settings = await read("../Code/Settings.cs");
  const bindings = await read("../Code/Common/UIBindingConstants.cs");

  assert.match(index, /moduleRegistry\.append\("GameTopLeft", TopLeftToolbar\)/);
  assert.match(index, /createElement\(MapToolbar\)/);
  assert.match(toolbar, /export function TopLeftToolbar\(\)/);
  assert.match(toolbar, /toolbarLocation !== location/);
  assert.match(toolbar, /location === "topLeft" \? styles\.topLeftGroup : styles\.footerGroup/);
  assert.match(styles, /\.footerGroup \{[\s\S]*height: 38rem/);
  assert.match(styles, /\.topLeftGroup \{[\s\S]*height: 42rem/);
  assert.match(toolbar, /const buttonVariant = location === "topLeft" \? "floating" : "flat"/);
  assert.match(settings, /ToolbarLocation \{ get; set; \} = TopLeftToolbarLocation/);
  assert.match(settings, /GetToolbarLocationOptions/);
  assert.match(bindings, /ToolbarLocation = "toolbarLocation"/);
});

// Input affordances must remain reachable after component extraction or styling changes.
test("search and double-click rename have reachable UI paths", async () => {
  const panel = await readUi(
    "../UI/src/components/MainPanel.tsx",
    "../UI/src/components/TaskEditors.tsx",
    "../UI/src/components/DataIssuesPanel.tsx",
    "../UI/src/components/FilterPanel.tsx",
    "../UI/src/components/TaskList.tsx",
    "../UI/src/components/DeadlineCalendar.tsx",
    "../UI/src/components/EntryControls.tsx",
  );
  assert.match(panel, /className=\{styles\.searchInput\}[\s\S]*query: event\.target\.value/);
  assert.match(panel, /const scheduleOpen[\s\S]*window\.setTimeout/);
  assert.match(panel, /const beginRename[\s\S]*window\.clearTimeout[\s\S]*setEditing\(true\)/);
});

test("marker projection filters entries once into a reusable buffer", async () => {
  const ui = await read("../Code/UI/TaskUISystem.cs");
  assert.match(ui, /readonly List<TaskEntry> _projectedEntries/);
  assert.match(
    ui,
    /_projectedEntries\.Clear\(\)[\s\S]*_projectedEntries\.Add\(entry\)[\s\S]*foreach \(TaskEntry entry in _projectedEntries\)/,
  );
});

test("map selection clears focus without clearing an active placement or UI-driven entry edit", async () => {
  const ui = await read("../Code/UI/TaskUISystem.cs");
  assert.match(ui, /else if \(_placement\.EntryId == 0\)\s*\{\s*SelectedEntryId = 0;\s*\}/);
  assert.match(
    ui,
    /SelectedEntryId = id;\s*_panelVisible = true;\s*_lastSelectedEntity = _toolSystem\.selected;/,
  );
});

// Menus use shared overlay dismissal semantics so only one temporary surface is active at a time.
test("filters use explicit dropdown menus rather than cycling through options", async () => {
  const controls = await read("../UI/src/components/EntryControls.tsx");
  const styles = await read("../UI/src/components/mainPanel.module.scss");
  const panel = await readUi(
    "../UI/src/components/MainPanel.tsx",
    "../UI/src/components/TaskEditors.tsx",
    "../UI/src/components/DataIssuesPanel.tsx",
    "../UI/src/components/FilterPanel.tsx",
    "../UI/src/components/TaskList.tsx",
    "../UI/src/components/DeadlineCalendar.tsx",
    "../UI/src/components/EntryControls.tsx",
  );
  assert.match(controls, /const \[open, setOpen\] = useState\(false\);/);
  assert.match(controls, /className=\{styles\.choiceMenu\}/);
  assert.doesNotMatch(controls, /options\[\(index \+ 1\)/);
  assert.match(panel, /tone:\s*value === EntryPriority\.None/);
  assert.match(styles, /\.choiceMenu > button\.priorityHigh/);
  assert.match(styles, /\.filters\s*\{[^}]*z-index:\s*20[^}]*overflow:\s*visible/);
  assert.match(panel, /className=\{styles\.filterGrid\}/);
  assert.match(panel, /className=\{styles\.quickFilterRow\}/);
  assert.match(panel, /className=\{styles\.quickFilterButtons\}/);
  assert.match(controls, /aria-pressed=\{value\}/);
  assert.match(controls, /className=\{styles\.toggleIndicator\}/);
  assert.doesNotMatch(controls, /\[x\]|\[ \]/);
  assert.match(styles, /\.toggleActive \.toggleIndicator:after/);
  assert.match(panel, /With pin location/);
  assert.match(panel, /Only in list/);
});

test("editor metadata overlays share dismissal and exclusivity state", async () => {
  const editors = await read("../UI/src/components/TaskEditors.tsx");
  const controls = await read("../UI/src/components/EntryControls.tsx");
  const calendar = await read("../UI/src/components/DeadlineCalendar.tsx");

  assert.match(editors, /type MetadataOverlay = "category" \| "deadline" \| null/);
  assert.match(editors, /onMouseDown=\{\(\) => setMetadataOverlay\(null\)\}/);
  assert.match(editors, /open=\{metadataOverlay === "category"\}/);
  assert.match(editors, /open=\{metadataOverlay === "deadline"\}/);
  assert.match(controls, /onOpenChange: \(open: boolean\) => void/);
  assert.match(controls, /onMouseDown=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.match(calendar, /onOpenChange: \(open: boolean\) => void/);
  assert.match(calendar, /calendarOverlay} onMouseDown=\{\(\) => onOpenChange\(false\)\}/);
});

// Styling checks protect interaction rules that are easy to regress while changing visual polish.
test("toolbar keeps inactive controls legible while reserving colour for active state", async () => {
  const toolbar = await read("../UI/src/components/ToggleButton.tsx");
  const styles = await read("../UI/src/components/mapToolbar.module.scss");
  assert.match(toolbar, /styles\.footerButtonNeutral/);
  assert.match(toolbar, /styles\.footerButtonActive/);
  assert.match(toolbar, /if \(placing \|\| draftId > 0\) setPaletteOpen\(false\);/);
  assert.match(styles, /\.footerButtonNeutral \{/);
  assert.match(toolbar, /src=\{pinIcon\}/);
  assert.match(toolbar, /src=\{notepadIcon\}/);
  assert.match(styles, /\.footerButton > img,/);
  assert.match(styles, /stroke: rgba\(228, 242, 248, 0\.9\)/);
  assert.match(styles, /\.footerButton > img[\s\S]*pointer-events: none/);
  assert.match(styles, /\.footerButtonActive \{/);
  assert.match(styles, /\.footerGroup \{[\s\S]*border-radius: tokens\.\$radius-pill/);
  assert.match(
    styles,
    /\.footerButton \{[\s\S]*width: 32rem[\s\S]*border-radius: tokens\.\$radius-circle/,
  );
  assert.match(styles, /\.topLeftGroup \.kindPalette \{[\s\S]*top: 46rem[\s\S]*bottom: auto/);
  assert.match(styles, /\.topLeftGroup \{[\s\S]*height: 42rem[\s\S]*margin: 0 8rem 0 0/);
  assert.match(
    styles,
    /\.topLeftGroup \.footerButton \{[\s\S]*width: 34rem[\s\S]*border-radius: tokens\.\$radius-control/,
  );
});

test("obsolete collapsed deadline options styles are removed", async () => {
  const styles = await read("../UI/src/components/mainPanel.module.scss");
  assert.doesNotMatch(styles, /\.moreOptions|\.moreBody/);
});
