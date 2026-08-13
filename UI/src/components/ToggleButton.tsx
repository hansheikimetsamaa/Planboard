// Renders the map-toolbar controls for opening Planboard and map display modes.

import { useEffect, useRef, useState } from "react";
import { trigger, useValue } from "cs2/api";
import { Button, Tooltip } from "cs2/ui";
import notepadIcon from "../images/kind-note.svg";
import pinIcon from "../images/add-pin.svg";
import {
  draftEntryId$,
  mapDisplayMode$,
  panelVisible$,
  placementState$,
  toolbarLocation$,
} from "../bindings";
import {
  Binding,
  EntryKind,
  MapDisplayMode,
  PlacementState,
  ToolbarLocation,
} from "../types/contracts";
import { usePlanboardLocale } from "../labels";
import { KindIcon } from "./KindIcon";
import styles from "./mapToolbar.module.scss";

// The map-display control is intentionally inline: its three visual states are local to this toolbar.
function VisibilityIcon({ mode }: { mode: MapDisplayMode }) {
  const stateClass =
    mode === MapDisplayMode.Hidden
      ? styles.eyeHidden
      : mode === MapDisplayMode.Pins
        ? styles.eyePins
        : styles.eyeNotes;

  return (
    <svg className={`${styles.eyeIcon} ${stateClass}`} viewBox="0 0 32 32" aria-hidden="true">
      <path
        className={styles.eyeOuter}
        d="M3.5 16s4.7-8 12.5-8 12.5 8 12.5 8-4.7 8-12.5 8S3.5 16 3.5 16Z"
      />
      <circle className={styles.eyeIris} cx="16" cy="16" r="5" />
      <circle className={styles.eyePupil} cx="16" cy="16" r="2" />
    </svg>
  );
}

export function TopLeftToolbar() {
  return <MapToolbar location="topLeft" />;
}

// Both CS2 toolbar hooks render this component. The setting below decides which hook is visible.
export function MapToolbar({ location = "footer" }: { location?: ToolbarLocation }) {
  const visible = useValue(panelVisible$) ?? false;
  const mapDisplayMode = useValue(mapDisplayMode$) ?? MapDisplayMode.Pins;
  const placementState = useValue(placementState$) ?? PlacementState.Inactive;
  const draftId = useValue(draftEntryId$) ?? 0;
  const toolbarLocation = useValue(toolbarLocation$) ?? "topLeft";
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [placingKind, setPlacingKind] = useState<EntryKind | null>(null);
  const pinControl = useRef<HTMLDivElement>(null);
  const { t, kindLabels } = usePlanboardLocale();
  const placing =
    placementState >= PlacementState.ChoosingLocation &&
    placementState <= PlacementState.InvalidPreview;

  // Placement owns the pin workflow, so the palette cannot remain open behind it.
  useEffect(() => {
    if (placing || draftId > 0) setPaletteOpen(false);
    if (placementState === PlacementState.Applied || placementState === PlacementState.Cancelled)
      setPlacingKind(null);
  }, [draftId, placing, placementState]);

  // Gameface does not provide browser-native popover dismissal for this control.
  useEffect(() => {
    if (!paletteOpen) return;
    const dismiss = (event: MouseEvent) => {
      if (!pinControl.current?.contains(event.target as Node)) setPaletteOpen(false);
    };
    window.addEventListener("mousedown", dismiss);
    return () => window.removeEventListener("mousedown", dismiss);
  }, [paletteOpen]);

  // Draft creation stays on the C# side so it can remain transient until placement succeeds.
  const begin = (kind: EntryKind) => {
    setPlacingKind(kind);
    setPaletteOpen(false);
    trigger(Binding.group, Binding.createPinnedDraft, kind);
  };

  const visibilityLabel =
    mapDisplayMode === MapDisplayMode.Hidden
      ? "Map notes hidden"
      : mapDisplayMode === MapDisplayMode.Pins
        ? "Map notes shown as pins"
        : "All sticky notes open";
  const buttonVariant = location === "topLeft" ? "floating" : "flat";

  // Both supported game hooks stay registered so changing settings is immediate.
  // Only the selected hook renders the shared controls, preventing duplicate actions.
  if (toolbarLocation !== location) return null;

  return (
    <div className={location === "topLeft" ? styles.topLeftGroup : styles.footerGroup}>
      <div ref={pinControl} className={styles.pinControl}>
        <Tooltip tooltip={placing ? "Cancel pin placement" : "Add a map pin"}>
          <Button
            src={pinIcon}
            variant={buttonVariant}
            selected={placing || paletteOpen}
            className={`${styles.footerButton} ${placing || paletteOpen ? styles.footerButtonActive : styles.footerButtonNeutral}`}
            onSelect={() => {
              if (placing) trigger(Binding.group, Binding.cancelPlacement);
              else if (draftId === 0) setPaletteOpen(!paletteOpen);
            }}
          />
        </Tooltip>
        {paletteOpen && (
          <div className={styles.kindPalette}>
            <span>Place on map</span>
            <Button variant="flat" className={styles.issue} onSelect={() => begin(EntryKind.Issue)}>
              <b>
                <KindIcon kind={EntryKind.Issue} onLight />
              </b>
              {kindLabels[EntryKind.Issue]}
            </Button>
            <Button variant="flat" className={styles.note} onSelect={() => begin(EntryKind.Task)}>
              <b>
                <KindIcon kind={EntryKind.Task} onLight />
              </b>
              {kindLabels[EntryKind.Task]}
            </Button>
            <Button variant="flat" className={styles.idea} onSelect={() => begin(EntryKind.Idea)}>
              <b>
                <KindIcon kind={EntryKind.Idea} onLight />
              </b>
              {kindLabels[EntryKind.Idea]}
            </Button>
          </div>
        )}
        {placing && (
          <div className={styles.placementToast}>
            <strong>
              Place{" "}
              {placingKind === EntryKind.Issue
                ? "issue"
                : placingKind === EntryKind.Idea
                  ? "idea"
                  : "note"}
            </strong>
            <span>Click a location on the map - right-click to cancel</span>
          </div>
        )}
      </div>
      <span className={styles.separator} />
      <div className={styles.displayControl}>
        <Tooltip tooltip={`${visibilityLabel} - click to change`}>
          <Button
            variant={buttonVariant}
            selected={mapDisplayMode !== MapDisplayMode.Hidden}
            className={`${styles.footerButton} ${styles.visibilityButton} ${mapDisplayMode !== MapDisplayMode.Hidden ? styles.footerButtonActive : styles.footerButtonNeutral}`}
            onSelect={() => trigger(Binding.group, Binding.cycleMapDisplayMode)}
          >
            <VisibilityIcon mode={mapDisplayMode} />
          </Button>
        </Tooltip>
        <span>
          {mapDisplayMode === MapDisplayMode.Hidden
            ? "OFF"
            : mapDisplayMode === MapDisplayMode.Pins
              ? "PIN"
              : "ALL"}
        </span>
      </div>
      <span className={styles.separator} />
      <Tooltip tooltip={t("ToggleTooltip", "Open Planboard")}>
        <Button
          src={notepadIcon}
          variant={buttonVariant}
          selected={visible}
          className={`${styles.footerButton} ${visible ? styles.footerButtonActive : styles.footerButtonNeutral}`}
          onSelect={() => trigger(Binding.group, Binding.setPanelVisible, !visible)}
        />
      </Tooltip>
    </div>
  );
}
