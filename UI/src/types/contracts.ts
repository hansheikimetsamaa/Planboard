export const Binding = {
  group: "planboard",
  entries: "entries",
  revision: "revision",
  panelVisible: "panelVisible",
  selectedEntryId: "selectedEntryId",
  placementState: "placementState",
  placementEntryId: "placementEntryId",
  draftEntryId: "draftEntryId",
  districtSelected: "districtSelected",
  dataIssues: "dataIssues",
  mapDisplayMode: "mapDisplayMode",
  projectedMarkers: "projectedMarkers",
  undoAvailable: "undoAvailable",
  windowLayoutRevision: "windowLayoutRevision",
  deadlineMode: "deadlineMode",
  currentRealDate: "currentRealDate",
  currentGameDate: "currentGameDate",
  dataReadOnly: "dataReadOnly",
  createEntry: "createEntry",
  createPinnedDraft: "createPinnedDraft",
  finishDraft: "finishDraft",
  commitDraft: "commitDraft",
  discardDraft: "discardDraft",
  updateEntry: "updateEntry",
  deleteEntry: "deleteEntry",
  setStatus: "setStatus",
  convertIdea: "convertIdea",
  selectEntry: "selectEntry",
  beginPlacement: "beginPlacement",
  cancelPlacement: "cancelPlacement",
  removeLocation: "removeLocation",
  createDistrictEntry: "createDistrictEntry",
  navigateToEntry: "navigateToEntry",
  setPanelVisible: "setPanelVisible",
  cycleMapDisplayMode: "cycleMapDisplayMode",
  undoDelete: "undoDelete"
} as const;

export enum EntryKind { Issue, Task, Idea }
export enum EntryStatus { Open, Doing, Done }
export enum EntryPriority { None, Low, Medium, High }
export enum SpatialKind { None, Point, Line, Area }
export enum LinkState { Unlinked, Valid, Missing }
export enum PlacementState { Inactive, ChoosingLocation, ValidPreview, InvalidPreview, Applied, Cancelled }
export enum MapDisplayMode { Hidden, Pins, Notes }
export enum EntryCategory {
  Traffic,
  Roads,
  PublicTransport,
  WalkingCycling,
  ZoningDevelopment,
  CityServices,
  Utilities,
  ParksPublicSpace,
  FutureProject,
  General
}

export interface EntryView {
  id: number;
  title: string;
  description: string;
  kind: EntryKind;
  category: EntryCategory;
  categoryName: string;
  status: EntryStatus;
  priority: EntryPriority;
  createdUtcTicks: string;
  updatedUtcTicks: string;
  realDueDateTicks: string;
  gameDueDateTicks: string;
  realOverdue: boolean;
  gameOverdue: boolean;
  spatialKind: SpatialKind;
  hasLocation: boolean;
  x: number;
  y: number;
  z: number;
  linkState: LinkState;
  hasDistrict: boolean;
  markerMoved: boolean;
}

export interface DataIssueView {
  severity: 0 | 1;
  entryId: number;
  message: string;
}

export type MainTab = "all" | "open" | "done";
export type DeadlineMode = "real" | "game";
export type SortMode = "updated" | "priority" | "category" | "deadline";

export interface Filters {
  query: string;
  tab: MainTab;
  kind: number;
  category: number;
  status: number;
  priority: number;
  location: "all" | "located" | "list";
  missingLinksOnly: boolean;
  overdueOnly: boolean;
  unfinishedOnly: boolean;
  sort: SortMode;
}


export interface ProjectedMarkerView {
  id: number;
  screenX: number;
  screenY: number;
  visible: boolean;
}
