using Game.Tools;
using Game.UI.Localization;
using Game.UI.Tooltip;
using Planboard.Data;
using Planboard.Tools;

namespace Planboard.UI
{
    public partial class TaskPlacementTooltipSystem : TooltipSystemBase
    {
        private ToolSystem _toolSystem;
        private TaskPlacementToolSystem _placementTool;
        private StringTooltip _tooltip;

        protected override void OnCreate()
        {
            base.OnCreate();
            _toolSystem = World.GetOrCreateSystemManaged<ToolSystem>();
            _placementTool = World.GetOrCreateSystemManaged<TaskPlacementToolSystem>();
            _tooltip = new StringTooltip { path = "Planboard.Placement" };
        }

        protected override void OnUpdate()
        {
            if (_toolSystem.activeTool != _placementTool) return;
            _tooltip.value = LocalizedString.Id("Planboard.UI.PlacementHint");
            _tooltip.color = _placementTool.State == PlacementState.InvalidPreview ? TooltipColor.Error : TooltipColor.Info;
            AddMouseTooltip(_tooltip);
        }
    }
}
