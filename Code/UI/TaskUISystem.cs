using System;
using System.Collections.Generic;
using Colossal.UI.Binding;
using Colossal.Serialization.Entities;
using Game.Objects;
using Game.Rendering;
using Game.Simulation;
using Game.Tools;
using Game.UI;
using Planboard.Common;
using Planboard.Data;
using Planboard.Systems;
using Planboard.Tools;
using Unity.Entities;

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
        private RawValueBinding _issuesBinding;
        private RawValueBinding _projectedMarkersBinding;
        private readonly List<TaskEntry> _projectedEntries = new();
        private Entity _lastSelectedEntity = Entity.Null;
        private bool _panelVisible;
        private int _draftEntryId;
        private int _createPlacementEntryId;
        private TaskEntry _deletedEntry;
        private long _deleteUndoExpiresUtcTicks;
        private PlacementState _lastPlacementState = PlacementState.Inactive;
        private Entity _navigationAnchor = Entity.Null;

        public int SelectedEntryId { get; private set; }
        public int MapDisplayMode { get; private set; } = 1;

        protected override void OnCreate()
        {
            base.OnCreate();
            _data = World.GetOrCreateSystemManaged<TaskDataSystem>();
            _markers = World.GetOrCreateSystemManaged<TaskMarkerSystem>();
            _placement = World.GetOrCreateSystemManaged<TaskPlacementToolSystem>();
            _toolSystem = World.GetOrCreateSystemManaged<ToolSystem>();
            _camera = World.GetOrCreateSystemManaged<CameraUpdateSystem>();
            _time = World.GetOrCreateSystemManaged<TimeSystem>();

            AddUpdateBinding(new GetterValueBinding<uint>(UIBindingConstants.Group, UIBindingConstants.Revision, () => _data.Revision));
            AddUpdateBinding(new GetterValueBinding<bool>(UIBindingConstants.Group, UIBindingConstants.PanelVisible, () => _panelVisible));
            AddUpdateBinding(new GetterValueBinding<int>(UIBindingConstants.Group, UIBindingConstants.SelectedEntryId, () => SelectedEntryId));
            AddUpdateBinding(new GetterValueBinding<int>(UIBindingConstants.Group, UIBindingConstants.PlacementState, () => (int)_placement.State));
            AddUpdateBinding(new GetterValueBinding<int>(UIBindingConstants.Group, UIBindingConstants.PlacementEntryId, () => _placement.EntryId));
            AddUpdateBinding(new GetterValueBinding<int>(UIBindingConstants.Group, UIBindingConstants.DraftEntryId, () => _draftEntryId));
            AddUpdateBinding(new GetterValueBinding<bool>(UIBindingConstants.Group, UIBindingConstants.DistrictSelected, IsDistrictSelected));
            AddUpdateBinding(new GetterValueBinding<int>(UIBindingConstants.Group, UIBindingConstants.MapDisplayMode, () => MapDisplayMode));
            AddUpdateBinding(new GetterValueBinding<bool>(UIBindingConstants.Group, UIBindingConstants.UndoAvailable, IsUndoAvailable));
            AddUpdateBinding(new GetterValueBinding<int>(UIBindingConstants.Group, UIBindingConstants.WindowLayoutRevision, () => Mod.Settings.WindowLayoutRevision));
            AddUpdateBinding(new GetterValueBinding<string>(UIBindingConstants.Group, UIBindingConstants.DeadlineMode, () => Mod.Settings.DeadlineMode == Settings.InGameDeadlineMode ? Settings.InGameDeadlineMode : Settings.RealLifeDeadlineMode));
            AddUpdateBinding(new GetterValueBinding<bool>(UIBindingConstants.Group, UIBindingConstants.DataReadOnly, () => _data.IsReadOnly));
            AddUpdateBinding(_entriesBinding = new RawValueBinding(UIBindingConstants.Group, UIBindingConstants.Entries, WriteEntries));
            AddUpdateBinding(_issuesBinding = new RawValueBinding(UIBindingConstants.Group, UIBindingConstants.DataIssues, WriteDataIssues));
            AddUpdateBinding(_projectedMarkersBinding = new RawValueBinding(UIBindingConstants.Group, UIBindingConstants.ProjectedMarkers, WriteProjectedMarkers));

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
            AddBinding(new TriggerBinding(UIBindingConstants.Group, UIBindingConstants.CancelPlacement, _placement.CancelPlacement));
            AddBinding(new TriggerBinding<int>(UIBindingConstants.Group, UIBindingConstants.RemoveLocation, RemoveLocation));
            AddBinding(new TriggerBinding(UIBindingConstants.Group, UIBindingConstants.CreateDistrictEntry, CreateDistrictEntry));
            AddBinding(new TriggerBinding<int>(UIBindingConstants.Group, UIBindingConstants.NavigateToEntry, NavigateToEntry));
            AddBinding(new TriggerBinding<bool>(UIBindingConstants.Group, UIBindingConstants.SetPanelVisible, SetPanelVisible));
            AddBinding(new TriggerBinding(UIBindingConstants.Group, UIBindingConstants.CycleMapDisplayMode, CycleMapDisplayMode));
            AddBinding(new TriggerBinding(UIBindingConstants.Group, UIBindingConstants.UndoDelete, UndoDelete));
        }

        protected override void OnDestroy()
        {
            if (EntityManager.Exists(_navigationAnchor)) EntityManager.DestroyEntity(_navigationAnchor);
            base.OnDestroy();
        }

        protected override void OnUpdate()
        {
            base.OnUpdate();

            PlacementState placementState = _placement.State;
            if (placementState != _lastPlacementState)
            {
                if (_draftEntryId > 0 && placementState == PlacementState.Cancelled) DiscardDraft(_draftEntryId);
                if (_createPlacementEntryId > 0 && placementState == PlacementState.Cancelled)
                {
                    _data.DeleteEntry(_createPlacementEntryId);
                    if (SelectedEntryId == _createPlacementEntryId) SelectedEntryId = 0;
                    _createPlacementEntryId = 0;
                    _panelVisible = true;
                }
                else if (_createPlacementEntryId > 0 && placementState == PlacementState.Applied)
                {
                    _data.CommitTransientEntry(_createPlacementEntryId);
                    SelectedEntryId = _createPlacementEntryId;
                    _createPlacementEntryId = 0;
                    _panelVisible = true;
                }
            }
            _lastPlacementState = placementState;
            if (_deletedEntry != null && !IsUndoAvailable()) _deletedEntry = null;

            Entity selected = _toolSystem.selected;
            if (selected == _lastSelectedEntity) return;
            _lastSelectedEntity = selected;
            if (selected != Entity.Null && EntityManager.Exists(selected) && EntityManager.HasComponent<RuntimeTaskMarker>(selected))
            {
                RuntimeTaskMarker marker = EntityManager.GetComponentData<RuntimeTaskMarker>(selected);
                SelectedEntryId = marker.EntryId;
                _panelVisible = true;
            }
        }

        protected override void OnGameLoaded(Context serializationContext)
        {
            base.OnGameLoaded(serializationContext);
            if (_placement.EntryId > 0) _placement.CancelPlacement();
            _draftEntryId = 0;
            _createPlacementEntryId = 0;
            _deletedEntry = null;
            _deleteUndoExpiresUtcTicks = 0;
            _lastPlacementState = PlacementState.Inactive;
            _lastSelectedEntity = Entity.Null;
            SelectedEntryId = 0;
            _panelVisible = false;
        }

        public void TogglePanel() { _panelVisible = !_panelVisible; }
        private void CycleMapDisplayMode() { MapDisplayMode = (MapDisplayMode + 1) % 3; }
        private void SetPanelVisible(bool visible) { _panelVisible = visible; }

        private bool IsDistrictSelected()
        {
            Entity selected = _toolSystem.selected;
            return selected != Entity.Null && EntityManager.Exists(selected) && EntityManager.HasComponent<Game.Areas.District>(selected);
        }

        private void CreateEntry(IJsonReader reader)
        {
            if (reader.GetArgumentsCount() < 4) { Mod.Log.Warn("CreateEntry received too few UI arguments"); return; }
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
            _data.UpdateEntry(id, title, description, (EntryKind)kind, (EntryCategory)category, customCategory,
                (EntryStatus)status, (EntryPriority)priority, realTicks, gameTicks);
            Mod.Log.Info($"Created task {id}: {title}");
            if (!placeAfterCreate) { SelectEntry(id); return; }
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
            EntryKind kind = kindValue >= (int)EntryKind.Issue && kindValue <= (int)EntryKind.Idea
                ? (EntryKind)kindValue
                : EntryKind.Task;
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
            if (!_data.UpdateEntry(id, title, description, (EntryKind)kind, (EntryCategory)category, customCategory,
                    (EntryStatus)status, (EntryPriority)priority, realTicks, gameTicks)) return;
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
            _data.UpdateEntry(id, title, description, (EntryKind)kind, (EntryCategory)category, customCategory,
                (EntryStatus)status, (EntryPriority)priority, realTicks, gameTicks);
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
                _data.UpdateEntry(id, title, description, (EntryKind)kind, (EntryCategory)category, customCategory,
                    (EntryStatus)status, (EntryPriority)priority, realTicks, gameTicks);
            }

            TaskEntry entry = _data.Find(id);
            if (entry == null) return;
            if (_placement.EntryId == id) _placement.CancelPlacement();
            _deletedEntry = entry.Clone();
            _deleteUndoExpiresUtcTicks = DateTime.UtcNow.AddSeconds(8).Ticks;
            if (!_data.DeleteEntry(id)) { _deletedEntry = null; return; }
            if (SelectedEntryId == id) SelectedEntryId = 0;
            if (_draftEntryId == id) _draftEntryId = 0;
            if (_createPlacementEntryId == id) _createPlacementEntryId = 0;
        }

        private bool IsUndoAvailable() => _deletedEntry != null && DateTime.UtcNow.Ticks <= _deleteUndoExpiresUtcTicks;

        private void UndoDelete()
        {
            if (!IsUndoAvailable()) { _deletedEntry = null; return; }
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

        private void ConvertIdea(int id) { _data.ConvertIdeaToTask(id); }

        private void SelectEntry(int id)
        {
            if (_data.Find(id) == null) return;
            SelectedEntryId = id;
            _panelVisible = true;
        }

        public void BeginPlacement(int id)
        {
            if (_data.Find(id) == null) return;
            if (_placement.EntryId > 0 && _placement.EntryId != id) return;
            if (_placement.BeginPlacement(id)) SelectEntry(id);
        }

        private void RemoveLocation(int id)
        {
            if (_placement.EntryId == id) _placement.CancelPlacement();
            _data.RemoveLocation(id);
        }

        private void CreateDistrictEntry()
        {
            Entity district = _toolSystem.selected;
            if (district == Entity.Null || !EntityManager.Exists(district) || !EntityManager.HasComponent<Game.Areas.District>(district)) return;
            int id = _data.CreateEntry("New district task", EntryKind.Task, EntryCategory.General);
            if (id == 0) return;

            Unity.Mathematics.float3 position = default;
            if (EntityManager.HasComponent<Game.Areas.Geometry>(district)) position = EntityManager.GetComponentData<Game.Areas.Geometry>(district).m_CenterPosition;
            _data.SetLocation(id, position, district, district, markerMoved: false);
            SelectEntry(id);
        }

        private void NavigateToEntry(int id)
        {
            SelectEntry(id);
            TaskEntry entry = _data.Find(id);
            if (entry == null || !entry.HasLocation || _camera.orbitCameraController == null) return;
            Entity target = _markers.TryGetMarker(id, out Entity marker) ? marker : GetNavigationAnchor(entry.Position);
            _camera.orbitCameraController.followedEntity = target;
            _camera.orbitCameraController.TryMatchPosition(_camera.activeCameraController);
            _camera.activeCameraController = _camera.orbitCameraController;
        }

        private Entity GetNavigationAnchor(Unity.Mathematics.float3 position)
        {
            if (!EntityManager.Exists(_navigationAnchor))
                _navigationAnchor = EntityManager.CreateEntity(typeof(Transform));
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
                Write(writer, "x", entry.Position.x);
                Write(writer, "y", entry.Position.y);
                Write(writer, "z", entry.Position.z);
                Write(writer, "linkState", (int)entry.LinkState);
                Write(writer, "hasDistrict", entry.LinkedDistrict != Entity.Null && EntityManager.Exists(entry.LinkedDistrict));
                Write(writer, "markerMoved", entry.MarkerMoved);
                writer.TypeEnd();
            }
            writer.ArrayEnd();
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

            _projectedEntries.Clear();
            foreach (TaskEntry entry in _data.Entries)
                if (entry.HasLocation && (MapDisplayMode != 0 || entry.Id == SelectedEntryId) &&
                    (entry.Id == SelectedEntryId || entry.Status != EntryStatus.Done || Mod.Settings.ShowCompletedMarkers))
                    _projectedEntries.Add(entry);

            writer.ArrayBegin((uint)_projectedEntries.Count);
            foreach (TaskEntry entry in _projectedEntries)
            {
                UnityEngine.Vector3 screen = camera.WorldToScreenPoint(new UnityEngine.Vector3(entry.Position.x, entry.Position.y + 2f, entry.Position.z));
                float x = screen.x / camera.pixelWidth;
                float y = 1f - screen.y / camera.pixelHeight;
                bool visible = screen.z > 0f && x >= 0f && x <= 1f && y >= 0f && y <= 1f;
                writer.TypeBegin("Planboard.ProjectedMarker");
                Write(writer, "id", entry.Id);
                Write(writer, "screenX", x);
                Write(writer, "screenY", y);
                Write(writer, "visible", visible);
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

        private static void Write(IJsonWriter writer, string name, string value) { writer.PropertyName(name); writer.Write(value); }
        private static void Write(IJsonWriter writer, string name, int value) { writer.PropertyName(name); writer.Write(value); }
        private static void Write(IJsonWriter writer, string name, float value) { writer.PropertyName(name); writer.Write(value); }
        private static void Write(IJsonWriter writer, string name, bool value) { writer.PropertyName(name); writer.Write(value); }
    }
}
