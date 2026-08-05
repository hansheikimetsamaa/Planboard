import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("unfinished placement drafts are transient and excluded from saves", async () => {
  const data = await read("../Code/Systems/TaskDataSystem.cs");
  const ui = await read("../Code/UI/TaskUISystem.cs");
  assert.match(data, /_transientEntryIds/);
  assert.match(data, /Where\(entry => !_transientEntryIds\.Contains\(entry\.Id\)\)/);
  assert.match(ui, /CreateEntry\(title, kind, EntryCategory\.General, transient: true\)/);
  assert.match(ui, /CommitTransientEntry\(_createPlacementEntryId\)/);
});

test("switching tools cancels an unfinished placement without replacing the newly active tool", async () => {
  const tool = await read("../Code/Tools/TaskPlacementToolSystem.cs");
  const stopHandler = tool.match(/protected override void OnStopRunning\(\)[\s\S]*?\n        }\n\n        private static void SetActionEnabled/);
  assert.ok(stopHandler, "OnStopRunning handler was not found");
  assert.match(stopHandler[0], /bool interruptedPlacement = EntryId > 0/);
  assert.match(stopHandler[0], /State = PlacementState\.Cancelled;[\s\S]*EntryId = 0;/);
  assert.doesNotMatch(stopHandler[0], /m_ToolSystem\.activeTool/);
});

test("unsupported save formats fail closed instead of serializing empty Planboard data", async () => {
  const data = await read("../Code/Systems/TaskDataSystem.cs");
  const ui = await read("../Code/UI/TaskUISystem.cs");
  const panel = await read("../UI/src/components/MainPanel.tsx");
  assert.match(data, /public bool IsReadOnly => _unsupportedFormatVersion\.HasValue/);
  assert.match(data, /Refusing to save an empty replacement/);
  assert.match(data, /_pendingValidation = false;[\s\S]*Touch\(\);[\s\S]*return;/);
  assert.match(data, /if \(!IsReadOnly\) _pendingValidation = true;/);
  assert.match(ui, /UIBindingConstants\.DataReadOnly/);
  assert.match(panel, /readOnly \? <ReadOnlyNotice issues=\{issues\}/);
});

test("sticky save commits one complete backend transaction", async () => {
  const draft = await read("../UI/src/components/DraftNotePanel.tsx");
  const ui = await read("../Code/UI/TaskUISystem.cs");
  assert.match(draft, /Binding\.commitDraft/);
  assert.doesNotMatch(draft, /Binding\.updateEntry[\s\S]*Binding\.finishDraft/);
  assert.match(ui, /private void CommitDraft\(IJsonReader reader\)/);
});

test("entry editor identity and pending autosave are protected", async () => {
  const panel = await read("../UI/src/components/MainPanel.tsx");
  assert.match(panel, /<Editor key=\{selected\.id\}/);
  assert.match(panel, /useEffect\(\(\) => \(\) => persist\(latestPayload\.current\), \[\]\)/);
  assert.match(panel, /signature === savedPayload\.current/);
});

test("marker synchronization preserves surviving marker entities", async () => {
  const markers = await read("../Code/Systems/TaskMarkerSystem.cs");
  assert.match(markers, /_markers\.TryGetValue\(entry\.Id/);
  assert.doesNotMatch(markers, /DestroyEntity\(_runtimeMarkerQuery\)/);
  assert.match(markers, /if \(desired\.Contains\(entryId\)\) continue/);
});

test("navigation falls back to an invisible coordinate anchor when a marker is hidden", async () => {
  const ui = await read("../Code/UI/TaskUISystem.cs");
  assert.match(ui, /_markers\.TryGetMarker\(id, out Entity marker\) \? marker : GetNavigationAnchor\(entry\.Position\)/);
  assert.match(ui, /_navigationAnchor = EntityManager\.CreateEntity\(\);/);
  assert.match(ui, /EntityManager\.AddComponentData\(_navigationAnchor, new Transform\(position, Unity\.Mathematics\.quaternion\.identity\)\)/);
  assert.match(ui, /if \(EntityManager\.Exists\(_navigationAnchor\)\) EntityManager\.DestroyEntity\(_navigationAnchor\)/);
});

test("data repair reports preserve severity, affected entry, and recovery guidance", async () => {
  const data = await read("../Code/Systems/TaskDataSystem.cs");
  const ui = await read("../Code/UI/TaskUISystem.cs");
  const panel = await read("../UI/src/components/MainPanel.tsx");
  assert.match(data, /List<TaskDataIssue>/);
  assert.match(data, /AddIssue\(DataIssueSeverity\.Warning, entry\.Id/);
  assert.match(ui, /writer\.TypeBegin\("Planboard\.DataIssue"\)/);
  assert.match(panel, /DataIssuesPanel issues=\{issues\}/);
  assert.match(panel, /Restore a backup or use a compatible Planboard version before saving/);
});

test("informational icons and free-form inputs have accessible names", async () => {
  const kind = await read("../UI/src/components/KindIcon.tsx");
  const status = await read("../UI/src/components/StatusIcon.tsx");
  const panel = await read("../UI/src/components/MainPanel.tsx");
  assert.match(kind, /alt="" aria-hidden="true"/);
  assert.match(status, /alt="" aria-hidden="true"/);
  assert.match(panel, /aria-label="Title"/);
  assert.match(panel, /aria-label="Description"/);
  assert.match(panel, /aria-label="Real-life deadline"/);
});

test("delete and city load clear active transient state", async () => {
  const ui = await read("../Code/UI/TaskUISystem.cs");
  assert.match(ui, /if \(_placement\.EntryId == id\) _placement\.CancelPlacement\(\);[\s\S]*_data\.DeleteEntry\(id\)/);
  assert.match(ui, /protected override void OnGameLoaded\(Context serializationContext\)[\s\S]*_draftEntryId = 0;[\s\S]*_deletedEntry = null;/);
});
test("one preferred deadline mode drives the UI without deleting inactive dates", async () => {
  const settings = await read("../Code/Settings.cs");
  const panel = await read("../UI/src/components/MainPanel.tsx");
  const overlay = await read("../UI/src/components/MapNotesOverlay.tsx");
  assert.match(settings, /Preferred deadline|GetDeadlineModeOptions/);
  assert.match(panel, /deadlineMode === "game"/);
  assert.doesNotMatch(panel, /value: "realDue"|value: "gameDue"/);
  assert.match(overlay, /const overdue = deadlineMode === "game"/);
  assert.match(panel, /dateInputToTicks\(real\), dateInputToTicks\(game\)/);
});
test("new items use the full detail editor instead of an inline composer", async () => {
  const panel = await read("../UI/src/components/MainPanel.tsx");
  const ui = await read("../Code/UI/TaskUISystem.cs");
  assert.match(panel, /<NewEditor deadlineMode=/);
  assert.doesNotMatch(panel, /showComposer|className=\{styles\.composer\}/);
  assert.match(panel, /Create &amp; place/);
  assert.match(ui, /reader\.GetArgumentsCount\(\) >= 10/);
});

test("toolbar controls render immediately before the native Economy icon", async () => {
  const index = await read("../UI/src/index.tsx");
  assert.match(index, /toolbar\/top\/toggles\.tsx"[\s\S]*"EconomyPanelToggle"/);
  assert.match(index, /createElement\(MapToolbar\)[\s\S]*createElement\(EconomyPanelToggle, props\)/);
  assert.doesNotMatch(index, /money-field|GameBottomRight|FooterMount/);
});

test("detail deletion snapshots the latest editor payload before removal", async () => {
  const panel = await read("../UI/src/components/MainPanel.tsx");
  const ui = await read("../Code/UI/TaskUISystem.cs");
  assert.match(panel, /Binding\.deleteEntry, id, \.\.\.\(payload \?\? \[\]\)/);
  assert.match(ui, /private void DeleteEntry\(IJsonReader reader\)[\s\S]*_data\.UpdateEntry\([\s\S]*_deletedEntry = entry\.Clone\(\)/);
});

test("large task lists render in bounded pages", async () => {
  const panel = await read("../UI/src/components/MainPanel.tsx");
  assert.match(panel, /const listPageSize = 200/);
  assert.match(panel, /filtered\.slice\(0, visibleCount\)/);
  assert.match(panel, /useDeferredValue\(filters\.query\)/);
  assert.match(panel, /useMemo\(\(\) => filterAndSort/);
});

test("core UI registration survives a missing native toolbar hook", async () => {
  const index = await read("../UI/src/index.tsx");
  const notice = await read("../UI/src/components/CompatibilityNotice.tsx");
  assert.ok(index.indexOf('moduleRegistry.append("Game", MainPanel)') < index.indexOf('moduleRegistry.extend('));
  assert.match(index, /native toolbar hook is unavailable/);
  assert.match(index, /reportCompatibilityIssue/);
  assert.match(notice, /Open Planboard/);
});
test("search and double-click rename have reachable UI paths", async () => {
  const panel = await read("../UI/src/components/MainPanel.tsx");
  assert.match(panel, /className=\{styles\.searchInput\}[\s\S]*query: event\.target\.value/);
  assert.match(panel, /const scheduleOpen[\s\S]*window\.setTimeout/);
  assert.match(panel, /const beginRename[\s\S]*window\.clearTimeout[\s\S]*setEditing\(true\)/);
});

test("marker projection filters entries once into a reusable buffer", async () => {
  const ui = await read("../Code/UI/TaskUISystem.cs");
  assert.match(ui, /readonly List<TaskEntry> _projectedEntries/);
  assert.match(ui, /_projectedEntries\.Clear\(\)[\s\S]*_projectedEntries\.Add\(entry\)[\s\S]*foreach \(TaskEntry entry in _projectedEntries\)/);
});
