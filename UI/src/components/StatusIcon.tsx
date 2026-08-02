import openIcon from "../images/status-open.svg";
import doingIcon from "../images/status-doing.svg";
import doneIcon from "../images/status-done.svg";
import { EntryStatus } from "../types/contracts";

export function statusIconSource(status: EntryStatus) {
  return status === EntryStatus.Doing ? doingIcon : status === EntryStatus.Done ? doneIcon : openIcon;
}
export function StatusIcon({ status, className = "" }: { status: EntryStatus; className?: string }) {
  return <img src={statusIconSource(status)} className={className} draggable={false} />;
}