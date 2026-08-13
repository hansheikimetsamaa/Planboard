// Shows recoverable data warnings and their affected Planboard entries.

import { DataIssueView } from "../types/contracts";
import styles from "./mainPanel.module.scss";
export function ReadOnlyNotice({ issues }: { issues: DataIssueView[] }) {
  return (
    <div className={styles.readOnlyNotice} role="alert">
      <strong>Planboard data needs a newer compatible version</strong>
      <p>
        Editing is disabled and Planboard will block saving this city to prevent replacing its data.
      </p>
      <p>
        Quit without saving, install the Planboard version that created this city, and load it
        again. If you must save first, make a backup and verify the game preserves disabled-mod data
        before disabling Planboard.
      </p>
      <DataIssuesPanel issues={issues} />
    </div>
  );
}
export function DataIssuesPanel({ issues }: { issues: DataIssueView[] }) {
  return (
    <div className={styles.dataIssuesPanel}>
      {issues.map((issue, index) => (
        <div
          key={`${issue.entryId}-${index}`}
          className={issue.severity === 1 ? styles.dataIssueError : styles.dataIssueWarning}
        >
          <strong>
            {issue.severity === 1 ? "Error" : "Warning"}
            {issue.entryId > 0 ? ` \u00B7 Entry #${issue.entryId}` : ""}
          </strong>
          <span>{issue.message}</span>
          {issue.severity === 1 && (
            <small>Restore a backup or use a compatible Planboard version before saving.</small>
          )}
        </div>
      ))}
    </div>
  );
}
