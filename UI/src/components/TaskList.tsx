// Renders the virtualized task list, its custom scrollbar, and row actions.

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  ReactNode,
  RefObject,
  WheelEvent as ReactWheelEvent,
} from "react";
import { trigger } from "cs2/api";
import { Button } from "cs2/ui";
import { createPortal } from "react-dom";
import { Binding, EntryKind, EntryStatus, EntryView } from "../types/contracts";
import { KindIcon } from "./KindIcon";
import { StatusIcon } from "./StatusIcon";
import styles from "./mainPanel.module.scss";

type ScrollMetrics = { clientHeight: number; scrollHeight: number; scrollTop: number };
export type ListPopoverKind = "status" | "actions";

function ListPopover({
  anchor,
  overlayHost,
  className,
  height,
  minimumWidth,
  onClose,
  children,
}: {
  anchor: RefObject<HTMLElement>;
  overlayHost: RefObject<HTMLDivElement>;
  className: string;
  height: number;
  minimumWidth: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const popup = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(
    null,
  );

  useEffect(() => {
    const updatePosition = () => {
      const trigger = anchor.current;
      const host = overlayHost.current;
      if (!trigger || !host) return;
      const triggerBounds = trigger.getBoundingClientRect();
      const hostBounds = host.getBoundingClientRect();
      // Menus may outgrow their trigger, but never shrink below the space
      // their own labels need. Wider triggers still keep the menu aligned.
      const width = Math.max(minimumWidth, triggerBounds.width);
      const left = Math.max(
        8,
        Math.min(hostBounds.width - width - 8, triggerBounds.right - hostBounds.left - width),
      );
      const below = triggerBounds.bottom - hostBounds.top + 4;
      const top =
        below + height <= hostBounds.height - 8
          ? below
          : Math.max(8, triggerBounds.top - hostBounds.top - height - 4);
      setPosition({ left, top, width });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchor, height, minimumWidth, overlayHost]);

  useEffect(() => {
    const dismiss = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!anchor.current?.contains(target) && !popup.current?.contains(target)) onClose();
    };
    window.addEventListener("mousedown", dismiss);
    return () => window.removeEventListener("mousedown", dismiss);
  }, [anchor, onClose]);

  return position && overlayHost.current
    ? createPortal(
        <div
          ref={popup}
          className={className}
          style={{
            left: `${position.left}px`,
            top: `${position.top}px`,
            width: `${position.width}px`,
          }}
        >
          {children}
        </div>,
        overlayHost.current,
      )
    : null;
}

export function ScrollableTaskList({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<ScrollMetrics>({
    clientHeight: 0,
    scrollHeight: 0,
    scrollTop: 0,
  });
  const refresh = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const next = {
      clientHeight: viewport.clientHeight,
      scrollHeight: viewport.scrollHeight,
      scrollTop: viewport.scrollTop,
    };
    setMetrics((previous) =>
      previous.clientHeight === next.clientHeight &&
      previous.scrollHeight === next.scrollHeight &&
      previous.scrollTop === next.scrollTop
        ? previous
        : next,
    );
  }, []);
  useEffect(() => {
    refresh();
    const timer = window.setTimeout(refresh, 0);
    window.addEventListener("resize", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", refresh);
    };
  }, [children, refresh]);

  const overflowing = metrics.scrollHeight > metrics.clientHeight + 1;
  const thumbHeight = overflowing
    ? Math.max(24, Math.round((metrics.clientHeight * metrics.clientHeight) / metrics.scrollHeight))
    : 0;
  const maximumScroll = Math.max(0, metrics.scrollHeight - metrics.clientHeight);
  const maximumThumbTop = Math.max(0, metrics.clientHeight - thumbHeight);
  const thumbTop =
    maximumScroll > 0 ? Math.round((metrics.scrollTop / maximumScroll) * maximumThumbTop) : 0;
  const scrollFromPointer = (clientY: number) => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track || maximumScroll === 0) return;
    const bounds = track.getBoundingClientRect();
    const position = Math.max(
      0,
      Math.min(bounds.height - thumbHeight, clientY - bounds.top - thumbHeight / 2),
    );
    viewport.scrollTop = (position / Math.max(1, bounds.height - thumbHeight)) * maximumScroll;
    refresh();
  };
  // Gameface supplies no usable native scrollbar here, so dragging the custom
  // track and thumb must drive the viewport's actual scroll position.
  const beginDrag = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    scrollFromPointer(event.clientY);
    const move = (moveEvent: MouseEvent) => scrollFromPointer(moveEvent.clientY);
    const end = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", end);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", end);
  };

  // Wheel events land on the frame rather than the overflow viewport in Gameface.
  // Forward them so wheel and drag interactions update the same scroll state.
  const scrollWithWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport || maximumScroll === 0 || event.deltaY === 0) return;
    const unit = event.deltaMode === 1 ? 32 : event.deltaMode === 2 ? viewport.clientHeight : 1;
    const previous = viewport.scrollTop;
    viewport.scrollTop = Math.max(0, Math.min(maximumScroll, previous + event.deltaY * unit));
    if (viewport.scrollTop !== previous) {
      event.preventDefault();
      event.stopPropagation();
      refresh();
    }
  };
  return (
    <div className={styles.taskScrollFrame} onWheel={scrollWithWheel}>
      <div ref={viewportRef} className={styles.taskList} onScroll={refresh}>
        {children}
      </div>
      {overflowing && (
        <div
          ref={trackRef}
          className={styles.taskScrollbar}
          onMouseDown={beginDrag}
          role="scrollbar"
          aria-label="Task list scrollbar"
          aria-valuemin={0}
          aria-valuemax={maximumScroll}
          aria-valuenow={Math.round(metrics.scrollTop)}
        >
          <div
            className={styles.taskScrollbarThumb}
            style={{ height: `${thumbHeight}px`, transform: `translateY(${thumbTop}px)` }}
            onMouseDown={beginDrag}
          />
        </div>
      )}
    </div>
  );
}

export function EntryRow({
  entry,
  category,
  kindLabel,
  statusLabels,
  highlighted,
  activePopover,
  onPopoverChange,
  overlayHost,
  onOpen,
  onDelete,
}: {
  entry: EntryView;
  category: string;
  kindLabel: string;
  statusLabels: string[];
  highlighted: boolean;
  activePopover: ListPopoverKind | null;
  onPopoverChange: (next: ListPopoverKind | null) => void;
  overlayHost: RefObject<HTMLDivElement>;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false),
    [title, setTitle] = useState(entry.title);
  const openTimer = useRef<number | null>(null);
  // CS2's Button is not a ref-forwarding DOM component. The lightweight
  // wrappers are the reliable shared anchors for every list popup.
  const statusTrigger = useRef<HTMLDivElement>(null);
  const menuTrigger = useRef<HTMLDivElement>(null);
  useEffect(
    () => () => {
      if (openTimer.current !== null) window.clearTimeout(openTimer.current);
    },
    [],
  );
  const scheduleOpen = () => {
    if (openTimer.current !== null) window.clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(() => {
      openTimer.current = null;
      onOpen();
    }, 220);
  };
  const beginRename = () => {
    if (openTimer.current !== null) window.clearTimeout(openTimer.current);
    openTimer.current = null;
    setEditing(true);
  };
  const saveTitle = () => {
    const value = title.trim();
    setEditing(false);
    if (value && value !== entry.title)
      trigger(
        Binding.group,
        Binding.updateEntry,
        entry.id,
        value,
        entry.description,
        entry.kind,
        entry.category,
        entry.categoryName,
        entry.status,
        entry.priority,
        entry.realDueDateTicks,
        entry.gameDueDateTicks,
      );
  };
  return (
    <div
      className={`${styles.taskRow} ${entry.status === EntryStatus.Done ? styles.taskDone : ""} ${highlighted ? styles.taskHighlight : ""}`}
    >
      {editing ? (
        <input
          autoFocus
          className={styles.rowRename}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveTitle();
            if (e.key === "Escape") {
              setTitle(entry.title);
              setEditing(false);
            }
          }}
        />
      ) : (
        <Button
          variant="flat"
          className={styles.rowOpen}
          onSelect={scheduleOpen}
          onDoubleClick={beginRename}
        >
          <span
            className={`${styles.kindBadge} ${entry.kind === EntryKind.Issue ? styles.kindIssue : entry.kind === EntryKind.Idea ? styles.kindIdea : styles.kindNote}`}
          >
            <KindIcon kind={entry.kind} onLight />
          </span>
          <span className={styles.taskMain}>
            <strong>{entry.title}</strong>
            <span>
              {kindLabel} - {category}
            </span>
          </span>
        </Button>
      )}
      {!editing && (
        <div ref={statusTrigger} className={styles.rowStatusControl}>
          <Button
            variant="flat"
            className={`${styles.rowStatus} ${activePopover === "status" ? styles.rowStatusOpen : ""}`}
            aria-label={`Change status for ${entry.title}`}
            aria-expanded={activePopover === "status"}
            onSelect={() => onPopoverChange(activePopover === "status" ? null : "status")}
          >
            <StatusIcon status={entry.status} />
            <span>{statusLabels[entry.status]}</span>
            <span className={styles.rowStatusIndicator} aria-hidden="true" />
          </Button>
          {activePopover === "status" && (
            <ListPopover
              anchor={statusTrigger}
              overlayHost={overlayHost}
              className={styles.rowStatusMenu}
              height={90}
              minimumWidth={78}
              onClose={() => onPopoverChange(null)}
            >
              {statusLabels.map((label, status) => (
                <Button
                  key={label}
                  variant="flat"
                  selected={status === entry.status}
                  className={status === entry.status ? styles.rowStatusSelected : ""}
                  onSelect={() => {
                    trigger(Binding.group, Binding.setStatus, entry.id, status);
                    onPopoverChange(null);
                  }}
                >
                  <StatusIcon status={status as EntryStatus} />
                  {label}
                </Button>
              ))}
            </ListPopover>
          )}
        </div>
      )}
      <div ref={menuTrigger} className={styles.rowMenuControl}>
        <Button
          variant="flat"
          className={styles.rowMenuButton}
          aria-label={`More actions for ${entry.title}`}
          aria-expanded={activePopover === "actions"}
          onSelect={() => onPopoverChange(activePopover === "actions" ? null : "actions")}
        >
          {"\u22ef"}
        </Button>
      </div>
      {activePopover === "actions" && (
        <ListPopover
          anchor={menuTrigger}
          overlayHost={overlayHost}
          className={styles.rowMenu}
          height={66}
          minimumWidth={94}
          onClose={() => onPopoverChange(null)}
        >
          <Button
            variant="flat"
            onSelect={() => {
              onPopoverChange(null);
              entry.hasLocation
                ? trigger(Binding.group, Binding.navigateToEntry, entry.id)
                : trigger(Binding.group, Binding.beginPlacement, entry.id);
            }}
          >
            {entry.hasLocation ? "View pin" : "Add pin"}
          </Button>
          <Button
            variant="flat"
            onSelect={() => {
              onPopoverChange(null);
              onDelete();
            }}
          >
            Delete
          </Button>
        </ListPopover>
      )}
    </div>
  );
}
