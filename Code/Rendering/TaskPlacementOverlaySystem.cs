using Game;
using Game.Rendering;
using Planboard.Data;
using Planboard.Tools;
using Unity.Jobs;
using Unity.Mathematics;
using UnityEngine;

// Draws the live marker preview while the placement tool is active.

namespace Planboard.Rendering
{
    public partial class TaskPlacementOverlaySystem : GameSystemBase
    {
        private TaskPlacementToolSystem _tool;
        private OverlayRenderSystem _overlay;

        protected override void OnCreate()
        {
            base.OnCreate();
            _tool = World.GetOrCreateSystemManaged<TaskPlacementToolSystem>();
            _overlay = World.GetOrCreateSystemManaged<OverlayRenderSystem>();
        }

        protected override void OnUpdate()
        {
            if (_tool.State != PlacementState.ValidPreview && _tool.State != PlacementState.InvalidPreview) return;
            OverlayRenderSystem.Buffer buffer = _overlay.GetBuffer(out JobHandle dependency);
            dependency.Complete();
            Color fill = _tool.HasValidPreview ? new Color(0.12f, 0.72f, 1f, 0.55f) : new Color(1f, 0.2f, 0.2f, 0.45f);
            Color outline = _tool.HasValidPreview ? Color.white : Color.red;
            buffer.DrawCircle(outline, fill, 0.18f, 0f, new float2(0f, 1f), _tool.PreviewPosition, 4f);
        }
    }
}
