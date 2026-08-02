# Planboard acceptance matrix

## Data and saves

- Create, edit, complete, reopen, and delete every entry kind.
- Round-trip zero, one, 500, and the 10,000-entry limit through save/reload.
- Load duplicated IDs, invalid enums, oversized text, invalid coordinates, and missing links; verify repair and Data issues output.
- Confirm transient placement drafts never enter a save and cancellation removes them.
- Confirm disabling the mod does not prevent the city save from loading.

## Deadlines and organization

- Test no deadline in both preferred-calendar modes.
- Switch between real-life and in-game preference without losing the inactive stored date.
- Advance the selected clock across a deadline and verify sorting, overdue filters, and map-card indicators.
- Exercise every tab, combined filter, sort mode, category chip, and search path.

## Creation and deletion flows

- Verify `+` opens the full detail creator without immediately creating an entry.
- Test Create item, Create & place, Enter, Ctrl+Enter, Back, and Escape.
- Delete from detail with confirmation and from a list row without confirmation.
- Verify nearest-row focus and eight-second Undo restoration.

## Placement and map

- Test terrain, road, building, district, elevated, and underground hits.
- Test list-only → located → moved → list-only.
- Test Apply, Escape, right-click, panel interaction, UI-disabled raycasts, and tool switching.
- Delete linked entities and edit district boundaries without losing fallback positions.
- Verify pins, open notes, priority tints, overdue badges, selection, and camera focus.

## Windows and compatibility

- Resize, drag, persist, clamp, and reset both windows at several UI scales.
- Run with no other mods and with common UI and road/network mods.
- Confirm the district hook can fail without hiding or crashing the main panel.
- Profile 500 visible markers and 10,000 list-only entries for frame-time or UI latency regressions.
