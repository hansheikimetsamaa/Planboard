import { bindValue } from "cs2/api";
import { Binding, DeadlineMode, EntryView, MapDisplayMode, PlacementState, ProjectedMarkerView } from "./types/contracts";

export const entries$ = bindValue<EntryView[]>(Binding.group, Binding.entries, []);
export const panelVisible$ = bindValue<boolean>(Binding.group, Binding.panelVisible, false);
export const selectedEntryId$ = bindValue<number>(Binding.group, Binding.selectedEntryId, 0);
export const placementState$ = bindValue<PlacementState>(Binding.group, Binding.placementState, PlacementState.Inactive);
export const placementEntryId$ = bindValue<number>(Binding.group, Binding.placementEntryId, 0);
export const draftEntryId$ = bindValue<number>(Binding.group, Binding.draftEntryId, 0);
export const districtSelected$ = bindValue<boolean>(Binding.group, Binding.districtSelected, false);
export const dataIssues$ = bindValue<string[]>(Binding.group, Binding.dataIssues, []);
export const mapDisplayMode$ = bindValue<MapDisplayMode>(Binding.group, Binding.mapDisplayMode, MapDisplayMode.Pins);
export const projectedMarkers$ = bindValue<ProjectedMarkerView[]>(Binding.group, Binding.projectedMarkers, []);

export const undoAvailable$ = bindValue<boolean>(Binding.group, Binding.undoAvailable, false);

export const windowLayoutRevision$ = bindValue<number>(Binding.group, Binding.windowLayoutRevision, 0);
export const deadlineMode$ = bindValue<DeadlineMode>(Binding.group, Binding.deadlineMode, "real");
