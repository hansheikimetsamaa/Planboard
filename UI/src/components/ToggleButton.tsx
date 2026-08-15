// Renders the map-toolbar controls for opening Planboard and map display modes.

import { trigger, useValue } from "cs2/api";
import { Button, Tooltip } from "cs2/ui";
import notepadIcon from "../images/kind-note.svg";
import pinIcon from "../images/add-pin.svg";
import {
  continuousPlacement$,
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
  const continuousPlacement = useValue(continuousPlacement$) ?? false;
  const draftId = useValue(draftEntryId$) ?? 0;
  const toolbarLocation = useValue(toolbarLocation$) ?? "topLeft";
  const { t } = usePlanboardLocale();
  const placing =
    placementState >= PlacementState.ChoosingLocation &&
    placementState <= PlacementState.InvalidPreview;

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
      <div className={styles.pinControl}>
        <Tooltip
          tooltip={
            placing
              ? continuousPlacement
                ? "Done adding pins"
                : "Cancel pin placement"
              : "Add a map pin"
          }
        >
          <Button
            src={pinIcon}
            variant={buttonVariant}
            selected={placing}
            className={`${styles.footerButton} ${placing ? styles.footerButtonActive : styles.footerButtonNeutral}`}
            onSelect={() => {
              if (placing) trigger(Binding.group, Binding.cancelPlacement);
              // This draft remains transient until Save. The temporary Note kind keeps the
              // first click focused on location while the later editor keeps type editable.
              else if (draftId === 0)
                trigger(Binding.group, Binding.createPinnedDraft, EntryKind.Task);
            }}
          />
        </Tooltip>
        {placing && (
          <div className={styles.placementToast}>
            <div className={styles.placementCopy}>
              <strong>{continuousPlacement ? "Add more pins" : "Place map pin"}</strong>
              <span>
                {continuousPlacement
                  ? "Click each location, then choose Done"
                  : "Click a location on the map - right-click to cancel"}
              </span>
            </div>
            {continuousPlacement && (
              <Button
                variant="flat"
                className={styles.placementDone}
                onSelect={() => trigger(Binding.group, Binding.cancelPlacement)}
              >
                Done
              </Button>
            )}
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
