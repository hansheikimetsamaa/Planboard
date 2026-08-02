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
});

test("core UI registration survives a missing native toolbar hook", async () => {
  const index = await read("../UI/src/index.tsx");
  assert.ok(index.indexOf('moduleRegistry.append("Game", MainPanel)') < index.indexOf('moduleRegistry.extend('));
  assert.match(index, /native toolbar hook is unavailable/);
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