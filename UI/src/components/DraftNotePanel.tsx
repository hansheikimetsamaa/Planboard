// Completes a newly placed marker before it becomes a saved task.

import { useEffect, useMemo, useRef, useState } from "react";
import { trigger, useValue } from "cs2/api";
import { Button, Panel } from "cs2/ui";
import { draftEntryId$, entries$, placementState$, windowLayoutRevision$ } from "../bindings";
import { usePlanboardLocale } from "../labels";
import {
  Binding,
  EntryCategory,
  EntryKind,
  EntryPriority,
  EntryStatus,
  EntryView,
  PlacementState,
} from "../types/contracts";
import { KindIcon } from "./KindIcon";
import { CategoryMenu, PriorityPicker } from "./EntryControls";
import { categoryChoiceKey, compactDraftCategoryChoices } from "../model";
import { ScrollableSurface } from "./ScrollableSurface";
import { usePanelGeometry } from "./usePanelGeometry";
import {
  blurTextInputOnEscape,
  EscapeDismissalScope,
  useEscapeDismissal,
} from "./useEscapeDismissal";
import styles from "./draftNote.module.scss";

export function DraftNotePanel() {
  const draftId = useValue(draftEntryId$) ?? 0;
  const entries = useValue(entries$) ?? [];
  const placementState = useValue(placementState$) ?? PlacementState.Inactive;
  const entry = entries.find((candidate) => candidate.id === draftId);
  if (!entry || placementState !== PlacementState.Applied) return null;
  return (
    <EscapeDismissalScope>
      <DraftEditor key={entry.id} entry={entry} entries={entries} />
    </EscapeDismissalScope>
  );
}

function DraftEditor({ entry, entries }: { entry: EntryView; entries: EntryView[] }) {
  const { kindLabels, categoryLabels, priorityLabels } = usePlanboardLocale();
  const geometry = usePanelGeometry("sticky", 400, 520, 0.6, 0.82);
  const layoutRevision = useValue(windowLayoutRevision$) ?? 0;
  const layoutMounted = useRef(false);
  useEffect(() => {
    if (layoutMounted.current) geometry.reset();
    else layoutMounted.current = true;
  }, [layoutRevision]);
  const titleRef = useRef<HTMLInputElement>(null);
  const customCategoryRef = useRef<HTMLInputElement>(null);
  const overlayHost = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState("");
  const [titleMissing, setTitleMissing] = useState(false);
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState(entry.kind);
  const [category, setCategory] = useState(EntryCategory.General);
  const [customCategory, setCustomCategory] = useState("");
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [customCategoryOpen, setCustomCategoryOpen] = useState(false);
  const [priority, setPriority] = useState(EntryPriority.None);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    setTitle("");
    setTitleMissing(false);
    setDescription("");
    setKind(entry.kind);
    setCategory(EntryCategory.General);
    setCustomCategory("");
    setCategoryTouched(false);
    setCategoryMenuOpen(false);
    setCustomCategoryOpen(false);
    setPriority(EntryPriority.None);
    setConfirmDiscard(false);
  }, [entry.id]);

  const hasChanges =
    title.trim().length > 0 ||
    description.trim().length > 0 ||
    kind !== entry.kind ||
    category !== EntryCategory.General ||
    customCategory.trim().length > 0 ||
    priority !== EntryPriority.None;

  const restoreTitleFocus = () => {
    window.setTimeout(() => titleRef.current?.focus(), 0);
  };

  // The draft panel mounts only after placement succeeds, so defer focus until Gameface has
  // attached the title field. The same helper restores focus after declining a discard.
  useEffect(() => {
    if (!confirmDiscard) restoreTitleFocus();
  }, [entry.id, confirmDiscard]);

  useEffect(() => {
    if (customCategoryOpen) {
      window.setTimeout(() => customCategoryRef.current?.focus(), 0);
    }
  }, [customCategoryOpen]);

  const save = () => {
    const finalTitle = title.trim();
    if (!finalTitle) {
      setTitleMissing(true);
      titleRef.current?.focus();
      return;
    }
    trigger(
      Binding.group,
      Binding.commitDraft,
      entry.id,
      finalTitle,
      description,
      kind,
      category,
      customCategory,
      EntryStatus.Open,
      priority,
      "0",
      "0",
    );
  };
  const discard = () => trigger(Binding.group, Binding.discardDraft, entry.id);
  const requestDiscard = () => {
    if (hasChanges) {
      setConfirmDiscard(true);
      return;
    }
    discard();
  };
  const cancelDiscard = () => {
    setConfirmDiscard(false);
    restoreTitleFocus();
  };

  useEscapeDismissal(80, () => {
    if (categoryMenuOpen) {
      setCategoryMenuOpen(false);
      return true;
    }
    if (customCategoryOpen) {
      setCustomCategoryOpen(false);
      return true;
    }
    if (confirmDiscard) {
      discard();
      return true;
    }
    requestDiscard();
    return true;
  });

  const selectCategory = (value: EntryCategory, custom = "") => {
    setCategory(value);
    setCustomCategory(custom);
    setCategoryTouched(true);
  };
  const selectDetailedCategory = (value: EntryCategory) => {
    setCategory(value);
    setCategoryTouched(true);
  };
  const setDetailedCustomCategory = (value: string) => {
    setCustomCategory(value);
    setCategoryTouched(true);
  };
  const activeCategoryKey = categoryChoiceKey(category, customCategory);
  const quickCategories = useMemo(
    () =>
      compactDraftCategoryChoices(
        entries,
        entry.id,
        categoryTouched ? { category, custom: customCategory } : undefined,
        3,
      ).map((option) => ({
        ...option,
        key: categoryChoiceKey(option.category, option.custom),
        label: option.custom.trim() || categoryLabels[option.category] || "General",
      })),
    [category, categoryLabels, categoryTouched, customCategory, entries, entry.id],
  );

  return (
    <Panel
      key={geometry.panelKey}
      draggable
      initialPosition={geometry.initialPosition}
      style={geometry.panelStyle}
      onMouseUp={geometry.onPanelMouseUp}
      className={styles.shell}
      contentClassName={styles.content}
      header={
        <div className={styles.header}>
          <strong>Pin placed</strong>
          <Button
            aria-label="Close draft"
            className={styles.closeButton}
            variant="flat"
            onSelect={requestDiscard}
          >
            ×
          </Button>
        </div>
      }
      showCloseHint={false}
    >
      <div ref={overlayHost} className={styles.overlayHost}>
        <ScrollableSurface
          frameClassName={styles.stickyScrollFrame}
          viewportClassName={styles.sticky}
          ariaLabel="Pin placed form scrollbar"
        >
          <div className={styles.kinds}>
            {kindLabels.map((label, value) => (
              <Button
                key={label}
                variant="flat"
                selected={kind === value}
                className={kind === value ? styles.kindActive : ""}
                onSelect={() => setKind(value as EntryKind)}
              >
                <b
                  className={
                    value === EntryKind.Issue
                      ? styles.issue
                      : value === EntryKind.Idea
                        ? styles.idea
                        : styles.note
                  }
                >
                  <KindIcon kind={value as EntryKind} onLight />
                </b>
                {label}
              </Button>
            ))}
          </div>
          <input
            ref={titleRef}
            type="text"
            aria-label="Title"
            value={title}
            maxLength={160}
            className={titleMissing ? styles.missing : ""}
            placeholder="Title"
            onChange={(event) => {
              setTitle(event.target.value);
              if (event.target.value.trim()) setTitleMissing(false);
            }}
            onKeyDown={(event) => {
              if (blurTextInputOnEscape(event)) return;
              if (event.key === "Enter") save();
            }}
          />
          <div className={styles.categoryLabel}>Category</div>
          <div className={styles.categoryChips}>
            {quickCategories.map((option) => {
              const selected = categoryTouched && option.key === activeCategoryKey;
              return (
                <Button
                  key={option.key}
                  variant="flat"
                  selected={selected}
                  title={option.label}
                  className={`${styles.categoryChip} ${selected ? styles.chipActive : ""}`}
                  onSelect={() => {
                    setCustomCategoryOpen(false);
                    selectCategory(option.category, option.custom);
                  }}
                >
                  {option.label}
                </Button>
              );
            })}
            <Button
              variant="flat"
              className={`${styles.categoryChip} ${styles.categoryAction}`}
              aria-label="Create custom category"
              title="Create custom category"
              onSelect={() => {
                setCategoryMenuOpen(false);
                setCategory(EntryCategory.General);
                setCustomCategory("");
                setCategoryTouched(true);
                setCustomCategoryOpen(true);
              }}
            >
              +
            </Button>
            <Button
              variant="flat"
              selected={categoryMenuOpen}
              className={`${styles.categoryChip} ${styles.categoryAction}`}
              aria-label="Show all categories"
              title="Show all categories"
              onSelect={() => {
                setCustomCategoryOpen(false);
                setCategoryMenuOpen(true);
              }}
            >
              {"\u22ef"}
            </Button>
          </div>
          {customCategoryOpen && (
            <input
              ref={customCategoryRef}
              type="text"
              aria-label="Custom category"
              value={customCategory}
              maxLength={40}
              className={styles.customCategoryField}
              placeholder="Custom category"
              onChange={(event) => setDetailedCustomCategory(event.target.value)}
              onKeyDown={blurTextInputOnEscape}
            />
          )}
          <PriorityPicker value={priority} labels={priorityLabels} onChange={setPriority} />
          <div className={styles.details}>
            <textarea
              aria-label="Description"
              value={description}
              maxLength={4000}
              rows={4}
              placeholder="Description (optional)"
              onChange={(event) => setDescription(event.target.value)}
              onKeyDown={blurTextInputOnEscape}
            />
          </div>
          <CategoryMenu
            value={category}
            custom={customCategory}
            labels={categoryLabels}
            open={categoryMenuOpen}
            onChange={selectDetailedCategory}
            onCustom={setDetailedCustomCategory}
            onOpenChange={setCategoryMenuOpen}
            overlayHost={overlayHost}
            includeCustomInput={false}
          />
        </ScrollableSurface>
        <div className={styles.actions}>
          {confirmDiscard ? (
            <div className={styles.discardConfirmation}>
              <span>Discard this unsaved pin?</span>
              <Button variant="flat" onSelect={cancelDiscard}>
                Keep editing
              </Button>
              <Button variant="flat" className={styles.discardConfirmButton} onSelect={discard}>
                Discard
              </Button>
            </div>
          ) : (
            <>
              <Button variant="flat" onSelect={requestDiscard}>
                Discard
              </Button>
              <Button variant="primary" onSelect={save}>
                Save
              </Button>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}
