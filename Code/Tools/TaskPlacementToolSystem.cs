using System;
using Game.Common;
using Game.Input;
using Game.Net;
using Game.Tools;
using Planboard.Data;
using Planboard.Systems;
using Unity.Entities;
using Unity.Jobs;
using Unity.Mathematics;

// Provides the native terrain, network, and building placement workflow for task markers.

namespace Planboard.Tools
{
    public partial class TaskPlacementToolSystem : ToolBaseSystem
    {
        public override string toolID => "Planboard.PlaceMarker";
        public PlacementState State { get; private set; } = PlacementState.Inactive;
        public int EntryId { get; private set; }
        public int LocationId { get; private set; }
        public bool IsContinuousPlacement { get; private set; }
        public float3 PreviewPosition { get; private set; }
        public Entity PreviewEntity { get; private set; } = Entity.Null;
        public bool HasValidPreview => State == PlacementState.ValidPreview;
        public bool IsMarkerDragActive { get; private set; }

        private TaskDataSystem _data;
        private ProxyAction _applyPlacementAction;
        private ProxyAction _cancelPlacementAction;

        public override bool allowUnderground => false;
        public override Game.Prefabs.PrefabBase GetPrefab() => null;
        public override bool TrySetPrefab(Game.Prefabs.PrefabBase prefab) => false;

        protected override void OnCreate()
        {
            base.OnCreate();
            _data = World.GetOrCreateSystemManaged<TaskDataSystem>();
            _applyPlacementAction = Mod.Settings.GetAction(Settings.ApplyPlacementAction);
            _cancelPlacementAction = Mod.Settings.GetAction(Settings.CancelPlacementAction);
            Enabled = false;
        }

        public bool BeginPlacement(int entryId, int locationId = 0, bool continuous = false)
        {
            TaskEntry entry = _data.Find(entryId);
            if (entry == null) return false;
            if (locationId > 0 && !entry.Locations.Exists(location => location.Id == locationId)) return false;
            if (EntryId > 0 && EntryId != entryId) return false;

            EntryId = entryId;
            LocationId = locationId;
            IsContinuousPlacement = continuous;
            IsMarkerDragActive = false;
            State = PlacementState.ChoosingLocation;
            PreviewEntity = Entity.Null;
            PreviewPosition = default;
            m_ToolSystem.selected = Entity.Null;
            m_ToolSystem.activeTool = this;
            Enabled = true;
            return true;
        }

        // A Gameface card cannot raycast the map itself. During a drag it becomes a
        // pointer-following, non-interactive ghost while this native tool owns the preview.
        public bool BeginMarkerDrag(int entryId, int locationId)
        {
            if (!BeginPlacement(entryId, locationId)) return false;
            IsMarkerDragActive = true;
            return true;
        }

        public void FinishMarkerDrag()
        {
            if (!IsMarkerDragActive) return;
            if (State == PlacementState.ValidPreview)
            {
                ApplyPreview();
            }
            else
            {
                CancelPlacement();
            }
        }

        public void CancelPlacement()
        {
            State = PlacementState.Cancelled;
            PreviewEntity = Entity.Null;
            PreviewPosition = default;
            EntryId = 0;
            LocationId = 0;
            IsContinuousPlacement = false;
            IsMarkerDragActive = false;
            Enabled = false;
            if (m_ToolSystem.activeTool == this) m_ToolSystem.activeTool = m_DefaultToolSystem;
        }

        // Districts already provide a valid centre and link, so their draft needs the same
        // applied state as a map click without briefly taking control of the player's tool.
        public bool CompleteKnownPlacement(int entryId)
        {
            if (_data.Find(entryId) == null || EntryId > 0) return false;

            State = PlacementState.Applied;
            EntryId = 0;
            LocationId = 0;
            IsContinuousPlacement = false;
            IsMarkerDragActive = false;
            PreviewEntity = Entity.Null;
            PreviewPosition = default;
            Enabled = false;
            if (m_ToolSystem.activeTool == this) m_ToolSystem.activeTool = m_DefaultToolSystem;
            return true;
        }

        protected override void OnStartRunning()
        {
            base.OnStartRunning();
            SetActionEnabled(_applyPlacementAction, true);
            SetActionEnabled(_cancelPlacementAction, true);
            if (State == PlacementState.Inactive) State = PlacementState.ChoosingLocation;
        }

        protected override void OnStopRunning()
        {
            base.OnStopRunning();
            SetActionEnabled(_applyPlacementAction, false);
            SetActionEnabled(_cancelPlacementAction, false);
            // Switching tools removes the raycast context. Treat that as cancellation instead
            // of applying the last preview, which may no longer describe the active tool target.
            bool interruptedPlacement = EntryId > 0
                && State != PlacementState.Applied
                && State != PlacementState.Cancelled;
            PreviewEntity = Entity.Null;
            PreviewPosition = default;
            if (interruptedPlacement)
            {
                Mod.Log.Warn($"Placement for task {EntryId} was cancelled because another tool became active.");
                State = PlacementState.Cancelled;
                EntryId = 0;
                LocationId = 0;
                IsContinuousPlacement = false;
                IsMarkerDragActive = false;
            }
            else if (State != PlacementState.Applied && State != PlacementState.Cancelled)
            {
                State = PlacementState.Inactive;
            }
        }

        private static void SetActionEnabled(ProxyAction action, bool enabled)
        {
            try
            {
                action.shouldBeEnabled = enabled;
            }
            catch (Exception exception)
            {
                Mod.Log.Warn(
                    $"Placement input action could not be {(enabled ? "enabled" : "disabled")}: {exception.Message}"
                );
            }
        }

        public override void InitializeRaycast()
        {
            base.InitializeRaycast();
            // Markers can belong to free terrain, networks, or static buildings. Restricting
            // the mask to those surfaces keeps placement aligned with visible city objects.
            m_ToolRaycastSystem.typeMask = TypeMask.Terrain | TypeMask.Net | TypeMask.StaticObjects;
            m_ToolRaycastSystem.collisionMask = CollisionMask.OnGround | CollisionMask.Overground;
            m_ToolRaycastSystem.raycastFlags = RaycastFlags.SubElements
                | RaycastFlags.Cargo
                | RaycastFlags.Passenger;
            m_ToolRaycastSystem.netLayerMask = Layer.Road
                | Layer.TrainTrack
                | Layer.TramTrack
                | Layer.SubwayTrack
                | Layer.PublicTransportRoad
                | Layer.Pathway;
            m_ToolRaycastSystem.iconLayerMask = Game.Notifications.IconLayerMask.None;
            m_ToolRaycastSystem.utilityTypeMask = Game.Net.UtilityTypes.None;
        }

        protected override JobHandle OnUpdate(JobHandle inputDeps)
        {
            if (m_FocusChanged)
            {
                InitializeRaycast();
                m_FocusChanged = false;
            }

            bool uiDisabled = (m_ToolRaycastSystem.raycastFlags
                & (RaycastFlags.DebugDisable | RaycastFlags.UIDisable)) != 0;
            if (
                _cancelPlacementAction.WasPressedThisFrame()
                || cancelAction.WasPressedThisFrame()
                || secondaryApplyAction.WasPressedThisFrame()
            )
            {
                CancelPlacement();
                return inputDeps;
            }

            if (uiDisabled)
            {
                State = PlacementState.InvalidPreview;
                PreviewEntity = Entity.Null;
                return inputDeps;
            }

            if (GetRaycastResult(out ControlPoint point, out _))
            {
                PreviewPosition = point.m_HitPosition;
                PreviewEntity = point.m_OriginalEntity;
                State = math.all(math.isfinite(PreviewPosition))
                    ? PlacementState.ValidPreview
                    : PlacementState.InvalidPreview;
            }
            else
            {
                State = PlacementState.InvalidPreview;
                PreviewEntity = Entity.Null;
            }

            if (!IsMarkerDragActive && _applyPlacementAction.WasPressedThisFrame() && State == PlacementState.ValidPreview)
            {
                ApplyPreview();
            }

            return inputDeps;
        }

        private void ApplyPreview()
        {
            // A valid preview is only a visual candidate. Both click placement and a released
            // sticky-note drag commit through this single path so links and MarkerMoved agree.
            Entity district = PreviewEntity != Entity.Null && EntityManager.HasComponent<Game.Areas.District>(PreviewEntity)
                ? PreviewEntity
                : Entity.Null;
            Entity linked = PreviewEntity != Entity.Null && EntityManager.Exists(PreviewEntity)
                ? PreviewEntity
                : Entity.Null;
            bool moved = LocationId > 0;
            bool keepPlacing = IsContinuousPlacement && !IsMarkerDragActive && LocationId == 0;
            if (!_data.SetLocation(EntryId, PreviewPosition, linked, district, moved, LocationId)) return;
            Mod.Log.Info($"Placed pin for task {EntryId} at {PreviewPosition}");
            if (keepPlacing)
            {
                // Append mode commits each valid click immediately, then leaves the native
                // tool active for the next location. Escape, right-click, or Done ends the
                // session without removing the pins that already succeeded.
                State = PlacementState.ChoosingLocation;
                PreviewEntity = Entity.Null;
                PreviewPosition = default;
                return;
            }
            State = PlacementState.Applied;
            EntryId = 0;
            LocationId = 0;
            IsContinuousPlacement = false;
            IsMarkerDragActive = false;
            Enabled = false;
            m_ToolSystem.activeTool = m_DefaultToolSystem;
        }
    }
}
