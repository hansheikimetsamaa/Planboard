import { useEffect, useRef, useState } from "react";
import { trigger, useValue } from "cs2/api";
import { Button, Panel } from "cs2/ui";
import { draftEntryId$, entries$, placementState$, windowLayoutRevision$ } from "../bindings";
import { usePlanboardLocale } from "../labels";
import { Binding, EntryCategory, EntryKind, EntryPriority, EntryStatus, EntryView, PlacementState } from "../types/contracts";
import { KindIcon } from "./KindIcon";
import { usePanelGeometry } from "./usePanelGeometry";
import styles from "./draftNote.module.scss";

export function DraftNotePanel() {
  const draftId = useValue(draftEntryId$) ?? 0;
  const entries = useValue(entries$) ?? [];
  const placementState = useValue(placementState$) ?? PlacementState.Inactive;
  const entry = entries.find(candidate => candidate.id === draftId);
  if (!entry || placementState !== PlacementState.Applied) return null;
  return <DraftEditor key={entry.id} entry={entry} />;
}

function DraftEditor({ entry }: { entry: EntryView }) {
  const { kindLabels, categoryLabels, priorityLabels } = usePlanboardLocale();
  const geometry = usePanelGeometry("sticky", 360, 280, .6, .75);
  const layoutRevision = useValue(windowLayoutRevision$) ?? 0;
  const layoutMounted = useRef(false);
  useEffect(() => { if (layoutMounted.current) geometry.reset(); else layoutMounted.current = true; }, [layoutRevision]);
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [titleMissing, setTitleMissing] = useState(false);
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState(entry.kind);
  const [category, setCategory] = useState(EntryCategory.General);
  const [customCategory, setCustomCategory] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [priority, setPriority] = useState(EntryPriority.None);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    setTitle("");
    setTitleMissing(false);
    setDescription("");
    setKind(entry.kind);
    setCategory(EntryCategory.General);
    setCustomCategory("");
    setShowCustom(false);
    setPriority(EntryPriority.None);
    setShowDetails(false);
  }, [entry.id]);

  const save = () => {
    const finalTitle = title.trim();
    if (!finalTitle) {
      setTitleMissing(true);
      titleRef.current?.focus();
      return;
    }
    trigger(Binding.group, Binding.commitDraft, entry.id, finalTitle, description, kind, category, customCategory, EntryStatus.Open, priority, "0", "0");
  };
  const discard = () => trigger(Binding.group, Binding.discardDraft, entry.id);
  const selectCategory = (value: EntryCategory) => {
    setCategory(value);
    setCustomCategory("");
    setShowCustom(false);
  };
  const quickCategories = [
    { label: categoryLabels[EntryCategory.General], value: EntryCategory.General },
    { label: categoryLabels[EntryCategory.Traffic], value: EntryCategory.Traffic },
    { label: categoryLabels[EntryCategory.Roads], value: EntryCategory.Roads },
    { label: "Transit", value: EntryCategory.PublicTransport },
  ];

  return <Panel key={geometry.panelKey} draggable initialPosition={geometry.initialPosition}
style={geometry.panelStyle} onMouseUp={geometry.onPanelMouseUp} className={styles.shell} contentClassName={styles.content} header={<div className={styles.header}><strong>Pin placed</strong><span>Complete the note</span></div>} showCloseHint onClose={discard}>
    <div className={styles.sticky}>
      <div className={styles.kinds}>{kindLabels.map((label, value) => <Button key={label} variant="flat" selected={kind === value} className={kind === value ? styles.kindActive : ""} onSelect={() => setKind(value as EntryKind)}><b className={value === EntryKind.Issue ? styles.issue : value === EntryKind.Idea ? styles.idea : styles.note}><KindIcon kind={value as EntryKind} /></b>{label}</Button>)}</div>
      <input ref={titleRef} type="text" value={title} maxLength={160} autoFocus className={titleMissing ? styles.missing : ""} placeholder="What’s happening here?" onChange={event => { setTitle(event.target.value); if (event.target.value.trim()) setTitleMissing(false); }} onKeyDown={event => event.key === "Enter" && save()} />
      <div className={styles.categoryLabel}>Category</div>
      <div className={styles.categoryChips}>{quickCategories.map(option => <Button key={option.label} variant="flat" selected={!showCustom && category === option.value} className={!showCustom && category === option.value ? styles.chipActive : ""} onSelect={() => selectCategory(option.value)}>{option.label}</Button>)}<Button variant="flat" selected={showCustom} className={showCustom ? styles.chipActive : ""} onSelect={() => setShowCustom(!showCustom)}>Custom…</Button></div>
      {showCustom && <input type="text" className={styles.customCategory} value={customCategory} maxLength={40} autoFocus placeholder="Custom category name" onChange={event => { setCustomCategory(event.target.value); setCategory(EntryCategory.General); }} />}
      <Button variant="flat" className={styles.detailsToggle} onSelect={() => setShowDetails(!showDetails)}><span>{showDetails ? "-" : "+"}</span><strong>Add details</strong></Button>
      {showDetails && <div className={styles.details}>
        <div className={styles.priority}><span>Priority</span><div>{priorityLabels.map((label, value) => <Button key={label} variant="flat" selected={priority === value} className={priority === value ? styles.priorityActive : ""} onSelect={() => setPriority(value as EntryPriority)}>{label}</Button>)}</div></div>
        <textarea value={description} maxLength={4000} rows={4} placeholder="Add a description (optional)" onChange={event => setDescription(event.target.value)} />
      </div>}
    </div>
    <div className={styles.actions}><Button variant="flat" onSelect={discard}>Discard</Button><Button variant="primary" onSelect={save}>Save</Button></div>
  </Panel>;
}
