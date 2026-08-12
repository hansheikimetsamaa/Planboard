# Changelog

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
