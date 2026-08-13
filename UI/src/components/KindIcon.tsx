// Renders the consistent icon for each task kind.

import issueIcon from "../images/kind-issue.svg";
import noteIcon from "../images/kind-note.svg";
import ideaIcon from "../images/kind-idea.svg";
import issueDarkIcon from "../images/kind-issue-dark.svg";
import noteDarkIcon from "../images/kind-note-dark.svg";
import ideaDarkIcon from "../images/kind-idea-dark.svg";
import { EntryKind } from "../types/contracts";
import iconStyles from "./iconSystem.module.scss";

export function kindIconSource(kind: EntryKind) {
  return kind === EntryKind.Issue ? issueIcon : kind === EntryKind.Idea ? ideaIcon : noteIcon;
}

function darkKindIconSource(kind: EntryKind) {
  return kind === EntryKind.Issue
    ? issueDarkIcon
    : kind === EntryKind.Idea
      ? ideaDarkIcon
      : noteDarkIcon;
}

export function KindIcon({
  kind,
  onLight = false,
  className = "",
}: {
  kind: EntryKind;
  onLight?: boolean;
  className?: string;
}) {
  return (
    <img
      src={onLight ? darkKindIconSource(kind) : kindIconSource(kind)}
      alt=""
      aria-hidden="true"
      className={`${iconStyles.icon} ${onLight ? iconStyles.onLight : ""} ${className}`}
      draggable={false}
    />
  );
}
