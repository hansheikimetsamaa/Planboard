// Typed reactive bindings exposed by the native Planboard UI system.

import { bindValue } from "cs2/api";
import {
  Binding,
  DataIssueView,
  DateFormat,
  DeadlineMode,
  EntryView,
  MapDisplayMode,
  PlacementState,
  ProjectedMarkerView,
  ToolbarLocation,
} from "./types/contracts";

export const entries$ = bindValue<EntryView[]>(Binding.group, Binding.entries, []);
export const panelVisible$ = bindValue<boolean>(Binding.group, Binding.panelVisible, false);
export const selectedEntryId$ = bindValue<number>(Binding.group, Binding.selectedEntryId, 0);
export const placementState$ = bindValue<PlacementState>(
  Binding.group,
  Binding.placementState,
  PlacementState.Inactive,
);
export const placementEntryId$ = bindValue<number>(Binding.group, Binding.placementEntryId, 0);
export const continuousPlacement$ = bindValue<boolean>(
  Binding.group,
  Binding.continuousPlacement,
  false,
);
export const draftEntryId$ = bindValue<number>(Binding.group, Binding.draftEntryId, 0);
export const districtSelected$ = bindValue<boolean>(Binding.group, Binding.districtSelected, false);
export const districtEntries$ = bindValue<EntryView[]>(Binding.group, Binding.districtEntries, []);
export const districtSelectionRevision$ = bindValue<number>(
  Binding.group,
  Binding.districtSelectionRevision,
  0,
);
export const dataIssues$ = bindValue<DataIssueView[]>(Binding.group, Binding.dataIssues, []);
export const mapDisplayMode$ = bindValue<MapDisplayMode>(
  Binding.group,
  Binding.mapDisplayMode,
  MapDisplayMode.Pins,
);
export const projectedMarkers$ = bindValue<ProjectedMarkerView[]>(
  Binding.group,
  Binding.projectedMarkers,
  [],
);

export const undoAvailable$ = bindValue<boolean>(Binding.group, Binding.undoAvailable, false);

export const windowLayoutRevision$ = bindValue<number>(
  Binding.group,
  Binding.windowLayoutRevision,
  0,
);
export const deadlineMode$ = bindValue<DeadlineMode>(Binding.group, Binding.deadlineMode, "real");
export const dateFormat$ = bindValue<DateFormat>(Binding.group, Binding.dateFormat, "iso");
export const toolbarLocation$ = bindValue<ToolbarLocation>(
  Binding.group,
  Binding.toolbarLocation,
  "topLeft",
);
export const currentRealDate$ = bindValue<string>(Binding.group, Binding.currentRealDate, "");
export const currentGameDate$ = bindValue<string>(Binding.group, Binding.currentGameDate, "");
export const dataReadOnly$ = bindValue<boolean>(Binding.group, Binding.dataReadOnly, false);
