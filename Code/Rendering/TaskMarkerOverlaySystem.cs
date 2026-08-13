using Game;
using Game.Objects;
using Game.Rendering;
using Planboard.Data;
using Planboard.UI;
using Unity.Collections;
using Unity.Entities;
using Unity.Jobs;
using Unity.Mathematics;
using Color = UnityEngine.Color;

// Draws lightweight world-space marker overlays for visible Planboard entries.

namespace Planboard.Rendering
{
    public partial class TaskMarkerOverlaySystem : GameSystemBase
    {
        private OverlayRenderSystem _overlay;
        private EntityQuery _markers;
        private TaskUISystem _ui;

        protected override void OnCreate()
        {
            base.OnCreate();
            _overlay = World.GetOrCreateSystemManaged<OverlayRenderSystem>();
            _ui = World.GetOrCreateSystemManaged<TaskUISystem>();
            _markers = GetEntityQuery(ComponentType.ReadOnly<RuntimeTaskMarker>(), ComponentType.ReadOnly<Transform>());
            RequireForUpdate(_markers);
        }

        protected override void OnUpdate()
        {
            if (_ui.MapDisplayMode == 0) return;
            OverlayRenderSystem.Buffer buffer = _overlay.GetBuffer(out JobHandle dependency);
            dependency.Complete();
            CompleteDependency();
            using NativeArray<ArchetypeChunk> chunks = _markers.ToArchetypeChunkArray(Allocator.Temp);
            // This managed GameSystemBase uses direct EntityQuery handles. SystemAPI
            // requires a generated replacement that the game does not emit here.
            ComponentTypeHandle<RuntimeTaskMarker> markerHandle = GetComponentTypeHandle<RuntimeTaskMarker>(true);
            ComponentTypeHandle<Transform> transformHandle = GetComponentTypeHandle<Transform>(true);
            foreach (ArchetypeChunk chunk in chunks)
            {
                NativeArray<RuntimeTaskMarker> markers = chunk.GetNativeArray(ref markerHandle);
                NativeArray<Transform> transforms = chunk.GetNativeArray(ref transformHandle);
                for (int i = 0; i < chunk.Count; i++)
                {
                    RuntimeTaskMarker marker = markers[i];
                    float alpha = marker.Status == EntryStatus.Done ? 0.22f : 0.72f;
                    Color color = CategoryColor(marker.Category, alpha);
                    float diameter = marker.Kind == EntryKind.Issue ? 4.7f : marker.Kind == EntryKind.Idea ? 3.5f : 4.1f;
                    float outline = marker.Priority == EntryPriority.High ? 0.28f : marker.Priority == EntryPriority.Medium ? 0.18f : 0.1f;
                    buffer.DrawCircle(Color.white * alpha, color, outline, 0f, new float2(0f, 1f), transforms[i].m_Position, diameter);
                    if (marker.RealOverdue || marker.GameOverdue)
                    {
                        float3 badge = transforms[i].m_Position + new float3(diameter * 0.45f, 0.15f, diameter * 0.45f);
                        buffer.DrawCircle(Color.white, new Color(0.95f, 0.15f, 0.08f, 0.92f), 0.12f, 0f, new float2(0f, 1f), badge, 1.2f);
                    }
                }
            }
        }

        private static Color CategoryColor(EntryCategory category, float alpha)
        {
            Color color = category switch
            {
                EntryCategory.Traffic => new Color(0.95f, 0.32f, 0.20f),
                EntryCategory.Roads => new Color(0.73f, 0.75f, 0.78f),
                EntryCategory.PublicTransport => new Color(0.20f, 0.64f, 0.95f),
                EntryCategory.WalkingCycling => new Color(0.25f, 0.86f, 0.55f),
                EntryCategory.ZoningDevelopment => new Color(0.82f, 0.50f, 0.95f),
                EntryCategory.CityServices => new Color(0.26f, 0.78f, 0.86f),
                EntryCategory.Utilities => new Color(0.98f, 0.78f, 0.18f),
                EntryCategory.ParksPublicSpace => new Color(0.30f, 0.78f, 0.30f),
                EntryCategory.FutureProject => new Color(0.52f, 0.46f, 0.96f),
                _ => new Color(0.56f, 0.68f, 0.74f),
            };
            color.a = alpha;
            return color;
        }
    }
}
