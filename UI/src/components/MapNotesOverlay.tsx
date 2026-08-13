// Renders interactive on-map note cards from projected marker bindings.

import { useMemo } from "react";
import { trigger, useValue } from "cs2/api";
import { Button } from "cs2/ui";
import {
  deadlineMode$,
  draftEntryId$,
  entries$,
  mapDisplayMode$,
  panelVisible$,
  projectedMarkers$,
  selectedEntryId$,
} from "../bindings";
import { usePlanboardLocale } from "../labels";
import { ticksToDateInput } from "../model";
import { Binding, EntryKind, EntryPriority, EntryStatus, MapDisplayMode } from "../types/contracts";
import { KindIcon } from "./KindIcon";
import { StatusIcon } from "./StatusIcon";
import styles from "./mapNotesOverlay.module.scss";

export function MapNotesOverlay() {
  const mode = useValue(mapDisplayMode$) ?? MapDisplayMode.Pins;
  const deadlineMode = useValue(deadlineMode$) ?? "real";
  const draftId = useValue(draftEntryId$) ?? 0;
  const panelVisible = useValue(panelVisible$) ?? false;
  const selectedId = useValue(selectedEntryId$) ?? 0;
  const entries = useValue(entries$) ?? [];
  const markers = useValue(projectedMarkers$) ?? [];
  const { categoryLabels, statusLabels } = usePlanboardLocale();
  const byId = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
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
        const dueText = overdue ? "Overdue" : dueDate;
        const openClass = mode === MapDisplayMode.Notes ? styles.alwaysOpen : "";
        const selectedClass = entry.id === selectedId ? styles.selected : "";
        const doneClass = entry.status === EntryStatus.Done ? styles.done : "";
        const openEntry = () => trigger(Binding.group, Binding.selectEntry, entry.id);
        return (
          <div
            key={entry.id}
            className={`${styles.anchor} ${priorityClass} ${openClass} ${doneClass} ${selectedClass}`}
            style={{ left: `${marker.screenX * 100}%`, top: `${marker.screenY * 100}%` }}
          >
            <Button
              variant="flat"
              className={`${styles.card} ${kindClass} ${priorityClass}`}
              onSelect={openEntry}
            >
              <span className={styles.cardHeader}>
                <span className={`${styles.cardKind} ${kindClass}`}>
                  <KindIcon kind={entry.kind} />
                </span>
                <strong>{entry.title}</strong>
              </span>
              <span className={styles.meta}>
                <span>{category}</span>
                <span>-</span>
                <span className={styles.statusMeta}>
                  <StatusIcon status={entry.status} />
                  {statusLabels[entry.status]}
                </span>
                {dueText && (
                  <>
                    <span>-</span>
                    <span className={overdue ? styles.overdue : styles.due}>{dueText}</span>
                  </>
                )}
              </span>
            </Button>
            <span className={styles.tail}></span>
            <Button
              variant="flat"
              className={`${styles.marker} ${kindClass} ${priorityClass}`}
              onSelect={openEntry}
            >
              <KindIcon kind={entry.kind} className={styles.markerIcon} />
              {overdue && <span className={styles.badge}>!</span>}
              {entry.status === EntryStatus.Done && <span className={styles.badge}>x</span>}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
