// Renders interactive on-map note cards from projected marker bindings.

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { trigger, useValue } from "cs2/api";
import { Button } from "cs2/ui";
import {
  deadlineMode$,
  dateFormat$,
  draftEntryId$,
  entries$,
  mapDisplayMode$,
  panelVisible$,
  placementState$,
  projectedMarkers$,
  selectedEntryId$,
} from "../bindings";
import { usePlanboardLocale } from "../labels";
import { formatDateInput, ticksToDateInput } from "../model";
import {
  Binding,
  EntryKind,
  EntryPriority,
  EntryStatus,
  MapDisplayMode,
  PlacementState,
} from "../types/contracts";
import { KindIcon } from "./KindIcon";
import styles from "./mapNotesOverlay.module.scss";

type DragState = { id: number; locationId: number; screenX: number; screenY: number };
type PendingDrag = {
  id: number;
  locationId: number;
  startX: number;
  startY: number;
  dragging: boolean;
};

const dragThreshold = 6;

const screenRatio = (value: number, total: number) =>
  Math.max(0, Math.min(1, value / Math.max(1, total)));

export function MapNotesOverlay() {
  const mode = useValue(mapDisplayMode$) ?? MapDisplayMode.Pins;
  const deadlineMode = useValue(deadlineMode$) ?? "real";
  const dateFormat = useValue(dateFormat$) ?? "iso";
  const draftId = useValue(draftEntryId$) ?? 0;
  const panelVisible = useValue(panelVisible$) ?? false;
  const placementState = useValue(placementState$) ?? PlacementState.Inactive;
  const selectedId = useValue(selectedEntryId$) ?? 0;
  const entries = useValue(entries$) ?? [];
  const markers = useValue(projectedMarkers$) ?? [];
  const { categoryLabels } = usePlanboardLocale();
  const byId = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const pendingDrag = useRef<PendingDrag | null>(null);
  const suppressOpenId = useRef<number | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  useEffect(() => {
    if (dragState && placementState === PlacementState.Cancelled) {
      setDragState(null);
    }
  }, [dragState, placementState]);

  const beginDrag = (
    id: number,
    locationId: number,
    event: ReactMouseEvent<HTMLElement>,
    movable: boolean,
  ) => {
    if (!movable || event.button !== 0) return;
    pendingDrag.current = {
      id,
      locationId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };

    const updateGhost = (next: MouseEvent) => {
      const pending = pendingDrag.current;
      if (!pending || pending.id !== id) return;
      const moved = Math.hypot(next.clientX - pending.startX, next.clientY - pending.startY);
      if (!pending.dragging && moved < dragThreshold) return;
      if (!pending.dragging) {
        pending.dragging = true;
        suppressOpenId.current = id;
        trigger(Binding.group, Binding.beginMarkerDrag, id, locationId);
      }

      next.preventDefault();
      setDragState({
        id,
        locationId,
        screenX: screenRatio(next.clientX, window.innerWidth),
        screenY: screenRatio(next.clientY, window.innerHeight),
      });
    };

    const finish = () => {
      const pending = pendingDrag.current;
      document.removeEventListener("mousemove", updateGhost);
      document.removeEventListener("mouseup", finish);
      pendingDrag.current = null;
      if (!pending?.dragging) return;
      trigger(Binding.group, Binding.finishMarkerDrag);
      setDragState(null);
      window.setTimeout(() => {
        if (suppressOpenId.current === id) suppressOpenId.current = null;
      }, 0);
    };

    document.addEventListener("mousemove", updateGhost);
    document.addEventListener("mouseup", finish);
  };

  if (mode === MapDisplayMode.Hidden || draftId > 0) return null;

  return (
    <div className={styles.layer}>
      {markers.map((marker) => {
        const entry = byId.get(marker.id);
        if (!entry || !marker.visible || (panelVisible && entry.id !== selectedId)) return null;
        const category = entry.categoryName || categoryLabels[entry.category] || "General";
        const kindClass =
          entry.kind === EntryKind.Issue
            ? styles.issue
            : entry.kind === EntryKind.Idea
              ? styles.idea
              : styles.note;
        const priorityClass =
          entry.priority === EntryPriority.High
            ? styles.high
            : entry.priority === EntryPriority.Medium
              ? styles.medium
              : entry.priority === EntryPriority.Low
                ? styles.low
                : styles.none;
        const dueDate = ticksToDateInput(
          deadlineMode === "game" ? entry.gameDueDateTicks : entry.realDueDateTicks,
        );
        const overdue = deadlineMode === "game" ? entry.gameOverdue : entry.realOverdue;
        const dueText = overdue ? "Overdue" : formatDateInput(dueDate, dateFormat);
        const openClass = mode === MapDisplayMode.Notes ? styles.alwaysOpen : "";
        const selectedClass = entry.id === selectedId ? styles.selected : "";
        const doneClass = entry.status === EntryStatus.Done ? styles.done : "";
        const districtClass = marker.isDistrict ? styles.district : "";
        const stackedClass = marker.districtCount > 1 ? styles.stacked : "";
        const movable = !marker.isDistrict;
        const movableClass = movable ? styles.movable : "";
        const dragging = dragState?.id === entry.id && dragState.locationId === marker.locationId;
        const draggingClass = dragging ? styles.dragging : "";
        const openEntry = () => {
          if (suppressOpenId.current === entry.id) return;
          trigger(Binding.group, Binding.selectEntry, entry.id);
        };
        const screenX = dragging ? dragState.screenX : marker.screenX;
        const screenY = dragging ? dragState.screenY : marker.screenY;
        return (
          <div
            key={`${entry.id}-${marker.locationId}`}
            className={`${styles.anchor} ${priorityClass} ${openClass} ${doneClass} ${selectedClass} ${draggingClass}`}
            style={{ left: `${screenX * 100}%`, top: `${screenY * 100}%` }}
          >
            <Button
              variant="flat"
              className={`${styles.card} ${kindClass} ${priorityClass} ${districtClass} ${movableClass}`}
              onSelect={openEntry}
              onMouseDown={(event: ReactMouseEvent<HTMLElement>) =>
                beginDrag(entry.id, marker.locationId, event, movable)
              }
            >
              <span className={styles.cardHeader}>
                <span className={`${styles.cardKind} ${kindClass} ${districtClass}`}>
                  <KindIcon kind={entry.kind} />
                </span>
                <strong>{entry.title}</strong>
              </span>
              <span className={styles.meta}>
                <span className={styles.categoryMeta}>{category}</span>
                {dueText && (
                  <span className={overdue ? styles.overdue : styles.due}>{dueText}</span>
                )}
              </span>
            </Button>
            <span className={styles.tail}></span>
            <Button
              variant="flat"
              className={`${styles.marker} ${kindClass} ${priorityClass} ${districtClass} ${stackedClass} ${movableClass}`}
              onSelect={openEntry}
              onMouseDown={(event: ReactMouseEvent<HTMLElement>) =>
                beginDrag(entry.id, marker.locationId, event, movable)
              }
            >
              <KindIcon kind={entry.kind} className={styles.markerIcon} />
              {marker.districtCount > 1 && (
                <span className={styles.districtCount}>{marker.districtCount}</span>
              )}
              {overdue && <span className={styles.badge}>!</span>}
              {entry.status === EntryStatus.Done && <span className={styles.badge}>x</span>}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
