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

// Defines user-facing settings, input bindings, and their localization metadata.

namespace Planboard
{
    [FileLocation("ModsSettings\\Planboard\\Planboard")]
    [SettingsUITabOrder(GeneralTab, KeybindingsTab)]
    [SettingsUIGroupOrder(MapDisplaySection, PlanningSection, InterfaceSection, MaintenanceSection, ToolsSection, ShortcutsSection)]
    [SettingsUIShowGroupName(MapDisplaySection, PlanningSection, InterfaceSection, MaintenanceSection, ToolsSection, ShortcutsSection)]
    [SettingsUIKeyboardAction(TogglePanelAction, usages: new[] { Usages.kMenuUsage }, interactions: new[] { "UIButton" })]
    [SettingsUIKeyboardAction(PlaceMarkerAction, usages: new[] { Usages.kToolUsage }, interactions: new[] { "UIButton" })]
    [SettingsUIMouseAction(ApplyPlacementAction, ActionType.Button, SettingsUIInputActionAttribute.kDefaultRebindOptions, ModifierOptions.Disallow, false, usages: new[] { PlacementToolUsage })]
    [SettingsUIMouseAction(CancelPlacementAction, ActionType.Button, SettingsUIInputActionAttribute.kDefaultRebindOptions, ModifierOptions.Disallow, false, usages: new[] { PlacementToolUsage })]
    public sealed class Settings : ModSetting
    {
        // Stable identifiers are shared by settings attributes, localization, and UI bindings.
        public const string GeneralTab = "General";
        public const string KeybindingsTab = "Keybindings";
        public const string MapDisplaySection = "MapDisplay";
        public const string PlanningSection = "Planning";
        public const string InterfaceSection = "Interface";
        public const string MaintenanceSection = "Maintenance";
        public const string ToolsSection = "Tools";
        public const string ShortcutsSection = "Shortcuts";
        public const string PlacementToolUsage = "Planboard.Tool";
        public const string TogglePanelAction = "TogglePlanboard";
        public const string PlaceMarkerAction = "PlacePlanboardMarker";
        public const string ApplyPlacementAction = "ApplyPlanboardPlacement";
        public const string CancelPlacementAction = "CancelPlanboardPlacement";
        public const string RealLifeDeadlineMode = "real";
        public const string InGameDeadlineMode = "game";
        public const string TopLeftToolbarLocation = "topLeft";
        public const string FooterToolbarLocation = "footer";

        public Settings(IMod mod) : base(mod) { }

        // General shortcuts remain configurable independently of the placement tool's scoped actions.
        [SettingsUISection(KeybindingsTab, ShortcutsSection)]
        [SettingsUIKeyboardBinding(BindingKeyboard.P, TogglePanelAction, ctrl: true, alt: true)]
        public ProxyBinding TogglePanel { get; set; }

        [SettingsUISection(KeybindingsTab, ShortcutsSection)]
        [SettingsUIKeyboardBinding(BindingKeyboard.P, PlaceMarkerAction, ctrl: true, alt: true, shift: true)]
        public ProxyBinding PlaceMarker { get; set; }

        // Tool bindings are active only while Planboard owns the placement tool.
        [SettingsUISection(KeybindingsTab, ToolsSection)]
        [SettingsUISetter(typeof(Settings), nameof(OnUseVanillaToolBindingsSet))]
        public bool UseVanillaToolBindings { get; set; } = true;

        // These actions use a separate action map and are enabled only during placement.
        // Vanilla mode keeps them synchronized with CS2; custom mode leaves them editable.
        [SettingsUISection(KeybindingsTab, ToolsSection)]
        [SettingsUIDisableByCondition(typeof(Settings), nameof(UseVanillaToolBindings))]
        [SettingsUIMouseBinding(BindingMouse.Left, ApplyPlacementAction, ctrl: false)]
        public ProxyBinding ApplyPlacement { get; set; }

        [SettingsUISection(KeybindingsTab, ToolsSection)]
        [SettingsUIDisableByCondition(typeof(Settings), nameof(UseVanillaToolBindings))]
        [SettingsUIMouseBinding(BindingMouse.Right, CancelPlacementAction, ctrl: false)]
        public ProxyBinding CancelPlacement { get; set; }

        [SettingsUISection(GeneralTab, MapDisplaySection)]
        public bool ShowCompletedMarkers { get; set; }

        [SettingsUISection(GeneralTab, MapDisplaySection)]
        public bool ShowAllTitles { get; set; }

        // Watchers mirror CS2's current mouse bindings while vanilla mode is enabled.
        // They are disposed before replacement so repeated settings changes cannot accumulate listeners.
        private readonly Dictionary<string, ProxyBinding.Watcher> _placementBindingWatchers = new();
        private bool _placementBindingsInitialized;

        [SettingsUISection(GeneralTab, PlanningSection)]
        [SettingsUIDropdown(typeof(Settings), nameof(GetDeadlineModeOptions))]
        public string DeadlineMode { get; set; } = RealLifeDeadlineMode;

        [SettingsUISection(GeneralTab, InterfaceSection)]
        [SettingsUIDropdown(typeof(Settings), nameof(GetToolbarLocationOptions))]
        public string ToolbarLocation { get; set; } = TopLeftToolbarLocation;

        // Dropdown values remain stable identifiers; localized display text can change independently.
        public static DropdownItem<string>[] GetDeadlineModeOptions()
        {
            return new[]
            {
                new DropdownItem<string> { value = RealLifeDeadlineMode, displayName = LocalizedString.Value("Real-life calendar") },
                new DropdownItem<string> { value = InGameDeadlineMode, displayName = LocalizedString.Value("In-game calendar") }
            };
        }

        public static DropdownItem<string>[] GetToolbarLocationOptions()
        {
            return new[]
            {
                new DropdownItem<string> { value = TopLeftToolbarLocation, displayName = LocalizedString.Value("Top-left toolbar") },
                new DropdownItem<string> { value = FooterToolbarLocation, displayName = LocalizedString.Value("Footer toolbar") }
            };
        }

        // Maintenance actions are write-only toggles because the game settings UI renders them as buttons.
        [SettingsUISection(GeneralTab, MaintenanceSection)]
        public int WindowLayoutRevision { get; private set; }

        [SettingsUISection(GeneralTab, MaintenanceSection)]
        public bool ResetWindowLayout
        {
            set { if (value) WindowLayoutRevision++; }
        }
        [SettingsUISection(KeybindingsTab, ShortcutsSection)]
        public bool ResetBindings
        {
            set
            {
                ResetKeyBindings();
                if (_placementBindingsInitialized) ApplyPlacementBindingMode();
            }
        }

        // Binding mirrors are installed after settings load and refreshed whenever their mode changes.
        internal void InitializePlacementBindings()
        {
            _placementBindingsInitialized = true;
            ApplyPlacementBindingMode();
        }

        private void ApplyPlacementBindingMode()
        {
            if (UseVanillaToolBindings) EnablePlacementBindingMirrors();
            else DisablePlacementBindingMirrors();
        }

        private void OnUseVanillaToolBindingsSet(bool value)
        {
            if (!_placementBindingsInitialized) return;
            if (value) EnablePlacementBindingMirrors();
            else DisablePlacementBindingMirrors();
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
                Mod.Log.Warn(
                    "Could not mirror the current game tool bindings; Planboard will use its "
                        + $"default mouse bindings: {exception.Message}"
                );
            }
        }

        internal void DisablePlacementBindingMirrors()
        {
            foreach (ProxyBinding.Watcher watcher in _placementBindingWatchers.Values)
                watcher.Dispose();
            _placementBindingWatchers.Clear();
        }

        private void RegisterPlacementBindingMirror(string gameActionName, string planboardActionName)
        {
            ProxyAction gameAction = InputManager.instance.FindAction(InputManager.kToolMap, gameActionName);
            ProxyAction planboardAction = GetAction(planboardActionName);
            ProxyBinding gameBinding = gameAction.bindings.FirstOrDefault(
                binding => (binding.device & InputManager.DeviceType.Mouse) != 0
            );
            ProxyBinding planboardBinding = planboardAction.bindings.FirstOrDefault(
                binding => (binding.device & InputManager.DeviceType.Mouse) != 0
            );
            if (string.IsNullOrEmpty(gameBinding.path))
                throw new InvalidOperationException(
                    $"Game action '{gameActionName}' has no mouse binding."
                );
            if (string.IsNullOrEmpty(planboardBinding.path))
                throw new InvalidOperationException(
                    $"Planboard action '{planboardActionName}' has no mouse binding."
                );

            ProxyBinding.Watcher watcher = new(
                gameBinding,
                binding => CopyBinding(planboardBinding, binding)
            );
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
            UseVanillaToolBindings = true;
            DeadlineMode = RealLifeDeadlineMode;
            ToolbarLocation = TopLeftToolbarLocation;
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
            // Settings and binding labels live alongside UI strings so the mod has one English source.
            return new Dictionary<string, string>
            {
                { _settings.GetSettingsLocaleID(), "Planboard" },
                { _settings.GetOptionTabLocaleID(Settings.GeneralTab), "General" },
                { _settings.GetOptionTabLocaleID(Settings.KeybindingsTab), "Key bindings" },
                { _settings.GetOptionGroupLocaleID(Settings.MapDisplaySection), "Map display" },
                { _settings.GetOptionGroupLocaleID(Settings.PlanningSection), "Planning" },
                { _settings.GetOptionGroupLocaleID(Settings.InterfaceSection), "Interface" },
                { _settings.GetOptionGroupLocaleID(Settings.MaintenanceSection), "Maintenance" },
                { _settings.GetOptionGroupLocaleID(Settings.ToolsSection), "Tools" },
                { _settings.GetOptionGroupLocaleID(Settings.ShortcutsSection), "Shortcuts" },
                { _settings.GetOptionLabelLocaleID(nameof(Settings.TogglePanel)), "Toggle Planboard" },
                { _settings.GetOptionDescLocaleID(nameof(Settings.TogglePanel)), "Open or close the Planboard panel." },
                { _settings.GetOptionLabelLocaleID(nameof(Settings.PlaceMarker)), "Place selected task marker" },
                { _settings.GetOptionDescLocaleID(nameof(Settings.PlaceMarker)), "Start marker placement for the selected entry." },
                { _settings.GetOptionLabelLocaleID(nameof(Settings.UseVanillaToolBindings)), "Use vanilla tool bindings" },
                {
                    _settings.GetOptionDescLocaleID(nameof(Settings.UseVanillaToolBindings)),
                    "Mirror Cities: Skylines II's current apply and cancel tool controls."
                },
                { _settings.GetOptionLabelLocaleID(nameof(Settings.ApplyPlacement)), "Apply tool action" },
                {
                    _settings.GetOptionDescLocaleID(nameof(Settings.ApplyPlacement)),
                    "Used only while placing a Planboard marker."
                },
                { _settings.GetOptionLabelLocaleID(nameof(Settings.CancelPlacement)), "Cancel tool action" },
                {
                    _settings.GetOptionDescLocaleID(nameof(Settings.CancelPlacement)),
                    "Used only while placing a Planboard marker."
                },
                { _settings.GetOptionLabelLocaleID(nameof(Settings.DeadlineMode)), "Preferred deadline" },
                {
                    _settings.GetOptionDescLocaleID(nameof(Settings.DeadlineMode)),
                    "Choose whether Planboard deadlines follow the real-life calendar " +
                    "or the city simulation calendar."
                },
                { _settings.GetOptionLabelLocaleID(nameof(Settings.ToolbarLocation)), "Toolbar location" },
                {
                    _settings.GetOptionDescLocaleID(nameof(Settings.ToolbarLocation)),
                    "Choose where Planboard's grouped map controls appear."
                },
                { _settings.GetOptionLabelLocaleID(nameof(Settings.ShowCompletedMarkers)), "Show completed markers" },
                { _settings.GetOptionDescLocaleID(nameof(Settings.ShowCompletedMarkers)), "Show completed work on the map with reduced emphasis." },
                { _settings.GetOptionLabelLocaleID(nameof(Settings.ShowAllTitles)), "Show all marker titles" },
                { _settings.GetOptionDescLocaleID(nameof(Settings.ShowAllTitles)), "Show marker titles even when they are not selected." },
                { _settings.GetOptionLabelLocaleID(nameof(Settings.ResetWindowLayout)), "Reset window layout" },
                {
                    _settings.GetOptionDescLocaleID(nameof(Settings.ResetWindowLayout)),
                    "Restore the main panel and sticky editor to their default size and position."
                },
                { _settings.GetOptionLabelLocaleID(nameof(Settings.ResetBindings)), "Reset key bindings" },
                { _settings.GetOptionDescLocaleID(nameof(Settings.ResetBindings)), "Restore Planboard keyboard shortcuts." },
                { _settings.GetBindingMapLocaleID(), "Planboard" },
                { "Planboard.UI.Title", "Planboard" },
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
                { "Planboard.UI.Located", "With pin location" },
                { "Planboard.UI.ListOnly", "Only in list" },
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
