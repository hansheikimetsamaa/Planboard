// Provides the one scroll interaction model that Gameface consistently supports.

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  ReactNode,
  WheelEvent as ReactWheelEvent,
} from "react";
import styles from "./mainPanel.module.scss";

type ScrollMetrics = { clientHeight: number; scrollHeight: number; scrollTop: number };

export function ScrollableSurface({
  children,
  viewportClassName,
  frameClassName = "",
  ariaLabel,
}: {
  children: ReactNode;
  viewportClassName: string;
  frameClassName?: string;
  ariaLabel: string;
}) {
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

  // Gameface sends wheel events to the outer UI frame. Apply them to the real
  // viewport and only consume the event when this region actually moved, so a
  // parent editor can keep scrolling at the top or bottom of a nested list.
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
    <div className={`${styles.scrollFrame} ${frameClassName}`} onWheel={scrollWithWheel}>
      <div
        ref={viewportRef}
        className={`${styles.scrollViewport} ${viewportClassName}`}
        onScroll={refresh}
      >
        {children}
      </div>
      {overflowing && (
        <div
          ref={trackRef}
          className={styles.scrollbar}
          onMouseDown={beginDrag}
          role="scrollbar"
          aria-label={ariaLabel}
          aria-valuemin={0}
          aria-valuemax={maximumScroll}
          aria-valuenow={Math.round(metrics.scrollTop)}
        >
          <div
            className={styles.scrollbarThumb}
            style={{ height: `${thumbHeight}px`, transform: `translateY(${thumbTop}px)` }}
            onMouseDown={beginDrag}
          />
        </div>
      )}
    </div>
  );
}
