import { ReactNode, useState } from "react";
import { Button } from "cs2/ui";
import { EntryCategory, EntryKind, EntryStatus } from "../types/contracts";
import { KindIcon } from "./KindIcon";
import { StatusIcon } from "./StatusIcon";
import styles from "./mainPanel.module.scss";

export type Option<T extends string | number> = {
  label: ReactNode;
  value: T;
};

export function Choice<T extends string | number>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
}) {
  const index = Math.max(0, options.findIndex(option => option.value === value));
  const current = options[index];

  return <div className={styles.field}>
    <span>{label}</span>
    <Button
      variant="text"
      className={styles.choice}
      onSelect={() => options.length && onChange(options[(index + 1) % options.length].value)}
    >
      {current?.label ?? "-"}<span>+</span>
    </Button>
  </div>;
}

export function Segmented<T extends string | number>({ label, value, options, onChange }: {
  label?: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
}) {
  return <div className={styles.segmentField}>
    {label && <span>{label}</span>}
    <div className={styles.segmented}>
      {options.map(option => <Button
        key={String(option.value)}
        variant="flat"
        selected={option.value === value}
        className={option.value === value ? styles.segmentActive : ""}
        onSelect={() => onChange(option.value)}
      >{option.label}</Button>)}
    </div>
  </div>;
}

export function KindPicker({ value, labels, onChange }: {
  value: EntryKind;
  labels: string[];
  onChange: (value: EntryKind) => void;
}) {
  return <Segmented
    label="Kind"
    value={value}
    onChange={next => onChange(next as EntryKind)}
    options={labels.map((label, next) => ({
      label: <span className={styles.kindChoice}><KindIcon kind={next as EntryKind}/>{label}</span>,
      value: next
    }))}
  />;
}

export function StatusPicker({ value, labels, onChange }: {
  value: EntryStatus;
  labels: string[];
  onChange: (value: EntryStatus) => void;
}) {
  return <Segmented
    label="Status"
    value={value}
    onChange={next => onChange(next as EntryStatus)}
    options={labels.map((label, next) => ({
      label: <span className={styles.statusChoice}><StatusIcon status={next as EntryStatus}/>{label}</span>,
      value: next
    }))}
  />;
}

export function CategoryPicker({ value, custom, labels, onChange, onCustom }: {
  value: EntryCategory;
  custom: string;
  labels: string[];
  onChange: (value: EntryCategory) => void;
  onCustom: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = custom.trim() || labels[value] || labels[EntryCategory.General];

  return <div className={styles.categoryPicker}>
    <span>Category</span>
    <Button variant="flat" className={styles.categoryTrigger} onSelect={() => setOpen(!open)}>
      {current}<span>{open ? "-" : "+"}</span>
    </Button>
    {open && <div className={styles.categoryMenu}>
      {labels.map((label, category) => <Button
        key={label}
        variant="flat"
        selected={!custom && category === value}
        onSelect={() => {
          onChange(category as EntryCategory);
          onCustom("");
          setOpen(false);
        }}
      >{label}</Button>)}
      <input
        type="text"
        value={custom}
        maxLength={40}
        placeholder="Custom category"
        onChange={event => {
          onCustom(event.target.value);
          onChange(EntryCategory.General);
        }}
      />
    </div>}
  </div>;
}

export function Toggle({ label, value, onChange }: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return <Button
    variant="flat"
    selected={value}
    className={styles.toggle}
    onSelect={() => onChange(!value)}
  >
    <span>{value ? "[x]" : "[ ]"}</span>{label}
  </Button>;
}
