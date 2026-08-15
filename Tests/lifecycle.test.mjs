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

// A map pin starts as a neutral, disposable Note so location can be chosen before metadata.
test("direct map-pin placement opens a focused, discardable draft", async () => {
  const toolbar = await read("../UI/src/components/ToggleButton.tsx");
  const draft = await read("../UI/src/components/DraftNotePanel.tsx");
  const draftStyles = await read("../UI/src/components/draftNote.module.scss");
  const escape = await read("../UI/src/components/useEscapeDismissal.ts");
  const mainPanel = await read("../UI/src/components/MainPanel.tsx");
  const editors = await read("../UI/src/components/TaskEditors.tsx");
  const mainStyles = await read("../UI/src/components/mainPanel.module.scss");

  assert.match(toolbar, /Binding\.createPinnedDraft, EntryKind\.Task/);
  assert.match(toolbar, /continuousPlacement \? "Add more pins" : "Place map pin"/);
  assert.doesNotMatch(toolbar, /kindPalette|setPaletteOpen/);
  assert.match(draft, /window\.setTimeout\(\(\) => titleRef\.current\?\.focus\(\), 0\)/);
  assert.match(draft, /Discard this unsaved pin\?/);
  assert.match(draft, /if \(hasChanges\) \{\s*setConfirmDiscard\(true\)/);
  assert.match(draft, /aria-label="Close draft"/);
  assert.match(draft, /showCloseHint=\{false\}/);
  assert.match(draft, /if \(confirmDiscard\) \{\s*discard\(\)/);
  assert.match(draftStyles, /\.discardConfirmation > button \+ button/);
  assert.match(draftStyles, /\.actions > button,/);
  assert.doesNotMatch(draftStyles, /\.actions > \*,/);
  assert.match(escape, /InputActionConsumer/);
  assert.match(escape, /Gameface resolves input from the deepest active surface/);
  assert.match(escape, /EscapeDismissalScope/);
  assert.match(escape, /Gameface resolves input from the deepest active surface/);
  assert.match(mainPanel, /<EscapeDismissalScope>/);
  assert.match(escape, /"Pause Menu": dispatchBack/);
  assert.match(escape, /ignoreFocusState: true/);
  assert.match(escape, /event\.currentTarget\.blur\(\)/);
  assert.match(mainPanel, /aria-label="Close Planboard"/);
  assert.match(mainPanel, /onSelect=\{dispatchBack\}/);
  assert.match(mainPanel, /showCloseHint=\{false\}/);
  assert.match(draft, /Keep editing/);
  assert.match(editors, /Discard this unsaved task\?/);
  assert.match(editors, /const hasChanges =/);
  assert.match(editors, /useEscapeDismissal\(80/);
  assert.match(editors, />\s*Save\s*<\/Button>/);
  assert.match(mainStyles, /\.categoryTrigger > span:last-child\s*\{\s*margin-left: auto/);
  assert.match(mainStyles, /\.createActions > button\s*\{\s*@include tokens\.action-button/);
  assert.match(escape, /right\.priority - left\.priority/);
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

// District quick-add supplies a known location, then deliberately enters the same transient
// draft lifecycle as a terrain pin instead of saving a placeholder task immediately.
test("district quick-add opens a linked, focused transient draft", async () => {
  const ui = await read("../Code/UI/TaskUISystem.cs");
  const tool = await read("../Code/Tools/TaskPlacementToolSystem.cs");
  const action = await read("../UI/src/components/DistrictAction.tsx");
  const index = await read("../UI/src/index.tsx");

  assert.match(
    ui,
    /CreateEntry\("New note", EntryKind\.Task, EntryCategory\.General, transient: true\)/,
  );
  assert.match(ui, /SetLocation\(id, position, district, district, markerMoved: false\)/);
  assert.match(ui, /_placement\.CompleteKnownPlacement\(id\)/);
  assert.match(ui, /_draftEntryId = id;[\s\S]*SelectedEntryId = id;[\s\S]*_panelVisible = false;/);
  assert.match(
    ui,
    /if \(_draftEntryId > 0 \|\| _createPlacementEntryId > 0 \|\| _placement\.EntryId > 0\)/,
  );
  assert.match(tool, /public bool CompleteKnownPlacement\(int entryId\)/);
  assert.match(tool, /State = PlacementState\.Applied;[\s\S]*Enabled = false;/);
  assert.match(
    tool,
    /if \(m_ToolSystem\.activeTool == this\) m_ToolSystem\.activeTool = m_DefaultToolSystem;/,
  );
  assert.match(action, /districtSelected\$/);
  assert.match(action, /districtEntries\$/);
  assert.match(action, /DistrictEmpty/);
  assert.match(action, /Binding\.selectEntry/);
  assert.match(action, /Binding\.createDistrictEntry/);
  assert.match(action, /t\("AddDistrict", "Add note"\)/);
  assert.match(index, /selectedInfoSectionComponents/);
  assert.match(index, /District quick-add is unavailable after a game UI change\./);
});

// The inspector owns just the separator that leads into the next native section. Adding
// hairlines above and below it made the extension look unlike the rest of the inspector.
test("district inspector section uses one native-like boundary and readable task rows", async () => {
  const styles = await read("../UI/src/components/districtAction.module.scss");

  assert.match(styles, /\.section\s*\{[^}]*padding:\s*12rem 16rem 16rem/);
  assert.match(
    styles,
    /\.section::after\s*\{[^}]*right:\s*-16rem[^}]*left:\s*-16rem[^}]*background-color:\s*rgba\(255, 255, 255, 0\.11\)/s,
  );
  assert.match(styles, /\.entry\s*\{[^}]*min-height:\s*42rem/);
  assert.match(styles, /\.kindBadge\s*\{[^}]*margin-right:\s*12rem/);
  assert.match(styles, /\.entryText\s*\{[^}]*gap:\s*2rem/);
});

// Pin placement keeps the whole task form in one place while reserving the popup for less
// common categories. Icon-only actions leave room for the useful recent choices on one line.
test("draft keeps direct details with compact custom and full-list category actions", async () => {
  const draft = await read("../UI/src/components/DraftNotePanel.tsx");
  assert.match(draft, /compactDraftCategoryChoices\(/);
  assert.match(draft, /categoryTouched \? \{ category, custom: customCategory \} : undefined/);
  assert.match(draft, /\n        3,/);
  assert.match(draft, /aria-label="Create custom category"/);
  assert.match(draft, /aria-label="Show all categories"/);
  assert.match(draft, /const \[customCategoryOpen, setCustomCategoryOpen\]/);
  assert.match(draft, /customCategoryRef\.current\?\.focus\(\)/);
  assert.match(draft, /<CategoryMenu[\s\S]*includeCustomInput=\{false\}/);
  assert.match(draft, /<PriorityPicker value=\{priority\} labels=\{priorityLabels\}/);
  assert.match(draft, /placeholder="Title"/);
  assert.match(draft, /placeholder="Description \(optional\)"/);
  assert.match(draft, /if \(categoryMenuOpen\)[\s\S]*setCategoryMenuOpen\(false\)/);
  assert.doesNotMatch(draft, /More details|Fewer details|Other…/);
  const editors = await read("../UI/src/components/TaskEditors.tsx");
  const controls = await read("../UI/src/components/EntryControls.tsx");
  const draftStyles = await read("../UI/src/components/draftNote.module.scss");
  assert.match(editors, /<PriorityPicker value=\{priority\} labels=\{p\}/);
  assert.match(editors, /placeholder="Title"/);
  assert.match(editors, /placeholder="Description \(optional\)"/);
  assert.match(controls, /export function CategoryMenu/);
  assert.match(controls, /createPortal\(/);
  assert.match(controls, /className=\{styles\.categoryOverlay\}/);
  assert.match(draftStyles, /\.customCategoryField/);
  assert.match(draftStyles, /\.categoryChips\s*\{[^}]*flex-wrap:\s*nowrap/);
  assert.match(draftStyles, /@include tokens\.panel-scrollbar/);
  assert.match(draftStyles, /\.content\s*\{[^}]*min-height:\s*0[^}]*flex:\s*1 1 auto/s);
  assert.match(draftStyles, /\.overlayHost\s*\{[^}]*height:\s*100%/);
  assert.match(draftStyles, /::placeholder\s*\{[^}]*opacity:\s*1/);
  assert.doesNotMatch(draftStyles, /\.otherCategory|\.moreDetails|\.detailsToggle/);
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
test("marker synchronization preserves one runtime entity per task location", async () => {
  const markers = await read("../Code/Systems/TaskMarkerSystem.cs");
  assert.match(markers, /Dictionary<MarkerKey, Entity> _markers/);
  assert.match(markers, /foreach \(TaskLocation location in entry\.Locations\)/);
  assert.match(markers, /new\(entry\.Id, location\.Id\)/);
  assert.match(markers, /_markers\.TryGetValue\(key/);
  assert.doesNotMatch(markers, /DestroyEntity\(_runtimeMarkerQuery\)/);
  assert.match(markers, /if \(desired\.Contains\(key\)\) continue/);
  assert.match(markers, /RefreshDistrictAnchors\(\);/);
  assert.match(markers, /_data\.GetResolvedPosition\(location\)/);
  assert.match(markers, /IsDistrict = location\.LinkedDistrict != Entity\.Null/);
});

// V3 stores several independent pins without losing the one-pin shape that V1/V2 saves used.
test("multiple task locations migrate safely and expose per-pin editor actions", async () => {
  const data = await read("../Code/Systems/TaskDataSystem.cs");
  const entry = await read("../Code/Data/TaskEntry.cs");
  const ui = await read("../Code/UI/TaskUISystem.cs");
  const tool = await read("../Code/Tools/TaskPlacementToolSystem.cs");
  const editor = await read("../UI/src/components/TaskEditors.tsx");
  const toolbar = await read("../UI/src/components/ToggleButton.tsx");
  const map = await read("../UI/src/components/MapNotesOverlay.tsx");
  const editorStyles = await read("../UI/src/components/mainPanel.module.scss");

  assert.match(data, /CurrentFormatVersion = 3/);
  assert.match(data, /entry\.Locations\.Add\(new TaskLocation/);
  assert.match(data, /writer\.Write\(entry\.Locations\.Count\)/);
  assert.match(ui, /Write\(writer, "locationCount", entry\.Locations\.Count\)/);
  assert.match(data, /public bool SetLocation\([^)]*int locationId = 0\)/);
  assert.match(data, /public bool RemoveLocation\(int id, int locationId = 0\)/);
  assert.match(entry, /List<TaskLocation> Locations = new\(\)/);
  assert.match(entry, /SyncLegacyLocation\(\)/);
  assert.match(editor, /Binding\.addLocation, entry\.id/);
  assert.match(editor, /Binding\.moveLocation, entry\.id, location\.id/);
  assert.match(editor, /Binding\.removeLocation, entry\.id, location\.id/);
  assert.match(editor, /Binding\.navigateToLocation, entry\.id, location\.id/);
  assert.match(map, /key=\{`\$\{entry\.id\}-\$\{marker\.locationId\}`\}/);
  assert.match(editor, /\+ Add more pins/);
  assert.doesNotMatch(editor, /Binding\.navigateToEntry, entry\.id/);
  assert.match(ui, /BeginPlacement\(id, continuous: true\)/);
  assert.match(tool, /public bool IsContinuousPlacement/);
  assert.match(
    tool,
    /bool keepPlacing = IsContinuousPlacement && !IsMarkerDragActive && LocationId == 0/,
  );
  assert.match(
    tool,
    /State = PlacementState\.ChoosingLocation;[\s\S]*PreviewEntity = Entity\.Null;[\s\S]*return;/,
  );
  assert.match(toolbar, /continuousPlacement/);
  assert.match(toolbar, />\s*Done\s*</);
  assert.match(
    editorStyles,
    /\.locationListOverflow\s*\{[^}]*height:\s*172rem[^}]*overflow-y:\s*scroll[^}]*panel-scrollbar/s,
  );
  assert.match(editor, /locations\.length > 4 \? \(/);
  assert.match(editor, /ariaLabel="Task pin list scrollbar"/);
  assert.match(
    editor,
    /viewportClassName=\{`\$\{styles\.locationList\} \$\{styles\.locationListOverflow\}`\}/,
  );
});

// Completing a task clears every map representation, while leaving the task safely
// available in the normal Planboard list and filters.
test("completed tasks are hidden from map pins, sticky notes, and world overlays", async () => {
  const ui = await read("../Code/UI/TaskUISystem.cs");
  const overlay = await read("../Code/Rendering/TaskMarkerOverlaySystem.cs");

  assert.match(ui, /if \(entry\.Status == EntryStatus\.Done \|\|/);
  assert.match(overlay, /if \(marker\.Status == EntryStatus\.Done\) continue;/);
});

// A district's geometry is owned by the game. Planboard derives its rendered location from
// that live geometry and keeps its stored coordinate only as a safe missing-link fallback.
test("district anchors resolve live centres without rewriting saved coordinates", async () => {
  const data = await read("../Code/Systems/TaskDataSystem.cs");
  const ui = await read("../Code/UI/TaskUISystem.cs");
  const editors = await read("../UI/src/components/TaskEditors.tsx");
  const map = await read("../UI/src/components/MapNotesOverlay.tsx");
  const list = await read("../UI/src/components/TaskList.tsx");
  const overlay = await read("../Code/Rendering/TaskMarkerOverlaySystem.cs");

  assert.match(data, /public bool TryGetDistrictCenter\(TaskEntry entry, out float3 center\)/);
  assert.match(data, /public float3 GetResolvedPosition\(TaskEntry entry\)/);
  assert.match(data, /public LinkState GetResolvedLinkState\(TaskEntry entry\)/);
  assert.match(ui, /private void WriteDistrictEntries\(IJsonWriter writer\)/);
  assert.match(ui, /_districtEntries\.Sort\(\(left, right\) => right\.UpdatedUtcTicks\.CompareTo/);
  assert.match(ui, /_projectedDistrictGroups/);
  assert.match(ui, /position\.y, position\.z/);
  assert.doesNotMatch(ui, /position\.y \+ 2f/);
  assert.match(ui, /GetNavigationAnchor\(_data\.GetResolvedPosition\(location\)\)/);
  assert.match(editors, /!hasDistrictLocation/);
  assert.match(map, /const districtClass = marker\.isDistrict \? styles\.district : ""/);
  assert.match(map, /const stackedClass = marker\.districtCount > 1/);
  assert.match(map, /styles\.districtCount/);
  assert.match(list, /entry\.hasDistrict \? styles\.districtBadge/);
  assert.match(overlay, /if \(marker\.IsDistrict\)/);
  assert.match(overlay, /HashSet<Entity> drawnDistricts/);
  assert.match(overlay, /drawnDistricts\.Add\(marker\.LinkedDistrict\)/);
  assert.match(overlay, /DrawDistrictOutline/);
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
  const styles = await read("../UI/src/components/mapNotesOverlay.module.scss");
  assert.match(styles, /\.alwaysOpen \.card\s*\{\s*display:\s*flex/);
  assert.match(styles, /\.anchor\.alwaysOpen\s*\{[^}]*z-index:\s*2/);
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
  assert.match(styles, /\.card\s*\{[^}]*box-sizing:\s*border-box[^}]*overflow:\s*hidden/);
  assert.match(
    styles,
    /\.cardHeader strong\s*\{[^}]*min-width:\s*0[^}]*flex:\s*1 1 auto[^}]*overflow-wrap:\s*anywhere/,
  );
  assert.match(styles, /\.meta > \*\s*\{[^}]*min-width:\s*0[^}]*text-overflow:\s*ellipsis/);
  assert.match(styles, /\.due,[\s\S]*\.overdue\s*\{[\s\S]*max-width:\s*78rem/);
});

// A map card is itself the open action, so repeating the status label wastes the limited
// map surface. A flex layout is deliberately used because it stays reliable in Gameface
// when sticky-note mode reveals cards that were initially hidden.
test("map note cards align kind badges with their title and metadata", async () => {
  const overlay = await read("../UI/src/components/MapNotesOverlay.tsx");
  const styles = await read("../UI/src/components/mapNotesOverlay.module.scss");
  assert.doesNotMatch(overlay, /StatusIcon/);
  assert.doesNotMatch(overlay, /metaSeparator|statusMeta/);
  assert.match(styles, /\.card\s*\{[^}]*flex-direction:\s*column/);
  assert.match(styles, /\.cardHeader\s*\{[^}]*display:\s*flex[^}]*align-items:\s*flex-start/);
  assert.match(styles, /\.cardKind\s*\{[^}]*flex:\s*0 0 30rem[^}]*margin-right:\s*8rem/);
  assert.match(styles, /\.meta\s*\{[^}]*margin-top:\s*5rem[^}]*padding-left:\s*38rem/);
});

// Dragging a map note must move the actual native marker, not leave a misleading screen-only
// offset. A small threshold keeps ordinary card and marker clicks as open actions.
test("map note drag uses the native placement preview and protects district anchors", async () => {
  const overlay = await read("../UI/src/components/MapNotesOverlay.tsx");
  const styles = await read("../UI/src/components/mapNotesOverlay.module.scss");
  const tool = await read("../Code/Tools/TaskPlacementToolSystem.cs");
  const ui = await read("../Code/UI/TaskUISystem.cs");

  assert.match(overlay, /const dragThreshold = 6/);
  assert.match(overlay, /moved < dragThreshold/);
  assert.match(overlay, /Binding\.beginMarkerDrag, id, locationId/);
  assert.match(overlay, /Binding\.finishMarkerDrag/);
  assert.match(overlay, /document\.addEventListener\("mousemove", updateGhost\)/);
  assert.match(overlay, /document\.addEventListener\("mouseup", finish\)/);
  assert.match(overlay, /const movable = !marker\.isDistrict/);
  assert.match(overlay, /suppressOpenId\.current === entry\.id/);
  assert.match(styles, /\.anchor\.dragging\s*\{[^}]*pointer-events:\s*none/);
  assert.match(styles, /\.movable\s*\{[^}]*cursor:\s*grab/);

  assert.match(tool, /public bool BeginMarkerDrag\(int entryId, int locationId\)/);
  assert.match(tool, /public void FinishMarkerDrag\(\)/);
  assert.match(tool, /if \(!IsMarkerDragActive && _applyPlacementAction\.WasPressedThisFrame\(\)/);
  assert.match(tool, /private void ApplyPreview\(\)/);
  assert.match(ui, /location\.LinkedDistrict != Entity\.Null/);
  assert.match(ui, /_placement\.BeginMarkerDrag\(id, locationId\)/);
});

test("main panel retains the restored taller default without overriding manual sizes", async () => {
  const geometry = await read("../UI/src/components/usePanelGeometry.ts");
  assert.match(geometry, /main: \{ width: 770, height: 815/);
  assert.match(
    geometry,
    /parsed\?\.height === 500[\s\S]*parsed\?\.height === 560[\s\S]*parsed\?\.height === 690[\s\S]*parsed\?\.height === 750[\s\S]*parsed\?\.height === 790[\s\S]*parsed\?\.height === 810/,
  );
  assert.match(
    geometry,
    /parsed\?\.width === 650[\s\S]*parsed\?\.width === 670[\s\S]*parsed\?\.width === 720/,
  );
});

test("navigation falls back to an invisible coordinate anchor when a marker is hidden", async () => {
  const ui = await read("../Code/UI/TaskUISystem.cs");
  assert.match(
    ui,
    /_markers\.TryGetMarker\(entryId, location\.Id, out Entity marker\)[\s\S]*GetNavigationAnchor\(_data\.GetResolvedPosition\(location\)\)/,
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
  assert.match(settings, /DateFormat \{ get; set; \} = IsoDateFormat/);
  assert.match(settings, /GetDateFormatOptions/);
  assert.match(settings, /SetDefaults\(\)[\s\S]*DeadlineMode = RealLifeDeadlineMode/);
  assert.match(settings, /Real-life calendar/);
  assert.match(panel, /deadlineMode === "game"/);
  assert.doesNotMatch(panel, /value: "realDue"|value: "gameDue"/);
  assert.match(overlay, /const overdue = deadlineMode === "game"/);
  assert.match(overlay, /formatDateInput\(dueDate, dateFormat\)/);
  assert.match(panel, /dateFormat=\{dateFormat\}/);
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

// Every bounded content surface uses the same scrollbar mixin. Panel chrome and
// map cards deliberately stay fixed so they cannot turn into cramped scroll panes.
test("forms, menus, calendars, and district rows reveal overflow consistently", async () => {
  const panel = await read("../UI/src/components/mainPanel.module.scss");
  const draft = await read("../UI/src/components/draftNote.module.scss");
  const district = await read("../UI/src/components/districtAction.module.scss");
  const surface = await read("../UI/src/components/ScrollableSurface.tsx");

  assert.match(panel, /\.editor\s*\{[^}]*overflow-y:\s*scroll[^}]*panel-scrollbar/s);
  assert.match(panel, /\.locationListOverflow\s*\{[^}]*overflow-y:\s*scroll[^}]*panel-scrollbar/s);
  assert.match(panel, /\.categoryMenu\s*\{[^}]*overflow-y:\s*scroll[^}]*panel-scrollbar/s);
  assert.match(
    panel,
    /\.calendarOverlay \.calendarPanel\s*\{[^}]*overflow-y:\s*scroll[^}]*panel-scrollbar/s,
  );
  assert.match(
    panel,
    /\.choiceMenu\s*\{[^}]*max-height:\s*240rem[^}]*overflow-y:\s*scroll[^}]*panel-scrollbar/s,
  );
  assert.match(draft, /\.sticky\s*\{[^}]*overflow-y:\s*scroll[^}]*panel-scrollbar/s);
  assert.match(district, /\.entries\s*\{[^}]*overflow-y:\s*scroll[^}]*panel-scrollbar/s);
  assert.match(surface, /role="scrollbar"/);
  assert.match(surface, /onWheel=\{scrollWithWheel\}/);
  assert.match(surface, /parent editor can keep scrolling/);
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

test("marker projection groups district locations while retaining a reusable output buffer", async () => {
  const ui = await read("../Code/UI/TaskUISystem.cs");
  assert.match(ui, /readonly List<ProjectedLocation> _projectedLocations/);
  assert.match(ui, /readonly Dictionary<Entity, List<ProjectedLocation>> _projectedDistrictGroups/);
  assert.match(
    ui,
    /_projectedLocations\.Clear\(\)[\s\S]*_projectedDistrictGroups\.Clear\(\)[\s\S]*_projectedLocations\.AddRange\(_projectedStandaloneLocations\)[\s\S]*foreach \(ProjectedLocation projected in _projectedLocations\)/,
  );
  assert.match(ui, /Write\(writer, "locationId", location\.Id\)/);
  assert.match(ui, /Write\(writer, "districtCount", districtCount\)/);
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
  assert.match(toolbar, /Binding\.createPinnedDraft, EntryKind\.Task/);
  assert.doesNotMatch(toolbar, /kindPalette|setPaletteOpen/);
  assert.doesNotMatch(toolbar, /\? "PIN"/);
  assert.match(styles, /\.footerButtonNeutral \{\s*background-color: transparent/);
  assert.match(toolbar, /src=\{pinIcon\}/);
  assert.match(toolbar, /src=\{notepadIcon\}/);
  assert.match(styles, /\.footerButton > img,/);
  assert.match(styles, /stroke: rgba\(228, 242, 248, 0\.9\)/);
  assert.match(styles, /\.footerButton > img[\s\S]*pointer-events: none/);
  assert.match(
    styles,
    /\.footerButton\.footerButtonActive \{\s*background-color: rgba\(13, 65, 79, 0\.96\)/,
  );
  assert.match(styles, /\.footerButton\.visibilityButton[\s\S]*background-color: transparent/);
  assert.match(styles, /\.footerGroup \{[\s\S]*border-radius: tokens\.\$radius-pill/);
  assert.match(
    styles,
    /\.footerButton \{[\s\S]*width: 32rem[\s\S]*border-radius: tokens\.\$radius-circle/,
  );
  assert.doesNotMatch(styles, /kindPalette/);
  assert.doesNotMatch(styles, /\.displayControl > span/);
  assert.match(styles, /\.topLeftGroup \{[\s\S]*height: 42rem[\s\S]*margin: 0 8rem 0 0/);
  assert.match(
    styles,
    /\.topLeftGroup \.footerButton \{[\s\S]*width: 34rem[\s\S]*border-radius: tokens\.\$radius-control/,
  );
});

// Planboard follows the native CS2 type ladder so the game UI scale changes every
// readable surface together. Only icon glyphs retain a literal size.
test("typography follows native CS2 sizing with readable contrast floors", async () => {
  const tokens = await read("../UI/src/styles/_tokens.scss");
  const styles = await readUi(
    "../UI/src/components/compatibilityNotice.module.scss",
    "../UI/src/components/districtAction.module.scss",
    "../UI/src/components/draftNote.module.scss",
    "../UI/src/components/mainPanel.module.scss",
    "../UI/src/components/mapNotesOverlay.module.scss",
    "../UI/src/components/mapToolbar.module.scss",
  );

  assert.match(tokens, /\$font-overline: var\(--fontSizeXXS, 10rem\)/);
  assert.match(tokens, /\$font-meta: var\(--fontSizeXS, 12rem\)/);
  assert.match(tokens, /\$font-control: var\(--fontSizeS, 14rem\)/);
  assert.match(tokens, /\$font-body: calc\(var\(--fontSizeM, 16rem\) \+ 2rem\)/);
  assert.match(tokens, /\$font-section-title: var\(--fontSizeXL, 20rem\)/);
  assert.match(tokens, /\$font-panel-title: var\(--fontSizeXXL, 22rem\)/);
  assert.match(tokens, /\$task-row-height: 52rem/);
  assert.match(tokens, /\$control-height: 36rem/);
  assert.match(tokens, /\$map-card-min-width: 220rem/);
  assert.match(styles, /height: tokens\.\$task-row-height/);
  assert.match(styles, /height: tokens\.\$calendar-day-height/);
  assert.match(styles, /width: tokens\.\$map-card-min-width/);

  const literalFontSizes = [...styles.matchAll(/font-size:\s*(\d+rem)/g)].map(([, value]) => value);
  assert.deepEqual(literalFontSizes.sort(), ["15rem", "22rem", "24rem", "24rem"]);

  const parseHex = (value) =>
    [value.slice(1, 3), value.slice(3, 5), value.slice(5, 7)].map((part) =>
      Number.parseInt(part, 16),
    );
  const composite = (foreground, alpha, background) =>
    foreground.map((channel, index) => channel * alpha + background[index] * (1 - alpha));
  const luminance = (rgb) => {
    const [red, green, blue] = rgb.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return red * 0.2126 + green * 0.7152 + blue * 0.0722;
  };
  const contrast = (foreground, background) => {
    const first = luminance(foreground);
    const second = luminance(background);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  };

  // The panel's semi-transparent surface is least favourable over a bright map.
  const panel = composite(parseHex("#0a1720"), 0.96, [255, 255, 255]);
  const primary = parseHex("#f4f9fc");
  const secondary = composite(parseHex("#dcedf5"), 0.58, panel);
  const mapCard = composite(parseHex("#111d25"), 0.98, [255, 255, 255]);
  const cardTitle = parseHex("#edf4f7");
  const cardMeta = composite(parseHex("#b8ccd5"), 0.68, mapCard);
  const warningSurface = composite(parseHex("#322511"), 0.98, [255, 255, 255]);
  const warningText = parseHex("#ffe2a6");
  const selectedText = parseHex("#08202b");
  const selectedSurface = parseHex("#eaf7fc");
  assert.ok(contrast(primary, panel) >= 4.5);
  assert.ok(contrast(secondary, panel) >= 4.5);
  assert.ok(contrast(cardTitle, mapCard) >= 4.5);
  assert.ok(contrast(cardMeta, mapCard) >= 4.5);
  assert.ok(contrast(warningText, warningSurface) >= 4.5);
  assert.ok(contrast(selectedText, selectedSurface) >= 4.5);
  assert.match(styles, /\.taskDone \{\s*opacity: 1/);
  assert.match(styles, /\.done \{\s*opacity: 1/);
});

test("obsolete collapsed deadline options styles are removed", async () => {
  const styles = await read("../UI/src/components/mainPanel.module.scss");
  assert.doesNotMatch(styles, /\.moreOptions|\.moreBody/);
});
