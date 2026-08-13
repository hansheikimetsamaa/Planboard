// Contains reusable selectors and controls for task metadata fields.

import { ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "cs2/ui";
import { EntryCategory, EntryKind, EntryPriority, EntryStatus } from "../types/contracts";
import { KindIcon } from "./KindIcon";
import { StatusIcon } from "./StatusIcon";
import styles from "./mainPanel.module.scss";

export type Option<T extends string | number> = {
  label: ReactNode;
  value: T;
  tone?: "none" | "low" | "medium" | "high";
};

export function Choice<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    // Gameface dropdowns are regular panel content, so outside dismissal is
    // handled explicitly instead of relying on a browser-native select menu.
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", dismiss);
    return () => window.removeEventListener("mousedown", dismiss);
  }, [open]);

  return (
    <div ref={root} className={`${styles.field} ${styles.choiceField}`}>
      <span>{label}</span>
      <Button
        variant="flat"
        className={styles.choice}
        aria-label={label}
        onSelect={() => setOpen(!open)}
      >
        {current?.label ?? "-"}
        <span>{open ? "-" : "+"}</span>
      </Button>
      {open && (
        <div className={styles.choiceMenu}>
          {options.map((option) => (
            <Button
              key={String(option.value)}
              variant="flat"
              selected={option.value === value}
              className={`${option.value === value ? styles.choiceSelected : ""} ${option.tone ? styles[`priority${option.tone[0].toUpperCase()}${option.tone.slice(1)}`] : ""}`}
              onSelect={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div className={styles.segmentField}>
      {label && <span>{label}</span>}
      <div className={styles.segmented}>
        {options.map((option) => (
          <Button
            key={String(option.value)}
            variant="flat"
            selected={option.value === value}
            className={`${option.value === value ? styles.segmentActive : ""} ${option.tone ? styles[`priority${option.tone[0].toUpperCase()}${option.tone.slice(1)}`] : ""}`}
            onSelect={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

// Priority is a single-choice semantic control. Sharing it prevents the draft
// and full editor from drifting into separate visual systems.
export function PriorityPicker({
  value,
  labels,
  onChange,
}: {
  value: EntryPriority;
  labels: string[];
  onChange: (value: EntryPriority) => void;
}) {
  const tones: Option<EntryPriority>["tone"][] = ["none", "low", "medium", "high"];

  return (
    <Segmented
      label="Priority"
      value={value}
      onChange={(next) => onChange(next as EntryPriority)}
      options={labels.map((label, next) => ({
        label,
        value: next as EntryPriority,
        tone: tones[next],
      }))}
    />
  );
}

export function KindPicker({
  value,
  labels,
  onChange,
}: {
  value: EntryKind;
  labels: string[];
  onChange: (value: EntryKind) => void;
}) {
  return (
    <Segmented
      label="Kind"
      value={value}
      onChange={(next) => onChange(next as EntryKind)}
      options={labels.map((label, next) => ({
        label: (
          <span className={styles.kindChoice}>
            <KindIcon kind={next as EntryKind} onLight={next === value} />
            {label}
          </span>
        ),
        value: next,
      }))}
    />
  );
}

export function StatusPicker({
  value,
  labels,
  onChange,
}: {
  value: EntryStatus;
  labels: string[];
  onChange: (value: EntryStatus) => void;
}) {
  return (
    <Segmented
      label="Status"
      value={value}
      onChange={(next) => onChange(next as EntryStatus)}
      options={labels.map((label, next) => ({
        label: (
          <span className={styles.statusChoice}>
            <StatusIcon status={next as EntryStatus} onLight={next === value} />
            {label}
          </span>
        ),
        value: next,
      }))}
    />
  );
}

export function CategoryPicker({
  value,
  custom,
  labels,
  open,
  onChange,
  onCustom,
  onOpenChange,
}: {
  value: EntryCategory;
  custom: string;
  labels: string[];
  open: boolean;
  onChange: (value: EntryCategory) => void;
  onCustom: (value: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const current = custom.trim() || labels[value] || labels[EntryCategory.General];
  return (
    <div className={styles.categoryPicker} onMouseDown={(event) => event.stopPropagation()}>
      <span>Category</span>
      <Button
        variant="flat"
        className={styles.categoryTrigger}
        onSelect={() => onOpenChange(!open)}
      >
        {current}
        <span>{open ? "-" : "+"}</span>
      </Button>
      {open && (
        <div className={styles.categoryMenu}>
          {labels.map((entryLabel, category) => (
            <Button
              key={entryLabel}
              variant="flat"
              selected={!custom && category === value}
              onSelect={() => {
                onChange(category as EntryCategory);
                onCustom("");
                onOpenChange(false);
              }}
            >
              {entryLabel}
            </Button>
          ))}
          <input
            type="text"
            aria-label="Custom category"
            value={custom}
            maxLength={40}
            placeholder="Custom category"
            onChange={(event) => {
              onCustom(event.target.value);
              onChange(EntryCategory.General);
            }}
          />
        </div>
      )}
    </div>
  );
}

export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Button
      variant="flat"
      selected={value}
      aria-pressed={value}
      className={`${styles.toggle} ${value ? styles.toggleActive : ""}`}
      onSelect={() => onChange(!value)}
    >
      <span className={styles.toggleIndicator} aria-hidden="true" />
      {label}
    </Button>
  );
}
