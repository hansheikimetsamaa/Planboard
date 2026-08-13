// Renders the consistent icon for each task status.

import openIcon from "../images/status-open.svg";
import doingIcon from "../images/status-doing.svg";
import doneIcon from "../images/status-done.svg";
import openDarkIcon from "../images/status-open-dark.svg";
import doingDarkIcon from "../images/status-doing-dark.svg";
import doneDarkIcon from "../images/status-done-dark.svg";
import { EntryStatus } from "../types/contracts";
import iconStyles from "./iconSystem.module.scss";

export function statusIconSource(status: EntryStatus) {
  return status === EntryStatus.Doing
    ? doingIcon
    : status === EntryStatus.Done
      ? doneIcon
      : openIcon;
}

function darkStatusIconSource(status: EntryStatus) {
  return status === EntryStatus.Doing
    ? doingDarkIcon
    : status === EntryStatus.Done
      ? doneDarkIcon
      : openDarkIcon;
}

export function StatusIcon({
  status,
  onLight = false,
  className = "",
}: {
  status: EntryStatus;
  onLight?: boolean;
  className?: string;
}) {
  return (
    <img
      src={onLight ? darkStatusIconSource(status) : statusIconSource(status)}
      alt=""
      aria-hidden="true"
      className={`${iconStyles.icon} ${onLight ? iconStyles.onLight : ""} ${className}`}
      draggable={false}
    />
  );
}
