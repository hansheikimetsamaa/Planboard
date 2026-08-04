import issueIcon from "../images/kind-issue.svg";
import noteIcon from "../images/kind-note.svg";
import ideaIcon from "../images/kind-idea.svg";
import { EntryKind } from "../types/contracts";

export function kindIconSource(kind: EntryKind) {
  return kind === EntryKind.Issue ? issueIcon : kind === EntryKind.Idea ? ideaIcon : noteIcon;
}

export function KindIcon({ kind, className = "" }: { kind: EntryKind; className?: string }) {
  return <img src={kindIconSource(kind)} alt="" aria-hidden="true" className={className} draggable={false} />;
}
