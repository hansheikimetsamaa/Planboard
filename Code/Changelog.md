# Changelog

## 0.1.5 - 2026-08-13

### New

- Added a top-left toolbar option, now the default. The footer toolbar remains available in Settings.
- Added Open, Doing, and Done status filters and quick status changes in the task list.
- Added clearer filter menus, including “With pin location” and “Only in list”.

### Improved

- Fixed pin placement and moving on terrain, roads, buildings, and map objects.
- Placement now uses the game’s normal tool actions; right-click, Escape, and tool switching cancel cleanly.
- “Create & Place” drafts are only saved after a pin is successfully placed.
- Improved task list scrolling, visible scrollbar, row spacing, status menus, and pop-up behaviour.
- Improved category and deadline dropdowns in the task editor.
- Improved marker cards so long titles wrap correctly.
- Reworked icon states for clearer contrast and no hover flicker.
- Improved settings sections and vanilla tool-binding support.
- Made task-list menus close cleanly when another menu opens or the background is clicked.
- Standardised panel spacing, button padding, corner radii, and icon treatment across the interface.

### Reliability

- Improved save validation and protection for unsupported newer save versions.
- Added more regression checks and cleaned up formatting, comments, and source structure.

## 0.1.4 - 2026-08-11

- Added mouse-wheel scrolling and a visible scrollbar to the task list.
- Let filter menus overlay the list so their options remain fully usable.
- Wrapped map-note titles and refined the draft editor to keep priority visible and reduce clutter.

## 0.1.3 - 2026-08-11

- Restored native terrain, road, and building marker placement using dedicated mod input actions mirrored from current game bindings.
- Restored calendar, deadline, filters, map modes, autosave, undo, draft flow, and native placement actions.
- Replaced cycling filters with explicit dropdown menus and improved inactive toolbar and kind icon contrast.
- Fixed task focus cleanup, compact draft layout, and corrupted UI text encoding.

## 0.1.2 - 2026-08-05

- Changed Planboard defaults to Ctrl+Alt+P and Ctrl+Alt+Shift+P to avoid common mod shortcut conflicts.
- Fixed CS2 toolchain compatibility when creating runtime marker and navigation entities.
- Updated the navigation regression check for the compatible entity-creation path.

## 0.1.1 - 2026-08-04

- Fixed unsupported save versions to fail closed rather than serialize an empty replacement.
- Fixed interrupted marker placement to cancel transient entries safely.
- Fixed navigation to hidden completed markers using a coordinate anchor.
- Added structured, visible data-repair reports and in-game compatibility notices.
- Improved large-list responsiveness, form accessibility, and native build verification.

## 0.1.0 - Initial public release

- Added location-aware issues, notes, and ideas.
- Added list, detail, quick-pin, and sticky-note workflows.
- Added status, priority, custom category, preferred deadline, search, filter, and sorting controls.
- Added map visibility modes, marker navigation, and district quick creation.
- Added recoverable deletion and resizable persistent windows.
- Added versioned save data validation and repair reporting.
