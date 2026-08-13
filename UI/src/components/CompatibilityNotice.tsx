// Explains when the loaded save format is protected from editing.

import { useEffect, useState } from "react";
import { trigger } from "cs2/api";
import { Button } from "cs2/ui";
import { Binding } from "../types/contracts";
import styles from "./compatibilityNotice.module.scss";

const eventName = "planboard:compatibility-change";
const issues: string[] = [];

export function reportCompatibilityIssue(message: string) {
  if (issues.includes(message)) return;
  issues.push(message);
  window.dispatchEvent(new Event(eventName));
}

export function CompatibilityNotice() {
  const [, refresh] = useState(0);
  useEffect(() => {
    const update = () => refresh((value) => value + 1);
    window.addEventListener(eventName, update);
    return () => window.removeEventListener(eventName, update);
  }, []);
  if (issues.length === 0) return null;

  return (
    <div className={styles.notice} role="alert">
      <div>
        <strong>Planboard compatibility notice</strong>
        {issues.map((issue) => (
          <span key={issue}>{issue}</span>
        ))}
      </div>
      <Button variant="flat" onSelect={() => trigger(Binding.group, Binding.setPanelVisible, true)}>
        Open Planboard
      </Button>
    </div>
  );
}
