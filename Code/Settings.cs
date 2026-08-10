using System;
using System.Collections.Generic;
using System.Linq;
using Colossal;
using Colossal.IO.AssetDatabase;
using Game.Input;
using Game.Modding;
using Game.Settings;
using Game.UI.Localization;
using Game.UI.Widgets;

namespace Planboard
{
    [FileLocation("ModsSettings\\Planboard\\Planboard")]
    [SettingsUIKeyboardAction(TogglePanelAction, usages: new[] { Usages.kMenuUsage }, interactions: new[] { "UIButton" })]
    [SettingsUIKeyboardAction(PlaceMarkerAction, usages: new[] { Usages.kToolUsage }, interactions: new[] { "UIButton" })]
    [SettingsUIMouseAction(ApplyPlacementAction, ActionType.Button, SettingsUIInputActionAttribute.kDefaultRebindOptions, ModifierOptions.Disallow, false, usages: new[] { Usages.kToolUsage })]
    [SettingsUIMouseAction(CancelPlacementAction, ActionType.Button, SettingsUIInputActionAttribute.kDefaultRebindOptions, ModifierOptions.Disallow, false, usages: new[] { Usages.kToolUsage })]
    public sealed class Settings : ModSetting
    {
        public const string TogglePanelAction = "TogglePlanboard";
        public const string PlaceMarkerAction = "PlacePlanboardMarker";
        public const string ApplyPlacementAction = "ApplyPlanboardPlacement";
        public const string CancelPlacementAction = "CancelPlanboardPlacement";
        public const string RealLifeDeadlineMode = "real";
        public const string InGameDeadlineMode = "game";

        public Settings(IMod mod) : base(mod) { }

        [SettingsUIKeyboardBinding(BindingKeyboard.P, TogglePanelAction, ctrl: true, alt: true)]
        public ProxyBinding TogglePanel { get; set; }

        [SettingsUIKeyboardBinding(BindingKeyboard.P, PlaceMarkerAction, ctrl: true, alt: true, shift: true)]
        public ProxyBinding PlaceMarker { get; set; }

        [SettingsUIMouseBinding(BindingMouse.Left, ApplyPlacementAction, ctrl: false)]
        public ProxyBinding ApplyPlacement { get; set; }

        [SettingsUIMouseBinding(BindingMouse.Right, CancelPlacementAction, ctrl: false)]
        public ProxyBinding CancelPlacement { get; set; }

        public bool ShowCompletedMarkers { get; set; }
        public bool ShowAllTitles { get; set; }

        private readonly Dictionary<string, ProxyBinding.Watcher> _placementBindingWatchers = new();

        [SettingsUIDropdown(typeof(Settings), nameof(GetDeadlineModeOptions))]
        public string DeadlineMode { get; set; } = RealLifeDeadlineMode;


        public static DropdownItem<string>[] GetDeadlineModeOptions()
        {
            return new[]
            {
                new DropdownItem<string> { value = RealLifeDeadlineMode, displayName = LocalizedString.Value("Real-life calendar") },
                new DropdownItem<string> { value = InGameDeadlineMode, displayName = LocalizedString.Value("In-game calendar") }
            };
        }
        public int WindowLayoutRevision { get; private set; }

        public bool ResetWindowLayout
        {
            set { if (value) WindowLayoutRevision++; }
        }

        public bool ResetBindings
        {
            set
            {
                ResetKeyBindings();
                if (_placementBindingWatchers.Count > 0) EnablePlacementBindingMirrors();
            }
        }

        internal void EnablePlacementBindingMirrors()
        {
            DisablePlacementBindingMirrors();
            try
            {
                RegisterPlacementBindingMirror("Apply", ApplyPlacementAction);
                RegisterPlacementBindingMirror("Secondary Apply", CancelPlacementAction);
            }
            catch (Exception exception)
            {
                DisablePlacementBindingMirrors();
                Mod.Log.Warn($"Could not mirror the current game tool bindings; Planboard will use its default mouse bindings: {exception.Message}");
            }
        }

        internal void DisablePlacementBindingMirrors()
        {
            foreach (ProxyBinding.Watcher watcher in _placementBindingWatchers.Values) watcher.Dispose();
            _placementBindingWatchers.Clear();
        }

        private void RegisterPlacementBindingMirror(string gameActionName, string planboardActionName)
        {
            ProxyAction gameAction = InputManager.instance.FindAction(InputManager.kToolMap, gameActionName);
            ProxyAction planboardAction = GetAction(planboardActionName);
            ProxyBinding gameBinding = gameAction.bindings.FirstOrDefault(binding => (binding.device & InputManager.DeviceType.Mouse) != 0);
            ProxyBinding planboardBinding = planboardAction.bindings.FirstOrDefault(binding => (binding.device & InputManager.DeviceType.Mouse) != 0);
            if (string.IsNullOrEmpty(gameBinding.path))
                throw new InvalidOperationException($"Game action '{gameActionName}' has no mouse binding.");
            if (string.IsNullOrEmpty(planboardBinding.path))
                throw new InvalidOperationException($"Planboard action '{planboardActionName}' has no mouse binding.");
            ProxyBinding.Watcher watcher = new(gameBinding, binding => CopyBinding(planboardBinding, binding));
            CopyBinding(planboardBinding, watcher.binding);
            _placementBindingWatchers.Add(gameActionName, watcher);
        }

        private static void CopyBinding(ProxyBinding target, ProxyBinding source)
        {
            ProxyBinding replacement = target.Copy();
            replacement.path = source.path;
            replacement.modifiers = source.modifiers;
            InputManager.instance.SetBinding(replacement, out _);
        }

        public override void SetDefaults()
        {
            ShowCompletedMarkers = false;
            ShowAllTitles = false;
            DeadlineMode = RealLifeDeadlineMode;
            ResetBindings = true;
        }
    }

    public sealed class LocaleEN : IDictionarySource
    {
        private readonly Settings _settings;

        public LocaleEN(Settings settings) { _settings = settings; }

        public IEnumerable<KeyValuePair<string, string>> ReadEntries(
            IList<IDictionaryEntryError> errors,
            Dictionary<string, int> indexCounts)
        {
            return new Dictionary<string, string>
            {
                { _settings.GetSettingsLocaleID(), "Planboard" },
                { _settings.GetOptionLabelLocaleID(nameof(Settings.TogglePanel)), "Toggle Planboard" },
                { _settings.GetOptionDescLocaleID(nameof(Settings.TogglePanel)), "Open or close the Planboard panel." },
                { _settings.GetOptionLabelLocaleID(nameof(Settings.PlaceMarker)), "Place selected task marker" },
                { _settings.GetOptionDescLocaleID(nameof(Settings.PlaceMarker)), "Start marker placement for the selected entry." },
                { _settings.GetOptionLabelLocaleID(nameof(Settings.ApplyPlacement)), "Place marker" },
                { _settings.GetOptionDescLocaleID(nameof(Settings.ApplyPlacement)), "Confirm the marker location while the placement tool is active." },
                { _settings.GetOptionLabelLocaleID(nameof(Settings.CancelPlacement)), "Cancel marker placement" },
                { _settings.GetOptionDescLocaleID(nameof(Settings.CancelPlacement)), "Cancel marker placement while the placement tool is active." },
                { _settings.GetOptionLabelLocaleID(nameof(Settings.DeadlineMode)), "Preferred deadline" },
                { _settings.GetOptionDescLocaleID(nameof(Settings.DeadlineMode)), "Choose whether Planboard deadlines follow the real-life calendar or the city simulation calendar." },
                { _settings.GetOptionLabelLocaleID(nameof(Settings.ShowCompletedMarkers)), "Show completed markers" },
                { _settings.GetOptionDescLocaleID(nameof(Settings.ShowCompletedMarkers)), "Show completed work on the map with reduced emphasis." },
                { _settings.GetOptionLabelLocaleID(nameof(Settings.ShowAllTitles)), "Show all marker titles" },
                { _settings.GetOptionDescLocaleID(nameof(Settings.ShowAllTitles)), "Show marker titles even when they are not selected." },
                { _settings.GetOptionLabelLocaleID(nameof(Settings.ResetWindowLayout)), "Reset window layout" },
                { _settings.GetOptionDescLocaleID(nameof(Settings.ResetWindowLayout)), "Restore the main panel and sticky editor to their default size and position." },
                { _settings.GetOptionLabelLocaleID(nameof(Settings.ResetBindings)), "Reset key bindings" },
                { _settings.GetOptionDescLocaleID(nameof(Settings.ResetBindings)), "Restore Planboard keyboard shortcuts." },
                { _settings.GetBindingMapLocaleID(), "Planboard" },
                { "Planboard.UI.Title", "Planboard" },
                { "Planboard.UI.Subtitle", "City Tasks & Map Notes & ToDo" },
                { "Planboard.UI.Add", "Add task" },
                { "Planboard.UI.AddDistrict", "Add to Planboard" },
                { "Planboard.UI.Empty", "No entries match the current view." },
                { "Planboard.UI.Place", "Place on map" },
                { "Planboard.UI.Move", "Move marker" },
                { "Planboard.UI.RemoveLocation", "Remove marker" },
                { "Planboard.UI.DataIssues", "Data issues" },
                { "Planboard.UI.DeleteConfirm", "Delete this entry?" },
                { "Planboard.UI.PlacementHint", "Click to place the marker. Right-click or Escape to cancel." },
                { "Planboard.UI.Entries", "entries" },
                { "Planboard.UI.ToggleTooltip", "Planboard (Ctrl+Alt+P)" },
                { "Planboard.UI.DistrictDescription", "Planning notes and work for this district" },
                { "Planboard.UI.PlacingMarker", "Placing marker for" },
                { "Planboard.UI.ClickToApply", "Click the map to apply." },
                { "Planboard.UI.Cancel", "Cancel" },
                { "Planboard.UI.QuickAddPlaceholder", "What needs attention?" },
                { "Planboard.UI.TabAll", "All" },
                { "Planboard.UI.TabOpen", "Open" },
                { "Planboard.UI.TabDone", "Done" },
                { "Planboard.UI.Filters", "Filters" },
                { "Planboard.UI.SearchPlaceholder", "Search tasks and notes" },
                { "Planboard.UI.SelectEntry", "Select an entry to view details." },
                { "Planboard.UI.Kind", "Kind" },
                { "Planboard.UI.Category", "Category" },
                { "Planboard.UI.Status", "Status" },
                { "Planboard.UI.Priority", "Priority" },
                { "Planboard.UI.All", "All" },
                { "Planboard.UI.Location", "Location" },
                { "Planboard.UI.Located", "Located" },
                { "Planboard.UI.ListOnly", "List-only" },
                { "Planboard.UI.Sort", "Sort" },
                { "Planboard.UI.RecentlyUpdated", "Recently updated" },
                { "Planboard.UI.RealDeadline", "Real deadline" },
                { "Planboard.UI.GameDeadline", "In-game deadline" },
                { "Planboard.UI.UnfinishedOnly", "Unfinished only" },
                { "Planboard.UI.OverdueOnly", "Overdue only" },
                { "Planboard.UI.MissingLinks", "Missing links" },
                { "Planboard.UI.Reset", "Reset" },
                { "Planboard.UI.Overdue", "Overdue" },
                { "Planboard.UI.LinkLost", "Link lost" },
                { "Planboard.UI.Description", "Description" },
                { "Planboard.UI.MoreOptions", "More options" },
                { "Planboard.UI.Save", "Save" },
                { "Planboard.UI.Reopen", "Reopen" },
                { "Planboard.UI.MarkDone", "Mark done" },
                { "Planboard.UI.ConvertToTask", "Convert to task" },
                { "Planboard.UI.GoToMarker", "Go to marker" },
                { "Planboard.UI.Delete", "Delete" },
                { "Planboard.UI.DeleteEntry", "Delete entry" },
                { "Planboard.Kind.0", "Issue" },
                { "Planboard.Kind.1", "Note" },
                { "Planboard.Kind.2", "Idea" },
                { "Planboard.Status.0", "Open" },
                { "Planboard.Status.1", "Doing" },
                { "Planboard.Status.2", "Done" },
                { "Planboard.Priority.0", "None" },
                { "Planboard.Priority.1", "Low" },
                { "Planboard.Priority.2", "Medium" },
                { "Planboard.Priority.3", "High" },
                { "Planboard.Category.0", "Traffic" },
                { "Planboard.Category.1", "Roads" },
                { "Planboard.Category.2", "Public Transport" },
                { "Planboard.Category.3", "Walking & Cycling" },
                { "Planboard.Category.4", "Zoning & Development" },
                { "Planboard.Category.5", "City Services" },
                { "Planboard.Category.6", "Utilities" },
                { "Planboard.Category.7", "Parks & Public Space" },
                { "Planboard.Category.8", "Future Project" },
                { "Planboard.Category.9", "General" },
            };
        }

        public void Unload() { }
    }
}
