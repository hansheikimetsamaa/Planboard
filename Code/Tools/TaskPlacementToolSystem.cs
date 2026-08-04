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

namespace Planboard.Tools
{
    public partial class TaskPlacementToolSystem : ToolBaseSystem
    {
        public override string toolID => "Planboard.PlaceMarker";
        public PlacementState State { get; private set; } = PlacementState.Inactive;
        public int EntryId { get; private set; }
        public float3 PreviewPosition { get; private set; }
        public Entity PreviewEntity { get; private set; } = Entity.Null;
        public bool HasValidPreview => State == PlacementState.ValidPreview;

        private TaskDataSystem _data;
        private ProxyAction _applyAction;
        private ProxyAction _cancelAction;

        public override bool allowUnderground => true;
        public override Game.Prefabs.PrefabBase GetPrefab() => null;
        public override bool TrySetPrefab(Game.Prefabs.PrefabBase prefab) => false;

        protected override void OnCreate()
        {
            base.OnCreate();
            _data = World.GetOrCreateSystemManaged<TaskDataSystem>();
            _applyAction = Mod.Settings.GetAction(Settings.ApplyPlacementAction);
            _cancelAction = Mod.Settings.GetAction(Settings.CancelPlacementAction);
            Enabled = false;
        }

        public bool BeginPlacement(int entryId)
        {
            if (_data.Find(entryId) == null) return false;
            if (EntryId > 0 && EntryId != entryId) return false;
            EntryId = entryId;
            State = PlacementState.ChoosingLocation;
            PreviewEntity = Entity.Null;
            PreviewPosition = default;
            m_ToolSystem.selected = Entity.Null;
            m_ToolSystem.activeTool = this;
            return true;
        }

        public void CancelPlacement()
        {
            State = PlacementState.Cancelled;
            PreviewEntity = Entity.Null;
            PreviewPosition = default;
            EntryId = 0;
            if (m_ToolSystem.activeTool == this) m_ToolSystem.activeTool = m_DefaultToolSystem;
        }

        protected override void OnStartRunning()
        {
            base.OnStartRunning();
            SetActionEnabled(_applyAction, true);
            SetActionEnabled(_cancelAction, true);
            if (State == PlacementState.Inactive) State = PlacementState.ChoosingLocation;
        }

        protected override void OnStopRunning()
        {
            base.OnStopRunning();
            SetActionEnabled(_applyAction, false);
            SetActionEnabled(_cancelAction, false);
            bool interruptedPlacement = EntryId > 0 && State != PlacementState.Applied && State != PlacementState.Cancelled;
            PreviewEntity = Entity.Null;
            PreviewPosition = default;
            if (interruptedPlacement)
            {
                Mod.Log.Warn($"Placement for task {EntryId} was cancelled because another tool became active.");
                State = PlacementState.Cancelled;
                EntryId = 0;
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
                Mod.Log.Warn($"Placement input action is managed by the game and cannot be toggled: {exception.Message}");
            }
        }

        public override void InitializeRaycast()
        {
            base.InitializeRaycast();
            m_ToolRaycastSystem.typeMask = TypeMask.Terrain | TypeMask.Net | TypeMask.StaticObjects;
            m_ToolRaycastSystem.collisionMask = CollisionMask.OnGround | CollisionMask.Overground | CollisionMask.Underground;
            m_ToolRaycastSystem.raycastFlags = RaycastFlags.SubElements | RaycastFlags.Cargo | RaycastFlags.Passenger;
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
            if (m_FocusChanged) return inputDeps;

            bool uiDisabled = (m_ToolRaycastSystem.raycastFlags & (RaycastFlags.DebugDisable | RaycastFlags.UIDisable)) != 0;
            if (_cancelAction.WasPressedThisFrame())
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
                State = math.all(math.isfinite(PreviewPosition)) ? PlacementState.ValidPreview : PlacementState.InvalidPreview;
            }
            else
            {
                State = PlacementState.InvalidPreview;
                PreviewEntity = Entity.Null;
            }

            if (_applyAction.WasPressedThisFrame() && State == PlacementState.ValidPreview)
            {
                Entity district = PreviewEntity != Entity.Null && EntityManager.HasComponent<Game.Areas.District>(PreviewEntity)
                    ? PreviewEntity
                    : Entity.Null;
                Entity linked = PreviewEntity != Entity.Null && EntityManager.Exists(PreviewEntity) ? PreviewEntity : Entity.Null;
                bool moved = _data.Find(EntryId)?.HasLocation == true;
                if (_data.SetLocation(EntryId, PreviewPosition, linked, district, moved))
                {
                    Mod.Log.Info($"Placed task {EntryId} at {PreviewPosition}");
                    State = PlacementState.Applied;
                    EntryId = 0;
                    m_ToolSystem.activeTool = m_DefaultToolSystem;
                }
            }

            return inputDeps;
        }
    }
}
