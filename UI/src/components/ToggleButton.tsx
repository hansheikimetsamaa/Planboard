import { useEffect, useState } from "react";
import { trigger, useValue } from "cs2/api";
import { Button, Tooltip } from "cs2/ui";
import notepadIcon from "../images/kind-note.svg";
import pinIcon from "../images/add-pin.svg";
import { draftEntryId$, mapDisplayMode$, panelVisible$, placementState$ } from "../bindings";
import { Binding, EntryKind, MapDisplayMode, PlacementState } from "../types/contracts";
import { usePlanboardLocale } from "../labels";
import { KindIcon } from "./KindIcon";
import styles from "./mapToolbar.module.scss";
function VisibilityIcon({ mode }: { mode: MapDisplayMode }) {
  const stateClass = mode === MapDisplayMode.Hidden
    ? styles.eyeHidden
    : mode === MapDisplayMode.Pins
      ? styles.eyePins
      : styles.eyeNotes;

  return <svg className={`${styles.eyeIcon} ${stateClass}`} viewBox="0 0 32 32" aria-hidden="true">
    <path className={styles.eyeOuter} d="M3.5 16s4.7-8 12.5-8 12.5 8 12.5 8-4.7 8-12.5 8S3.5 16 3.5 16Z" />
    <circle className={styles.eyeIris} cx="16" cy="16" r="5" />
    <circle className={styles.eyePupil} cx="16" cy="16" r="2" />
  </svg>;
}

export function MapToolbar() {
  const visible = useValue(panelVisible$) ?? false;
  const mapDisplayMode = useValue(mapDisplayMode$) ?? MapDisplayMode.Pins;
  const placementState = useValue(placementState$) ?? PlacementState.Inactive;
  const draftId = useValue(draftEntryId$) ?? 0;
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [placingKind, setPlacingKind] = useState<EntryKind | null>(null);
  const { t, kindLabels } = usePlanboardLocale();
  const placing = placementState >= PlacementState.ChoosingLocation && placementState <= PlacementState.InvalidPreview;

  useEffect(() => {
    if (placing || draftId > 0) setPaletteOpen(false);
    if (placementState === PlacementState.Applied || placementState === PlacementState.Cancelled)
      setPlacingKind(null);
  }, [draftId, placing, placementState]);

  const begin = (kind: EntryKind) => {
    setPlacingKind(kind);
    setPaletteOpen(false);
    trigger(Binding.group, Binding.createPinnedDraft, kind);
  };

  const visibilityLabel = mapDisplayMode === MapDisplayMode.Hidden
    ? "Map notes hidden"
    : mapDisplayMode === MapDisplayMode.Pins
      ? "Map notes shown as pins"
      : "All sticky notes open";

  return <div className={styles.footerGroup}>
    <div className={styles.pinControl}>
      <Tooltip tooltip={placing ? "Cancel pin placement" : "Add a map pin"}>
        <Button src={pinIcon} variant="flat" selected={placing || paletteOpen} className={`${styles.footerButton} ${placing || paletteOpen ? styles.footerButtonActive : styles.footerButtonNeutral}`} onSelect={() => {
          if (placing) trigger(Binding.group, Binding.cancelPlacement);
          else if (draftId === 0) setPaletteOpen(!paletteOpen);
        }} />
      </Tooltip>
      {paletteOpen && <div className={styles.kindPalette}>
        <span>Place on map</span>
        <Button variant="flat" className={styles.issue} onSelect={() => begin(EntryKind.Issue)}><b><KindIcon kind={EntryKind.Issue} /></b>{kindLabels[EntryKind.Issue]}</Button>
        <Button variant="flat" className={styles.note} onSelect={() => begin(EntryKind.Task)}><b><KindIcon kind={EntryKind.Task} /></b>{kindLabels[EntryKind.Task]}</Button>
        <Button variant="flat" className={styles.idea} onSelect={() => begin(EntryKind.Idea)}><b><KindIcon kind={EntryKind.Idea} /></b>{kindLabels[EntryKind.Idea]}</Button>
      </div>}
      {placing && <div className={styles.placementToast}><strong>Place {placingKind === EntryKind.Issue ? "issue" : placingKind === EntryKind.Idea ? "idea" : "note"}</strong><span>Click a location on the map - right-click to cancel</span></div>}
    </div>
    <span className={styles.separator} />
    <div className={styles.displayControl}>
      <Tooltip tooltip={`${visibilityLabel} - click to change`}>
        <Button variant="flat" selected={mapDisplayMode !== MapDisplayMode.Hidden} className={`${styles.footerButton} ${styles.visibilityButton} ${mapDisplayMode !== MapDisplayMode.Hidden ? styles.footerButtonActive : styles.footerButtonNeutral}`} onSelect={() => trigger(Binding.group, Binding.cycleMapDisplayMode)}><VisibilityIcon mode={mapDisplayMode} /></Button>
      </Tooltip>
      <span>{mapDisplayMode === MapDisplayMode.Hidden ? "OFF" : mapDisplayMode === MapDisplayMode.Pins ? "PIN" : "ALL"}</span>
    </div>
    <span className={styles.separator} />
    <Tooltip tooltip={t("ToggleTooltip", "Open Planboard") }>
      <Button src={notepadIcon} variant="flat" selected={visible} className={`${styles.footerButton} ${visible ? styles.footerButtonActive : styles.footerButtonNeutral}`} onSelect={() => trigger(Binding.group, Binding.setPanelVisible, !visible)} />
    </Tooltip>
  </div>;
}