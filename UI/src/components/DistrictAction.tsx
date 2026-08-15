// Adds a guarded Planboard section to the native district inspector.

import React, { useRef, useState } from "react";
import { trigger, useValue } from "cs2/api";
import { Button } from "cs2/ui";
import { districtEntries$, districtSelected$, districtSelectionRevision$ } from "../bindings";
import { usePlanboardLocale } from "../labels";
import { Binding, EntryKind, EntryStatus, EntryView } from "../types/contracts";
import { KindIcon } from "./KindIcon";
import { StatusIcon } from "./StatusIcon";
import { ListPopover, ListPopoverKind } from "./TaskList";
import styles from "./districtAction.module.scss";
import listStyles from "./mainPanel.module.scss";

class DistrictActionBoundary extends React.Component<
  React.PropsWithChildren,
  { crashed: boolean }
> {
  state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  render() {
    return this.state.crashed ? null : this.props.children;
  }
}

function kindClass(kind: EntryKind) {
  return kind === EntryKind.Issue
    ? styles.issue
    : kind === EntryKind.Idea
      ? styles.idea
      : styles.note;
}

function DistrictEntryRow({
  entry,
  category,
  kindLabel,
  statusLabels,
  activePopover,
  onPopoverChange,
  overlayHost,
}: {
  entry: EntryView;
  category: string;
  kindLabel: string;
  statusLabels: string[];
  activePopover: ListPopoverKind | null;
  onPopoverChange: (next: ListPopoverKind | null) => void;
  overlayHost: React.RefObject<HTMLElement>;
}) {
  const statusTrigger = useRef<HTMLDivElement>(null);
  const menuTrigger = useRef<HTMLDivElement>(null);

  return (
    <div className={styles.entry}>
      <Button
        variant="flat"
        className={styles.entryOpen}
        onSelect={() => trigger(Binding.group, Binding.selectEntry, entry.id)}
      >
        <span className={`${styles.kindBadge} ${kindClass(entry.kind)}`}>
          <KindIcon kind={entry.kind} onLight />
        </span>
        <span className={styles.entryText}>
          <strong>{entry.title}</strong>
          <span>
            {kindLabel} - {category}
          </span>
        </span>
      </Button>

      <div ref={statusTrigger} className={styles.statusControl}>
        <Button
          variant="flat"
          className={`${styles.statusButton} ${activePopover === "status" ? styles.statusButtonOpen : ""}`}
          aria-label={`Change status for ${entry.title}`}
          aria-expanded={activePopover === "status"}
          onSelect={() => onPopoverChange(activePopover === "status" ? null : "status")}
        >
          <StatusIcon status={entry.status} />
          <span>{statusLabels[entry.status]}</span>
          <span className={styles.statusIndicator} aria-hidden="true" />
        </Button>
        {activePopover === "status" && (
          <ListPopover
            anchor={statusTrigger}
            overlayHost={overlayHost}
            className={listStyles.rowStatusMenu}
            height={90}
            minimumWidth={78}
            onClose={() => onPopoverChange(null)}
          >
            {statusLabels.map((label, status) => (
              <Button
                key={label}
                variant="flat"
                selected={status === entry.status}
                className={status === entry.status ? listStyles.rowStatusSelected : ""}
                onSelect={() => {
                  trigger(Binding.group, Binding.setStatus, entry.id, status);
                  onPopoverChange(null);
                }}
              >
                <StatusIcon status={status as EntryStatus} />
                {label}
              </Button>
            ))}
          </ListPopover>
        )}
      </div>

      <div ref={menuTrigger} className={styles.menuControl}>
        <Button
          variant="flat"
          className={styles.menuButton}
          aria-label={`More actions for ${entry.title}`}
          aria-expanded={activePopover === "actions"}
          onSelect={() => onPopoverChange(activePopover === "actions" ? null : "actions")}
        >
          {"\u22ef"}
        </Button>
      </div>
      {activePopover === "actions" && (
        <ListPopover
          anchor={menuTrigger}
          overlayHost={overlayHost}
          className={listStyles.rowMenu}
          height={66}
          minimumWidth={94}
          onClose={() => onPopoverChange(null)}
        >
          <Button
            variant="flat"
            onSelect={() => {
              onPopoverChange(null);
              trigger(Binding.group, Binding.navigateToEntry, entry.id);
            }}
          >
            View pin
          </Button>
          <Button
            variant="flat"
            onSelect={() => {
              onPopoverChange(null);
              trigger(Binding.group, Binding.deleteEntry, entry.id);
            }}
          >
            Delete
          </Button>
        </ListPopover>
      )}
    </div>
  );
}

function DistrictActionInner({ InfoSection }: { InfoSection: React.ComponentType<any> }) {
  const selected = useValue(districtSelected$);
  const entries = useValue(districtEntries$) ?? [];
  const districtRevision = useValue(districtSelectionRevision$);
  const { categoryLabels, kindLabels, statusLabels, t } = usePlanboardLocale();
  const overlayHost = useRef<HTMLElement>(null);
  const [activePopover, setActivePopover] = useState<{
    entryId: number;
    kind: ListPopoverKind;
  } | null>(null);

  if (!selected || !InfoSection) return null;

  return (
    <InfoSection disableFoldout>
      <section
        ref={overlayHost}
        className={styles.section}
        data-district-revision={districtRevision}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setActivePopover(null);
        }}
      >
        <header className={styles.header}>
          <div>
            <strong>{t("DistrictPlanboard", "Planboard")}</strong>
            <span>
              {entries.length}{" "}
              {t(
                entries.length === 1 ? "DistrictItem" : "DistrictItems",
                entries.length === 1 ? "item" : "items",
              )}
            </span>
          </div>
          <Button
            variant="flat"
            className={styles.addButton}
            onSelect={() => trigger(Binding.group, Binding.createDistrictEntry)}
          >
            + {t("AddDistrict", "Add note")}
          </Button>
        </header>

        {entries.length === 0 ? (
          <p className={styles.empty}>
            {t("DistrictEmpty", "No Planboard items in this district yet.")}
          </p>
        ) : (
          <div className={styles.entries}>
            {entries.map((entry) => {
              const category = entry.categoryName || categoryLabels[entry.category] || "General";
              const rowPopover = activePopover?.entryId === entry.id ? activePopover.kind : null;
              return (
                <DistrictEntryRow
                  key={entry.id}
                  entry={entry}
                  category={category}
                  kindLabel={kindLabels[entry.kind]}
                  statusLabels={statusLabels}
                  activePopover={rowPopover}
                  onPopoverChange={(kind) =>
                    setActivePopover(kind ? { entryId: entry.id, kind } : null)
                  }
                  overlayHost={overlayHost}
                />
              );
            })}
          </div>
        )}
      </section>
    </InfoSection>
  );
}

export const makeDistrictAction = (InfoSection: React.ComponentType<any>) => () => (
  <DistrictActionBoundary>
    <DistrictActionInner InfoSection={InfoSection} />
  </DistrictActionBoundary>
);
