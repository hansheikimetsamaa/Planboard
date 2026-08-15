using System;
using System.Collections.Generic;
using System.Linq;
using Colossal.Serialization.Entities;
using Colossal.UI.Binding;
using Game;
using Game.Objects;
using Game.Rendering;
using Game.SceneFlow;
using Game.Simulation;
using Game.Tools;
using Game.UI;
using Planboard.Common;
using Planboard.Data;
using Planboard.Systems;
using Planboard.Tools;
using Unity.Entities;
// Coordinates the native UI binding contract, task selection, and placement lifecycle.

namespace Planboard.UI
{
    public partial class TaskUISystem : UISystemBase
    {
        private TaskDataSystem _data;
        private TaskMarkerSystem _markers;
        private TaskPlacementToolSystem _placement;
        private ToolSystem _toolSystem;
        private CameraUpdateSystem _camera;
        private TimeSystem _time;
        private RawValueBinding _entriesBinding;
        private RawValueBinding _districtEntriesBinding;
        private RawValueBinding _issuesBinding;
        private RawValueBinding _projectedMarkersBinding;
        private readonly List<ProjectedLocation> _projectedLocations = new();
        private readonly List<ProjectedLocation> _projectedStandaloneLocations = new();
        private readonly Dictionary<Entity, List<ProjectedLocation>> _projectedDistrictGroups = new();
        private readonly List<TaskEntry> _districtEntries = new();
        private Entity _lastSelectedEntity = Entity.Null;
        private int _districtSelectionRevision;
        private bool _panelVisible;
        private int _draftEntryId;
        private int _createPlacementEntryId;
        private int _returnToEditorAfterPlacementId;
        private TaskEntry _deletedEntry;
        private long _deleteUndoExpiresUtcTicks;
        private PlacementState _lastPlacementState = PlacementState.Inactive;
        private Entity _navigationAnchor = Entity.Null;
        public int SelectedEntryId { get; private set; }
        public int MapDisplayMode { get; private set; } = 1;
        protected override void OnCreate()
        {
            base.OnCreate();
            ResolveDependencies();
            RegisterValueBindings();
            RegisterActionBindings();
        }

        private void ResolveDependencies()
        {
            _data = World.GetOrCreateSystemManaged<TaskDataSystem>();
            _markers = World.GetOrCreateSystemManaged<TaskMarkerSystem>();
            _placement = World.GetOrCreateSystemManaged<TaskPlacementToolSystem>();
            _toolSystem = World.GetOrCreateSystemManaged<ToolSystem>();
            _camera = World.GetOrCreateSystemManaged<CameraUpdateSystem>();
            _time = World.GetOrCreateSystemManaged<TimeSystem>();
        }

        private void RegisterValueBindings()
        {
            // These names are the C# to Gameface contract. Keep their payloads and update
            // semantics aligned with UI/src/bindings.ts when adding or changing a binding.
            AddUpdateBinding(new GetterValueBinding<uint>(UIBindingConstants.Group, UIBindingConstants.Revision, () => _data.Revision));
            AddUpdateBinding(new GetterValueBinding<bool>(UIBindingConstants.Group, UIBindingConstants.PanelVisible, () => _panelVisible));
            AddUpdateBinding(new GetterValueBinding<int>(UIBindingConstants.Group, UIBindingConstants.SelectedEntryId, () => SelectedEntryId));
            AddUpdateBinding(new GetterValueBinding<int>(UIBindingConstants.Group, UIBindingConstants.PlacementState, () => (int)_placement.State));
            AddUpdateBinding(new GetterValueBinding<int>(UIBindingConstants.Group, UIBindingConstants.PlacementEntryId, () => _placement.EntryId));
            AddUpdateBinding(new GetterValueBinding<bool>(UIBindingConstants.Group, UIBindingConstants.ContinuousPlacement, () => _placement.IsContinuousPlacement));
            AddUpdateBinding(new GetterValueBinding<int>(UIBindingConstants.Group, UIBindingConstants.DraftEntryId, () => _draftEntryId));
            AddUpdateBinding(new GetterValueBinding<bool>(UIBindingConstants.Group, UIBindingConstants.DistrictSelected, IsDistrictSelected));
            AddUpdateBinding(
                new GetterValueBinding<int>(
                    UIBindingConstants.Group,
                    UIBindingConstants.DistrictSelectionRevision,
                    () => _districtSelectionRevision));
            AddUpdateBinding(new GetterValueBinding<int>(UIBindingConstants.Group, UIBindingConstants.MapDisplayMode, () => MapDisplayMode));
            AddUpdateBinding(new GetterValueBinding<bool>(UIBindingConstants.Group, UIBindingConstants.UndoAvailable, IsUndoAvailable));
            AddUpdateBinding(
                new GetterValueBinding<int>(
                    UIBindingConstants.Group,
                    UIBindingConstants.WindowLayoutRevision,
                    () => Mod.Settings.WindowLayoutRevision));
            AddUpdateBinding(
                new GetterValueBinding<string>(
                    UIBindingConstants.Group,
                    UIBindingConstants.DeadlineMode,
                    () => Mod.Settings.DeadlineMode == Settings.InGameDeadlineMode
                        ? Settings.InGameDeadlineMode
                        : Settings.RealLifeDeadlineMode));
            AddUpdateBinding(
                new GetterValueBinding<string>(
                    UIBindingConstants.Group,
                    UIBindingConstants.DateFormat,
                    () => Mod.Settings.DateFormat == Settings.DayMonthYearDateFormat
                        ? Settings.DayMonthYearDateFormat
                        : Mod.Settings.DateFormat == Settings.MonthDayYearDateFormat
                            ? Settings.MonthDayYearDateFormat
                            : Settings.IsoDateFormat));
            AddUpdateBinding(
                new GetterValueBinding<string>(
                    UIBindingConstants.Group,
                    UIBindingConstants.ToolbarLocation,
                    () => Mod.Settings.ToolbarLocation == Settings.FooterToolbarLocation
                        ? Settings.FooterToolbarLocation
                        : Settings.TopLeftToolbarLocation));
            AddUpdateBinding(
                new GetterValueBinding<string>(
                    UIBindingConstants.Group,
                    UIBindingConstants.CurrentRealDate,
                    () => DateTime.Today.ToString("yyyy-MM-dd")));
            AddUpdateBinding(
                new GetterValueBinding<string>(
                    UIBindingConstants.Group,
                    UIBindingConstants.CurrentGameDate,
                    () => _time.GetCurrentDateTime().Date.ToString("yyyy-MM-dd")));
            AddUpdateBinding(new GetterValueBinding<bool>(UIBindingConstants.Group, UIBindingConstants.DataReadOnly, () => _data.IsReadOnly));
            AddUpdateBinding(_entriesBinding = new RawValueBinding(UIBindingConstants.Group, UIBindingConstants.Entries, WriteEntries));
            AddUpdateBinding(
                _districtEntriesBinding = new RawValueBinding(
                    UIBindingConstants.Group,
                    UIBindingConstants.DistrictEntries,
                    WriteDistrictEntries));
            AddUpdateBinding(_issuesBinding = new RawValueBinding(UIBindingConstants.Group, UIBindingConstants.DataIssues, WriteDataIssues));
            AddUpdateBinding(
                _projectedMarkersBinding = new RawValueBinding(
                    UIBindingConstants.Group,
                    UIBindingConstants.ProjectedMarkers,
                    WriteProjectedMarkers));
        }

        private void RegisterActionBindings()
        {
            // Actions form the reverse half of the UI contract: user intent enters the
            // data and placement systems only through these registered handlers.
            AddBinding(new RawTriggerBinding(UIBindingConstants.Group, UIBindingConstants.CreateEntry, CreateEntry));
            AddBinding(new TriggerBinding<int>(UIBindingConstants.Group, UIBindingConstants.CreatePinnedDraft, CreatePinnedDraft));
            AddBinding(new TriggerBinding<int>(UIBindingConstants.Group, UIBindingConstants.FinishDraft, FinishDraft));
            AddBinding(new RawTriggerBinding(UIBindingConstants.Group, UIBindingConstants.CommitDraft, CommitDraft));
            AddBinding(new TriggerBinding<int>(UIBindingConstants.Group, UIBindingConstants.DiscardDraft, DiscardDraft));
            AddBinding(new RawTriggerBinding(UIBindingConstants.Group, UIBindingConstants.UpdateEntry, UpdateEntry));
            AddBinding(new RawTriggerBinding(UIBindingConstants.Group, UIBindingConstants.DeleteEntry, DeleteEntry));
            AddBinding(new RawTriggerBinding(UIBindingConstants.Group, UIBindingConstants.SetStatus, SetStatus));
            AddBinding(new TriggerBinding<int>(UIBindingConstants.Group, UIBindingConstants.ConvertIdea, ConvertIdea));
            AddBinding(new TriggerBinding<int>(UIBindingConstants.Group, UIBindingConstants.SelectEntry, SelectEntry));
            AddBinding(new TriggerBinding<int>(UIBindingConstants.Group, UIBindingConstants.BeginPlacement, BeginPlacement));
            AddBinding(new RawTriggerBinding(UIBindingConstants.Group, UIBindingConstants.AddLocation, BeginAdditionalLocation));
            AddBinding(new RawTriggerBinding(UIBindingConstants.Group, UIBindingConstants.MoveLocation, MoveLocation));
            AddBinding(new RawTriggerBinding(UIBindingConstants.Group, UIBindingConstants.BeginMarkerDrag, BeginMarkerDrag));
            AddBinding(new TriggerBinding(UIBindingConstants.Group, UIBindingConstants.FinishMarkerDrag, _placement.FinishMarkerDrag));
            AddBinding(new TriggerBinding(UIBindingConstants.Group, UIBindingConstants.CancelPlacement, _placement.CancelPlacement));
            AddBinding(new RawTriggerBinding(UIBindingConstants.Group, UIBindingConstants.RemoveLocation, RemoveLocation));
            AddBinding(new TriggerBinding(UIBindingConstants.Group, UIBindingConstants.CreateDistrictEntry, CreateDistrictEntry));
            AddBinding(new TriggerBinding<int>(UIBindingConstants.Group, UIBindingConstants.NavigateToEntry, NavigateToEntry));
            AddBinding(new RawTriggerBinding(UIBindingConstants.Group, UIBindingConstants.NavigateToLocation, NavigateToLocation));
            AddBinding(new TriggerBinding<bool>(UIBindingConstants.Group, UIBindingConstants.SetPanelVisible, SetPanelVisible));
            AddBinding(new TriggerBinding(UIBindingConstants.Group, UIBindingConstants.CycleMapDisplayMode, CycleMapDisplayMode));
            AddBinding(new TriggerBinding(UIBindingConstants.Group, UIBindingConstants.UndoDelete, UndoDelete));
        }

        protected override void OnDestroy()
        {
            if (EntityManager.Exists(_navigationAnchor))
            {
                EntityManager.DestroyEntity(_navigationAnchor);
            }

            base.OnDestroy();
        }

        protected override void OnUpdate()
        {
            base.OnUpdate();
            SynchronizePlacementState();
            ExpireUndoState();
            SynchronizeGameSelection();
        }

        private void SynchronizePlacementState()
        {
            PlacementState placementState = _placement.State;
            if (placementState == _lastPlacementState)
            {
                return;
            }

            if (_draftEntryId > 0 && placementState == PlacementState.Cancelled)
            {
                // A draft exists solely to support placement. Cancelling placement must not
                // leave an invisible, unsaved entry in the task list.
                DiscardDraft(_draftEntryId);
            }

            if (_createPlacementEntryId > 0 && placementState == PlacementState.Cancelled)
            {
                CancelCreatePlacement();
            }
            else if (_createPlacementEntryId > 0 && placementState == PlacementState.Applied)
            {
                CommitCreatePlacement();
            }

            if (_returnToEditorAfterPlacementId > 0 &&
                (placementState == PlacementState.Applied || placementState == PlacementState.Cancelled))
            {
                if (_data.Find(_returnToEditorAfterPlacementId) != null)
                {
                    SelectedEntryId = _returnToEditorAfterPlacementId;
                    _panelVisible = true;

                    // The native placement tool clears the game selection while it applies a
                    // pin. Treat that cleared selection as already handled so the normal
                    // selection synchronisation below does not immediately close the editor.
                    _lastSelectedEntity = _toolSystem.selected;
                }

                _returnToEditorAfterPlacementId = 0;
            }

            _lastPlacementState = placementState;
        }

        private void CancelCreatePlacement()
        {
            // Create & Place starts as a transient entry; discard it if the user backs out.
            _data.DeleteEntry(_createPlacementEntryId);
            if (SelectedEntryId == _createPlacementEntryId)
            {
                SelectedEntryId = 0;
            }

            _createPlacementEntryId = 0;
            _returnToEditorAfterPlacementId = 0;
            _panelVisible = true;
        }

        private void CommitCreatePlacement()
        {
            // Placement is the commit point for Create & Place, making the entry eligible
            // for serialization only after it has a confirmed location.
            _data.CommitTransientEntry(_createPlacementEntryId);
            SelectedEntryId = _createPlacementEntryId;
            _createPlacementEntryId = 0;
            _panelVisible = true;
        }

        private void ExpireUndoState()
        {
            // Keep the deleted snapshot only for the short undo window; retaining it longer
            // would make a stale restore available after the UI has moved on.
            if (_deletedEntry != null && !IsUndoAvailable())
            {
                _deletedEntry = null;
            }
        }

        private void SynchronizeGameSelection()
        {
            Entity selected = _toolSystem.selected;
            if (selected == _lastSelectedEntity)
            {
                return;
            }

            if (IsDistrict(_lastSelectedEntity) || IsDistrict(selected))
            {
                _districtSelectionRevision++;
            }

            _lastSelectedEntity = selected;
            if (selected != Entity.Null && EntityManager.Exists(selected) && EntityManager.HasComponent<RuntimeTaskMarker>(selected))
            {
                RuntimeTaskMarker marker = EntityManager.GetComponentData<RuntimeTaskMarker>(selected);
                SelectedEntryId = marker.EntryId;
                _panelVisible = true;
            }
            // During placement, the selected task remains the placement target even though
            // the tool clears the game's entity selection to receive terrain clicks.
            else if (_placement.EntryId == 0)
            {
                SelectedEntryId = 0;
            }
        }

        protected override void OnGameLoaded(Context serializationContext)
        {
            base.OnGameLoaded(serializationContext);
            ResetUiState();
        }

        private void ResetUiState()
        {
            if (_placement.EntryId > 0)
            {
                _placement.CancelPlacement();
            }

            _draftEntryId = 0;
            _createPlacementEntryId = 0;
            _returnToEditorAfterPlacementId = 0;
            _deletedEntry = null;
            _deleteUndoExpiresUtcTicks = 0;
            _lastPlacementState = PlacementState.Inactive;
            _lastSelectedEntity = Entity.Null;
            SelectedEntryId = 0;
            _panelVisible = false;
        }

        public void TogglePanel()
        {
            _panelVisible = !_panelVisible;

        }
        private void CycleMapDisplayMode()
        {
            MapDisplayMode = (MapDisplayMode + 1) % 3;

        }
        private void SetPanelVisible(bool visible)
        {
            _panelVisible = visible;
            if (!visible) SelectedEntryId = 0;

        }
        private bool IsDistrictSelected()
        {
            return IsDistrict(_toolSystem.selected);
        }

        private bool IsDistrict(Entity entity)
        {
            return entity != Entity.Null && EntityManager.Exists(entity) &&
                EntityManager.HasComponent<Game.Areas.District>(entity);
        }
        private void CreateEntry(IJsonReader reader)
        {
            if (reader.GetArgumentsCount() < 4)
            {
                Mod.Log.Warn("CreateEntry received too few UI arguments");
                return;

            }
            reader.Read(out string title);
            reader.Read(out int kind);
            reader.Read(out int category);
            reader.Read(out string customCategory);
            bool placeAfterCreate = false;
            if (reader.GetArgumentsCount() >= 5) reader.Read(out placeAfterCreate);
            string description = string.Empty;
            int status = (int)EntryStatus.Open;
            int priority = (int)EntryPriority.None;
            string realDueTicks = "0";
            string gameDueTicks = "0";
            if (reader.GetArgumentsCount() >= 10)
            {
                reader.Read(out description);
                reader.Read(out status);
                reader.Read(out priority);
                reader.Read(out realDueTicks);
                reader.Read(out gameDueTicks);

            }
            int id = _data.CreateEntry(title, (EntryKind)kind, (EntryCategory)category, customCategory, transient: placeAfterCreate);
            if (id <= 0) return;
            long.TryParse(realDueTicks, out long realTicks);
            long.TryParse(gameDueTicks, out long gameTicks);
            _data.UpdateEntry(
                id,
                title,
                description,
                (EntryKind)kind,
                (EntryCategory)category,
                customCategory,
                (EntryStatus)status,
                (EntryPriority)priority,
                realTicks,
                gameTicks);
            Mod.Log.Info($"Created task {id}: {title}");
            if (!placeAfterCreate)
            {
                SelectEntry(id);
                return;

            }
            _createPlacementEntryId = id;
            SelectedEntryId = id;
            _panelVisible = false;
            if (!_placement.BeginPlacement(id))
            {
                _data.DeleteEntry(id);
                _createPlacementEntryId = 0;
                SelectedEntryId = 0;
                _panelVisible = true;

            }

        }
        private void CreatePinnedDraft(int kindValue)
        {
            if (_draftEntryId > 0) return;
            EntryKind kind = kindValue >= (int)EntryKind.Issue && kindValue <= (int)EntryKind.Idea ? (EntryKind)kindValue : EntryKind.Task;
            string title = kind == EntryKind.Issue ? "New issue" : kind == EntryKind.Idea ? "New idea" : "New note";
            int id = _data.CreateEntry(title, kind, EntryCategory.General, transient: true);
            if (id == 0) return;
            _draftEntryId = id;
            SelectedEntryId = id;
            _panelVisible = false;
            if (!_placement.BeginPlacement(id))
            {
                _data.DeleteEntry(id);
                _draftEntryId = 0;
                SelectedEntryId = 0;

            }
            else
            {
                Mod.Log.Info($"Started pinned {kind} draft {id}");

            }

        }
        private void FinishDraft(int id)
        {
            if (id != _draftEntryId || !_data.CommitTransientEntry(id)) return;
            _draftEntryId = 0;
            SelectedEntryId = 0;
            _panelVisible = false;
            Mod.Log.Info($"Finished pinned draft {id}");

        }
        private void CommitDraft(IJsonReader reader)
        {
            if (reader.GetArgumentsCount() < 10) return;
            reader.Read(out int id);
            reader.Read(out string title);
            reader.Read(out string description);
            reader.Read(out int kind);
            reader.Read(out int category);
            reader.Read(out string customCategory);
            reader.Read(out int status);
            reader.Read(out int priority);
            reader.Read(out string realDueTicks);
            reader.Read(out string gameDueTicks);
            long.TryParse(realDueTicks, out long realTicks);
            long.TryParse(gameDueTicks, out long gameTicks);
            if (id != _draftEntryId || !_data.IsTransientEntry(id)) return;
            if (!_data.UpdateEntry(
                id,
                title,
                description,
                (EntryKind)kind,
                (EntryCategory)category,
                customCategory,
                (EntryStatus)status,
                (EntryPriority)priority,
                realTicks,
                gameTicks)) return;
            FinishDraft(id);

        }
        private void DiscardDraft(int id)
        {
            if (id != _draftEntryId) return;
            if (_placement.EntryId == id) _placement.CancelPlacement();
            _data.DeleteEntry(id);
            _draftEntryId = 0;
            if (SelectedEntryId == id) SelectedEntryId = 0;
            _panelVisible = false;
            Mod.Log.Info($"Discarded pinned draft {id}");

        }
        private void UpdateEntry(IJsonReader reader)
        {
            if (reader.GetArgumentsCount() < 10) return;
            reader.Read(out int id);
            reader.Read(out string title);
            reader.Read(out string description);
            reader.Read(out int kind);
            reader.Read(out int category);
            reader.Read(out string customCategory);
            reader.Read(out int status);
            reader.Read(out int priority);
            reader.Read(out string realDueTicks);
            reader.Read(out string gameDueTicks);
            long.TryParse(realDueTicks, out long realTicks);
            long.TryParse(gameDueTicks, out long gameTicks);
            _data.UpdateEntry(
                id,
                title,
                description,
                (EntryKind)kind,
                (EntryCategory)category,
                customCategory,
                (EntryStatus)status,
                (EntryPriority)priority,
                realTicks,
                gameTicks);

        }
        private void DeleteEntry(IJsonReader reader)
        {
            if (reader.GetArgumentsCount() < 1) return;
            reader.Read(out int id);
            if (reader.GetArgumentsCount() >= 10)
            {
                reader.Read(out string title);
                reader.Read(out string description);
                reader.Read(out int kind);
                reader.Read(out int category);
                reader.Read(out string customCategory);
                reader.Read(out int status);
                reader.Read(out int priority);
                reader.Read(out string realDueTicks);
                reader.Read(out string gameDueTicks);
                long.TryParse(realDueTicks, out long realTicks);
                long.TryParse(gameDueTicks, out long gameTicks);
                _data.UpdateEntry(
                id,
                title,
                description,
                (EntryKind)kind,
                (EntryCategory)category,
                customCategory,
                (EntryStatus)status,
                (EntryPriority)priority,
                realTicks,
                gameTicks);

            }
            TaskEntry entry = _data.Find(id);
            if (entry == null) return;
            if (_placement.EntryId == id) _placement.CancelPlacement();
            _deletedEntry = entry.Clone();
            _deleteUndoExpiresUtcTicks = DateTime.UtcNow.AddSeconds(8).Ticks;
            if (!_data.DeleteEntry(id))
            {
                _deletedEntry = null;
                return;

            }
            if (SelectedEntryId == id) SelectedEntryId = 0;
            if (_draftEntryId == id) _draftEntryId = 0;
            if (_createPlacementEntryId == id) _createPlacementEntryId = 0;
            if (_returnToEditorAfterPlacementId == id) _returnToEditorAfterPlacementId = 0;

        }
        private bool IsUndoAvailable() => _deletedEntry != null && DateTime.UtcNow.Ticks <= _deleteUndoExpiresUtcTicks;
        private void UndoDelete()
        {
            if (!IsUndoAvailable())
            {
                _deletedEntry = null;
                return;

            }
            TaskEntry snapshot = _deletedEntry;
            _deletedEntry = null;
            if (_data.RestoreEntry(snapshot)) SelectedEntryId = 0;

        }
        private void SetStatus(IJsonReader reader)
        {
            if (reader.GetArgumentsCount() < 2) return;
            reader.Read(out int id);
            reader.Read(out int status);
            _data.SetStatus(id, (EntryStatus)status);

        }
        private void ConvertIdea(int id)
        {
            _data.ConvertIdeaToTask(id);

        }
        private void SelectEntry(int id)
        {
            if (id == 0)
            {
                SelectedEntryId = 0;
                return;

            }
            if (_data.Find(id) == null) return;
            SelectedEntryId = id;
            _panelVisible = true;
            _lastSelectedEntity = _toolSystem.selected;

        }
        public void BeginPlacement(int id)
        {
            if (_data.Find(id) == null) return;
            if (_placement.EntryId > 0 && _placement.EntryId != id) return;
            if (_placement.BeginPlacement(id)) SelectEntry(id);

        }
        private void BeginAdditionalLocation(IJsonReader reader)
        {
            if (reader.GetArgumentsCount() < 1) return;
            reader.Read(out int id);
            TaskEntry entry = _data.Find(id);
            // District anchors remain a single live centre. Extra ordinary pins belong to
            // normal tasks so a district task can never silently lose that relationship.
            if (entry == null || entry.Locations.Any(location => location.LinkedDistrict != Entity.Null)) return;
            if (_placement.EntryId > 0 && _placement.EntryId != id) return;
            if (!_placement.BeginPlacement(id, continuous: true)) return;
            SelectedEntryId = id;
            _returnToEditorAfterPlacementId = id;
            _panelVisible = false;
        }

        private void MoveLocation(IJsonReader reader)
        {
            if (reader.GetArgumentsCount() < 2) return;
            reader.Read(out int id);
            reader.Read(out int locationId);
            TaskEntry entry = _data.Find(id);
            TaskLocation location = entry?.Locations.FirstOrDefault(item => item.Id == locationId);
            if (location == null || location.LinkedDistrict != Entity.Null) return;
            if (_placement.EntryId > 0 && _placement.EntryId != id) return;
            if (!_placement.BeginPlacement(id, locationId)) return;
            SelectedEntryId = id;
            _returnToEditorAfterPlacementId = id;
            _panelVisible = false;
        }

        private void BeginMarkerDrag(IJsonReader reader)
        {
            if (reader.GetArgumentsCount() < 2) return;
            reader.Read(out int id);
            reader.Read(out int locationId);
            TaskEntry entry = _data.Find(id);
            TaskLocation location = entry?.Locations.FirstOrDefault(item => item.Id == locationId);
            if (location == null || location.LinkedDistrict != Entity.Null) return;
            if (_placement.EntryId > 0 && _placement.EntryId != id) return;
            if (!_placement.BeginMarkerDrag(id, locationId)) return;
            SelectedEntryId = id;
            _panelVisible = false;
        }

        private void RemoveLocation(IJsonReader reader)
        {
            if (reader.GetArgumentsCount() < 2) return;
            reader.Read(out int id);
            reader.Read(out int locationId);
            TaskEntry entry = _data.Find(id);
            TaskLocation location = entry?.Locations.FirstOrDefault(item => item.Id == locationId);
            if (location == null || location.LinkedDistrict != Entity.Null) return;
            if (_placement.EntryId == id && _placement.LocationId == locationId) _placement.CancelPlacement();
            _data.RemoveLocation(id, locationId);

        }
        private void CreateDistrictEntry()
        {
            if (_draftEntryId > 0 || _createPlacementEntryId > 0 || _placement.EntryId > 0) return;
            Entity district = _toolSystem.selected;
            if (district == Entity.Null || !EntityManager.Exists(district) || !EntityManager.HasComponent<Game.Areas.District>(district)) return;
            int id = _data.CreateEntry("New note", EntryKind.Task, EntryCategory.General, transient: true);
            if (id == 0) return;
            Unity.Mathematics.float3 position = default;
            if (EntityManager.HasComponent<Game.Areas.Geometry>(district))
            {
                position = EntityManager.GetComponentData<Game.Areas.Geometry>(district).m_CenterPosition;
            }
            if (!_data.SetLocation(id, position, district, district, markerMoved: false)
                || !_placement.CompleteKnownPlacement(id))
            {
                _data.DeleteEntry(id);
                return;
            }

            // District drafts use the regular applied-placement editor, giving them the same
            // title focus, discard confirmation, and transient-save protection as map pins.
            _draftEntryId = id;
            SelectedEntryId = id;
            _lastSelectedEntity = district;
            _panelVisible = false;
            Mod.Log.Info($"Started district draft {id}");

        }
        private void NavigateToEntry(int id)
        {
            SelectEntry(id);
            TaskEntry entry = _data.Find(id);
            NavigateToLocation(entry?.PrimaryLocation, id);
        }

        private void NavigateToLocation(IJsonReader reader)
        {
            if (reader.GetArgumentsCount() < 2) return;
            reader.Read(out int id);
            reader.Read(out int locationId);
            TaskEntry entry = _data.Find(id);
            NavigateToLocation(entry?.Locations.FirstOrDefault(item => item.Id == locationId), id);
        }

        private void NavigateToLocation(TaskLocation location, int entryId)
        {
            if (location == null || !location.HasLocation || _camera.orbitCameraController == null) return;
            Entity target = _markers.TryGetMarker(entryId, location.Id, out Entity marker)
                ? marker
                : GetNavigationAnchor(_data.GetResolvedPosition(location));
            _camera.orbitCameraController.followedEntity = target;
            _camera.orbitCameraController.TryMatchPosition(_camera.activeCameraController);
            _camera.activeCameraController = _camera.orbitCameraController;

        }
        private Entity GetNavigationAnchor(Unity.Mathematics.float3 position)
        {
            if (!EntityManager.Exists(_navigationAnchor))
            {
                _navigationAnchor = EntityManager.CreateEntity();
                EntityManager.AddComponentData(_navigationAnchor, new Transform(position, Unity.Mathematics.quaternion.identity));

            }
            EntityManager.SetComponentData(_navigationAnchor, new Transform(position, Unity.Mathematics.quaternion.identity));
            return _navigationAnchor;

        }
        private void WriteEntries(IJsonWriter writer)
        {
            writer.ArrayBegin((uint)_data.Entries.Count);
            long realToday = DateTime.Today.Ticks;
            long gameToday = _time.GetCurrentDateTime().Date.Ticks;
            foreach (TaskEntry entry in _data.Entries)
            {
                WriteEntry(writer, entry, realToday, gameToday);
            }
            writer.ArrayEnd();
        }

        private void WriteDistrictEntries(IJsonWriter writer)
        {
            Entity district = _toolSystem.selected;
            _districtEntries.Clear();
            if (IsDistrict(district))
            {
                foreach (TaskEntry entry in _data.Entries)
                {
                    if (entry.Locations.Any(location => location.LinkedDistrict == district) && !_data.IsTransientEntry(entry.Id))
                    {
                        _districtEntries.Add(entry);
                    }
                }

                _districtEntries.Sort((left, right) => right.UpdatedUtcTicks.CompareTo(left.UpdatedUtcTicks));
            }

            writer.ArrayBegin((uint)_districtEntries.Count);
            long realToday = DateTime.Today.Ticks;
            long gameToday = _time.GetCurrentDateTime().Date.Ticks;
            foreach (TaskEntry entry in _districtEntries)
            {
                WriteEntry(writer, entry, realToday, gameToday);
            }

            writer.ArrayEnd();
        }

        private void WriteEntry(IJsonWriter writer, TaskEntry entry, long realToday, long gameToday)
        {
            TaskLocation primary = entry.PrimaryLocation;
            Unity.Mathematics.float3 position = _data.GetResolvedPosition(primary);
            bool hasDistrictLink = primary?.LinkedDistrict != Entity.Null;
            writer.TypeBegin("Planboard.EntryView");
            Write(writer, "id", entry.Id);
            Write(writer, "title", entry.Title);
            Write(writer, "description", entry.Description);
            Write(writer, "kind", (int)entry.Kind);
            Write(writer, "category", (int)entry.Category);
            Write(writer, "categoryName", entry.CustomCategory);
            Write(writer, "status", (int)entry.Status);
            Write(writer, "priority", (int)entry.Priority);
            Write(writer, "createdUtcTicks", entry.CreatedUtcTicks.ToString());
            Write(writer, "updatedUtcTicks", entry.UpdatedUtcTicks.ToString());
            Write(writer, "realDueDateTicks", entry.RealDueDateTicks.ToString());
            Write(writer, "gameDueDateTicks", entry.GameDueDateTicks.ToString());
            Write(writer, "realOverdue", entry.HasRealDueDate && entry.RealDueDateTicks < realToday && entry.Status != EntryStatus.Done);
            Write(writer, "gameOverdue", entry.HasGameDueDate && entry.GameDueDateTicks < gameToday && entry.Status != EntryStatus.Done);
            Write(writer, "spatialKind", (int)entry.SpatialKind);
            Write(writer, "hasLocation", entry.HasLocation);
            Write(writer, "locationCount", entry.Locations.Count);
            Write(writer, "x", position.x);
            Write(writer, "y", position.y);
            Write(writer, "z", position.z);
            Write(writer, "linkState", (int)_data.GetResolvedLinkState(entry));
            Write(writer, "hasDistrict", hasDistrictLink);
            Write(writer, "markerMoved", entry.MarkerMoved);
            writer.PropertyName("locations");
            writer.ArrayBegin((uint)entry.Locations.Count);
            foreach (TaskLocation location in entry.Locations)
            {
                WriteLocation(writer, location);
            }
            writer.ArrayEnd();
            writer.TypeEnd();
        }

        private void WriteLocation(IJsonWriter writer, TaskLocation location)
        {
            Unity.Mathematics.float3 position = _data.GetResolvedPosition(location);
            writer.TypeBegin("Planboard.TaskLocationView");
            Write(writer, "id", location.Id);
            Write(writer, "x", position.x);
            Write(writer, "y", position.y);
            Write(writer, "z", position.z);
            Write(writer, "linkState", (int)_data.GetResolvedLinkState(location));
            Write(writer, "hasDistrict", location.LinkedDistrict != Entity.Null);
            Write(writer, "markerMoved", location.MarkerMoved);
            writer.TypeEnd();
        }
        private void WriteProjectedMarkers(IJsonWriter writer)
        {
            UnityEngine.Camera camera = _camera.activeCamera;
            if ((MapDisplayMode == 0 && SelectedEntryId <= 0) || camera == null || camera.pixelWidth <= 0 || camera.pixelHeight <= 0)
            {
                writer.ArrayBegin(0);
                writer.ArrayEnd();
                return;

            }
            _projectedLocations.Clear();
            _projectedStandaloneLocations.Clear();
            _projectedDistrictGroups.Clear();
            foreach (TaskEntry entry in _data.Entries)
            {
                // Completed tasks remain in the planboard list, but map surfaces are for
                // current work. Hiding them here removes both pin and sticky-note variants.
                if (entry.Status == EntryStatus.Done ||
                    (MapDisplayMode == 0 && entry.Id != SelectedEntryId))
                {
                    continue;
                }

                foreach (TaskLocation location in entry.Locations)
                {
                    if (!location.HasLocation) continue;
                    ProjectedLocation projected = new(entry, location);
                    if (location.LinkedDistrict == Entity.Null)
                    {
                        _projectedStandaloneLocations.Add(projected);
                        continue;
                    }

                    if (!_projectedDistrictGroups.TryGetValue(location.LinkedDistrict, out List<ProjectedLocation> group))
                    {
                        group = new List<ProjectedLocation>();
                        _projectedDistrictGroups.Add(location.LinkedDistrict, group);
                    }

                    group.Add(projected);
                }
            }

            _projectedLocations.AddRange(_projectedStandaloneLocations);
            foreach (List<ProjectedLocation> group in _projectedDistrictGroups.Values)
            {
                // The current selection wins so it stays reachable. Otherwise the newest
                // district task represents the shared map anchor.
                group.Sort((left, right) => right.Entry.UpdatedUtcTicks.CompareTo(left.Entry.UpdatedUtcTicks));
                ProjectedLocation primary = group.Find(item => item.Entry.Id == SelectedEntryId) ?? group[0];
                _projectedLocations.Add(primary);
            }

            writer.ArrayBegin((uint)_projectedLocations.Count);
            foreach (ProjectedLocation projected in _projectedLocations)
            {
                TaskEntry entry = projected.Entry;
                TaskLocation location = projected.Location;
                Unity.Mathematics.float3 position = _data.GetResolvedPosition(location);
                // Use the same resolved coordinate as navigation and native overlays. A
                // screen-only vertical lift looks like district-anchor drift on camera tilt.
                UnityEngine.Vector3 screen = camera.WorldToScreenPoint(new UnityEngine.Vector3(position.x, position.y, position.z));
                float x = screen.x / camera.pixelWidth;
                float y = 1f - screen.y / camera.pixelHeight;
                bool visible = screen.z > 0f && x >= 0f && x <= 1f && y >= 0f && y <= 1f;
                bool isDistrict = location.LinkedDistrict != Entity.Null;
                int districtCount = isDistrict && _projectedDistrictGroups.TryGetValue(location.LinkedDistrict, out List<ProjectedLocation> group)
                    ? group.Count
                    : 1;
                writer.TypeBegin("Planboard.ProjectedMarker");
                Write(writer, "id", entry.Id);
                Write(writer, "locationId", location.Id);
                Write(writer, "screenX", x);
                Write(writer, "screenY", y);
                Write(writer, "visible", visible);
                Write(writer, "isDistrict", isDistrict);
                Write(writer, "districtCount", districtCount);
                writer.TypeEnd();

            }
            writer.ArrayEnd();

        }
        private void WriteDataIssues(IJsonWriter writer)
        {
            writer.ArrayBegin((uint)_data.DataIssues.Count);
            foreach (TaskDataIssue issue in _data.DataIssues)
            {
                writer.TypeBegin("Planboard.DataIssue");
                Write(writer, "severity", (int)issue.Severity);
                Write(writer, "entryId", issue.EntryId);
                Write(writer, "message", issue.Message);
                writer.TypeEnd();

            }
            writer.ArrayEnd();

        }

        private sealed class ProjectedLocation
        {
            public ProjectedLocation(TaskEntry entry, TaskLocation location)
            {
                Entry = entry;
                Location = location;
            }

            public TaskEntry Entry { get; }
            public TaskLocation Location { get; }
        }

        private static void Write(IJsonWriter writer, string name, string value)
        {
            writer.PropertyName(name);
            writer.Write(value);

        }
        private static void Write(IJsonWriter writer, string name, int value)
        {
            writer.PropertyName(name);
            writer.Write(value);

        }
        private static void Write(IJsonWriter writer, string name, float value)
        {
            writer.PropertyName(name);
            writer.Write(value);

        }
        private static void Write(IJsonWriter writer, string name, bool value)
        {
            writer.PropertyName(name);
            writer.Write(value);

        }

    }

}
