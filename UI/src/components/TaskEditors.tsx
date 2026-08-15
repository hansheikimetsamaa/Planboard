// Contains the create and edit forms that collect complete task metadata.

import { useEffect, useRef, useState } from "react";
import { trigger } from "cs2/api";
import { Button } from "cs2/ui";
import { usePlanboardLocale } from "../labels";
import { dateInputToTicks, isValidDateInput, ticksToDateInput } from "../model";
import {
  Binding,
  DateFormat,
  DeadlineMode,
  EntryCategory,
  EntryKind,
  EntryPriority,
  EntryStatus,
  EntryView,
  LinkState,
} from "../types/contracts";
import { CategoryPicker, KindPicker, PriorityPicker, StatusPicker } from "./EntryControls";
import { DeadlineCalendar } from "./DeadlineCalendar";
import { blurTextInputOnEscape, useEscapeDismissal } from "./useEscapeDismissal";
import styles from "./mainPanel.module.scss";

export type EditorPayload = (string | number)[];
type MetadataOverlay = "category" | "deadline" | null;
export type CreateEntry = (
  title: string,
  description: string,
  kind: EntryKind,
  category: EntryCategory,
  categoryName: string,
  status: EntryStatus,
  priority: EntryPriority,
  realDueTicks: string,
  gameDueTicks: string,
  place: boolean,
) => string | null;
export function NewEditor({
  deadlineMode,
  dateFormat,
  realToday,
  gameToday,
  onCancel,
  onCreate,
}: {
  deadlineMode: DeadlineMode;
  dateFormat: DateFormat;
  realToday: string;
  gameToday: string;
  onCancel: () => void;
  onCreate: (
    title: string,
    description: string,
    kind: EntryKind,
    category: EntryCategory,
    categoryName: string,
    status: EntryStatus,
    priority: EntryPriority,
    realDueTicks: string,
    gameDueTicks: string,
    place: boolean,
  ) => string | null;
}) {
  const {
    kindLabels: k,
    categoryLabels: c,
    statusLabels: s,
    priorityLabels: p,
  } = usePlanboardLocale();
  const [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [kind, setKind] = useState(EntryKind.Task),
    [category, setCategory] = useState(EntryCategory.General),
    [categoryName, setCategoryName] = useState(""),
    [status, setStatus] = useState(EntryStatus.Open),
    [priority, setPriority] = useState(EntryPriority.None),
    [real, setReal] = useState(""),
    [game, setGame] = useState(""),
    [error, setError] = useState<string | null>(null),
    [metadataOverlay, setMetadataOverlay] = useState<MetadataOverlay>(null),
    [confirmDiscard, setConfirmDiscard] = useState(false);
  const overlayHost = useRef<HTMLDivElement>(null);
  useEscapeDismissal(
    100,
    () => {
      setMetadataOverlay(null);
      return true;
    },
    metadataOverlay !== null,
  );

  // New list items are still drafts until Save succeeds. Match placed-pin behaviour so neither
  // Escape nor the back button silently loses the work a player has entered.
  const hasChanges =
    title.trim().length > 0 ||
    description.trim().length > 0 ||
    kind !== EntryKind.Task ||
    category !== EntryCategory.General ||
    categoryName.trim().length > 0 ||
    status !== EntryStatus.Open ||
    priority !== EntryPriority.None ||
    real.length > 0 ||
    game.length > 0;

  const requestDiscard = () => {
    if (hasChanges) {
      setConfirmDiscard(true);
      return;
    }
    onCancel();
  };

  useEscapeDismissal(80, () => {
    if (confirmDiscard) {
      onCancel();
      return true;
    }
    requestDiscard();
    return true;
  });

  const submit = (place: boolean) => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Give this item a title first.");
      return;
    }
    if ((real && !isValidDateInput(real)) || (game && !isValidDateInput(game))) {
      setError("Use a valid date in YYYY-MM-DD format.");
      return;
    }
    setError(
      onCreate(
        cleanTitle,
        description,
        kind,
        category,
        categoryName,
        status,
        priority,
        dateInputToTicks(real),
        dateInputToTicks(game),
        place,
      ),
    );
  };
  return (
    <div
      ref={overlayHost}
      className={styles.editorShell}
      onMouseDown={() => setMetadataOverlay(null)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.ctrlKey) {
          event.preventDefault();
          submit(true);
        }
      }}
    >
      <div className={styles.detailTopbar}>
        <Button variant="flat" onSelect={requestDiscard}>
          &lt; Planboard
        </Button>
        <span className={styles.newLabel}>New item</span>
      </div>
      <div className={styles.editor}>
        <input
          aria-label="Title"
          className={styles.titleInput}
          value={title}
          maxLength={160}
          placeholder="Title"
          onChange={(event) => {
            setTitle(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (blurTextInputOnEscape(event)) return;
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              submit(event.ctrlKey);
            }
          }}
        />
        {error && <div className={styles.createError}>{error}</div>}
        <div className={styles.locationCard}>
          <div className={styles.locationInfo}>
            <span className={styles.pinGlyph}>P</span>
            <span className={styles.locationText}>
              <strong>Not yet placed on the map</strong>
              <span>Create and immediately choose its location</span>
            </span>
          </div>
          <div className={styles.locationActions}>
            <Button
              variant="flat"
              title="Create and place on map (Ctrl+Enter)"
              onSelect={() => submit(true)}
            >
              Create &amp; place
            </Button>
          </div>
        </div>
        <div className={styles.grid}>
          <KindPicker value={kind} labels={k} onChange={setKind} />
          <div className={styles.categoryDeadline}>
            <CategoryPicker
              value={category}
              custom={categoryName}
              labels={c}
              open={metadataOverlay === "category"}
              onChange={setCategory}
              onCustom={setCategoryName}
              onOpenChange={(open) => setMetadataOverlay(open ? "category" : null)}
              overlayHost={overlayHost}
            />
            <DeadlineCalendar
              deadlineMode={deadlineMode}
              dateFormat={dateFormat}
              value={deadlineMode === "game" ? game : real}
              currentDate={deadlineMode === "game" ? gameToday : realToday}
              open={metadataOverlay === "deadline"}
              onChange={(value) => (deadlineMode === "game" ? setGame(value) : setReal(value))}
              onOpenChange={(open) => setMetadataOverlay(open ? "deadline" : null)}
              overlayHost={overlayHost}
            />
          </div>
          <StatusPicker value={status} labels={s} onChange={setStatus} />
          <PriorityPicker value={priority} labels={p} onChange={setPriority} />
        </div>
        <div className={`${styles.field} ${styles.placeholderField}`}>
          <textarea
            aria-label="Description"
            className={styles.descriptionInput}
            value={description}
            maxLength={4000}
            placeholder="Description (optional)"
            onChange={(event) => setDescription(event.target.value)}
            onKeyDown={blurTextInputOnEscape}
          />
        </div>
      </div>
      <div className={styles.createActions}>
        {confirmDiscard ? (
          <>
            <span className={styles.createDiscardMessage}>Discard this unsaved task?</span>
            <Button variant="flat" onSelect={() => setConfirmDiscard(false)}>
              Keep editing
            </Button>
            <Button variant="flat" className={styles.createDiscardButton} onSelect={onCancel}>
              Discard
            </Button>
          </>
        ) : (
          <>
            <Button variant="flat" onSelect={requestDiscard}>
              Discard
            </Button>
            <Button variant="primary" title="Save item (Enter)" onSelect={() => submit(false)}>
              Save
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
export function Editor({
  entry,
  deadlineMode,
  dateFormat,
  realToday,
  gameToday,
  onBack,
  onDelete,
}: {
  entry: EntryView;
  deadlineMode: DeadlineMode;
  dateFormat: DateFormat;
  realToday: string;
  gameToday: string;
  onBack: () => void;
  onDelete: (payload: EditorPayload) => void;
}) {
  const {
    kindLabels: k,
    categoryLabels: c,
    statusLabels: s,
    priorityLabels: p,
  } = usePlanboardLocale();
  const [title, setTitle] = useState(entry.title),
    [description, setDescription] = useState(entry.description),
    [kind, setKind] = useState(entry.kind),
    [category, setCategory] = useState(entry.category),
    [categoryName, setCategoryName] = useState(entry.categoryName),
    [status, setStatus] = useState(entry.status),
    [priority, setPriority] = useState(entry.priority),
    [real, setReal] = useState(ticksToDateInput(entry.realDueDateTicks)),
    [game, setGame] = useState(ticksToDateInput(entry.gameDueDateTicks)),
    [metadataOverlay, setMetadataOverlay] = useState<MetadataOverlay>(null);
  const overlayHost = useRef<HTMLDivElement>(null);
  useEscapeDismissal(
    100,
    () => {
      setMetadataOverlay(null);
      return true;
    },
    metadataOverlay !== null,
  );
  const initialPayload = useRef([
    entry.title,
    entry.description,
    entry.kind,
    entry.category,
    entry.categoryName,
    entry.status,
    entry.priority,
    entry.realDueDateTicks,
    entry.gameDueDateTicks,
  ]);
  const latestPayload = useRef(initialPayload.current);
  const savedPayload = useRef(JSON.stringify(initialPayload.current));
  const invalidDate = (real && !isValidDateInput(real)) || (game && !isValidDateInput(game));
  latestPayload.current = [
    title,
    description,
    kind,
    category,
    categoryName,
    status,
    priority,
    real && !isValidDateInput(real) ? entry.realDueDateTicks : dateInputToTicks(real),
    game && !isValidDateInput(game) ? entry.gameDueDateTicks : dateInputToTicks(game),
  ];
  const persist = (payload: (string | number)[]) => {
    if (!String(payload[0]).trim() || invalidDate) return;
    const signature = JSON.stringify(payload);
    if (signature === savedPayload.current) return;
    trigger(Binding.group, Binding.updateEntry, entry.id, ...payload);
    savedPayload.current = signature;
  };
  useEffect(() => {
    const timer = window.setTimeout(() => persist(latestPayload.current), 350);
    return () => window.clearTimeout(timer);
  }, [title, description, kind, category, categoryName, status, priority, real, game]);
  useEffect(() => () => persist(latestPayload.current), []);
  const locationContext = entry.hasDistrict
    ? "Pinned in a district"
    : entry.linkState === LinkState.Valid
      ? "Pinned to a city object"
      : "Pinned to map";
  const locations = entry.locations ?? [];
  const hasDistrictLocation = locations.some((location) => location.hasDistrict);
  return (
    <div
      ref={overlayHost}
      className={styles.editorShell}
      onMouseDown={() => setMetadataOverlay(null)}
    >
      <div className={styles.detailTopbar}>
        <Button variant="flat" onSelect={onBack}>
          &lt; Planboard
        </Button>
        <Button
          variant="flat"
          className={styles.deleteButton}
          onSelect={() => onDelete(latestPayload.current)}
        >
          Delete
        </Button>
      </div>
      <div className={styles.editor}>
        <input
          aria-label="Title"
          className={styles.titleInput}
          value={title}
          maxLength={160}
          placeholder="Title"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={blurTextInputOnEscape}
        />
        <div className={styles.locationCard}>
          <div className={styles.locationHeader}>
            <div className={styles.locationInfo}>
              <span className={styles.pinGlyph}>P</span>
              <span className={styles.locationText}>
                <strong>{entry.hasLocation ? locationContext : "Not yet placed on the map"}</strong>
                <span>
                  {entry.hasLocation
                    ? hasDistrictLocation
                      ? "Locked to the district centre"
                      : `${locations.length} ${locations.length === 1 ? "pin" : "pins"}`
                    : "Add a pin to give this entry spatial context"}
                </span>
              </span>
            </div>
            <div className={styles.locationActions}>
              {!entry.hasLocation && (
                <Button
                  variant="flat"
                  onSelect={() => trigger(Binding.group, Binding.beginPlacement, entry.id)}
                >
                  Place on map
                </Button>
              )}
              {entry.hasLocation && !hasDistrictLocation && (
                <Button
                  variant="flat"
                  onSelect={() => trigger(Binding.group, Binding.addLocation, entry.id)}
                >
                  + Add more pins
                </Button>
              )}
            </div>
          </div>
          {locations.length > 0 && !hasDistrictLocation && (
            <div
              className={`${styles.locationList} ${
                locations.length > 4 ? styles.locationListOverflow : ""
              }`}
            >
              {locations.map((location, index) => (
                <div key={location.id} className={styles.locationRow}>
                  <span>
                    Pin {index + 1} · {Math.round(location.x)}, {Math.round(location.z)}
                  </span>
                  <div>
                    <Button
                      variant="flat"
                      onSelect={() =>
                        trigger(Binding.group, Binding.navigateToLocation, entry.id, location.id)
                      }
                    >
                      View
                    </Button>
                    <Button
                      variant="flat"
                      onSelect={() =>
                        trigger(Binding.group, Binding.moveLocation, entry.id, location.id)
                      }
                    >
                      Move
                    </Button>
                    <Button
                      variant="flat"
                      className={styles.locationRemove}
                      onSelect={() =>
                        trigger(Binding.group, Binding.removeLocation, entry.id, location.id)
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={styles.grid}>
          <KindPicker value={kind} labels={k} onChange={setKind} />
          <div className={styles.categoryDeadline}>
            <CategoryPicker
              value={category}
              custom={categoryName}
              labels={c}
              open={metadataOverlay === "category"}
              onChange={setCategory}
              onCustom={setCategoryName}
              onOpenChange={(open) => setMetadataOverlay(open ? "category" : null)}
              overlayHost={overlayHost}
            />
            <DeadlineCalendar
              deadlineMode={deadlineMode}
              dateFormat={dateFormat}
              value={deadlineMode === "game" ? game : real}
              currentDate={deadlineMode === "game" ? gameToday : realToday}
              open={metadataOverlay === "deadline"}
              onChange={(value) => (deadlineMode === "game" ? setGame(value) : setReal(value))}
              onOpenChange={(open) => setMetadataOverlay(open ? "deadline" : null)}
              overlayHost={overlayHost}
            />
          </div>
          <StatusPicker value={status} labels={s} onChange={setStatus} />
          <PriorityPicker value={priority} labels={p} onChange={setPriority} />
        </div>
        <div className={`${styles.field} ${styles.placeholderField}`}>
          <textarea
            aria-label="Description"
            className={styles.descriptionInput}
            value={description}
            maxLength={4000}
            placeholder="Description (optional)"
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={blurTextInputOnEscape}
          />
        </div>
      </div>
      <div className={styles.autosave}>
        <span></span>Changes save automatically
      </div>
    </div>
  );
}
