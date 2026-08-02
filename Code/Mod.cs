using Colossal.IO.AssetDatabase;
using Colossal.Logging;
using Game;
using Game.Input;
using Game.Modding;
using Game.Rendering;
using Game.SceneFlow;
using Game.Tools;
using Planboard.Rendering;
using Planboard.Systems;
using Planboard.Tools;
using Planboard.UI;
using Unity.Entities;
using UnityEngine.InputSystem;

namespace Planboard
{
    public sealed class Mod : IMod
    {
        public const string Id = "planboard";
        public static readonly ILog Log = LogManager.GetLogger("Planboard").SetShowsErrorsInUI(false);
        public static Settings Settings { get; private set; }

        private ProxyAction _toggleAction;
        private ProxyAction _placeAction;

        public void OnLoad(UpdateSystem updateSystem)
        {
            Log.Info("Loading Planboard 0.1.0");

            Settings = new Settings(this);
            Settings.RegisterKeyBindings();
            Settings.RegisterInOptionsUI();
            AssetDatabase.global.LoadSettings("Planboard", Settings, new Settings(this));
            GameManager.instance.localizationManager.AddSource("en-US", new LocaleEN(Settings));

            _toggleAction = Settings.GetAction(Settings.TogglePanelAction);
            _placeAction = Settings.GetAction(Settings.PlaceMarkerAction);
            _toggleAction.onInteraction += OnTogglePanel;
            _placeAction.onInteraction += OnPlaceMarker;

            updateSystem.UpdateAt<TaskDataSystem>(SystemUpdatePhase.UIUpdate);
            updateSystem.UpdateBefore<TaskValidationSystem, TaskDataSystem>(SystemUpdatePhase.UIUpdate);
            updateSystem.UpdateAt<TaskMarkerSystem>(SystemUpdatePhase.UIUpdate);
            updateSystem.UpdateAfter<TaskMarkerSystem, TaskDataSystem>(SystemUpdatePhase.UIUpdate);
            updateSystem.UpdateAt<TaskUISystem>(SystemUpdatePhase.UIUpdate);
            updateSystem.UpdateAfter<TaskUISystem, TaskDataSystem>(SystemUpdatePhase.UIUpdate);

            updateSystem.UpdateAt<TaskPlacementToolSystem>(SystemUpdatePhase.ToolUpdate);
            updateSystem.UpdateAfter<TaskPlacementOverlaySystem, AreaRenderSystem>(SystemUpdatePhase.Rendering);
            updateSystem.UpdateAfter<TaskMarkerOverlaySystem, TaskPlacementOverlaySystem>(SystemUpdatePhase.Rendering);
            updateSystem.UpdateAt<TaskPlacementTooltipSystem>(SystemUpdatePhase.UITooltip);
            updateSystem.UpdateBefore<TaskDataClearSystem>(SystemUpdatePhase.Deserialize);
        }

        private static bool IsPlayableGame()
        {
            return GameManager.instance.gameMode == GameMode.Game;
        }

        private void OnTogglePanel(ProxyAction action, InputActionPhase phase)
        {
            if (phase != InputActionPhase.Performed || !IsPlayableGame()) return;
            World.DefaultGameObjectInjectionWorld.GetOrCreateSystemManaged<TaskUISystem>().TogglePanel();
        }

        private void OnPlaceMarker(ProxyAction action, InputActionPhase phase)
        {
            if (phase != InputActionPhase.Performed || !IsPlayableGame()) return;
            TaskUISystem ui = World.DefaultGameObjectInjectionWorld.GetOrCreateSystemManaged<TaskUISystem>();
            if (ui.SelectedEntryId > 0) ui.BeginPlacement(ui.SelectedEntryId);
        }

        public void OnDispose()
        {
            if (_toggleAction != null) _toggleAction.onInteraction -= OnTogglePanel;
            if (_placeAction != null) _placeAction.onInteraction -= OnPlaceMarker;
            Settings?.UnregisterInOptionsUI();
            Settings = null;
            Log.Info("Disposed Planboard");
        }
    }
}
