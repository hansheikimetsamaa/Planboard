import { CSSProperties, MouseEvent as ReactMouseEvent, useEffect, useMemo, useState } from "react";

type Number2 = { x: number; y: number };
type PanelKind = "main" | "sticky";
type StoredGeometry = { width: number; height: number; x: number; y: number };
type Constraints = { minWidth: number; minHeight: number; maxWidthRatio: number; maxHeightRatio: number };

const defaults: Record<PanelKind, StoredGeometry> = {
  main: { width: 650, height: 750, x: .62, y: .12 },
  sticky: { width: 380, height: 430, x: .7, y: .2 },
};

const storageKey = (key: PanelKind) => `planboard.geometry.${key}`;
const limit = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

function readGeometry(key: PanelKind): StoredGeometry {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(key)) || "null");
    // Upgrade only previous automatic defaults; manually chosen dimensions remain intact.
    if (key === "main" && (parsed?.height === 500 || parsed?.height === 560 || parsed?.height === 690))
      parsed.height = defaults.main.height;
    return { ...defaults[key], ...parsed };
  } catch {
    return defaults[key];
  }
}

function writeGeometry(key: PanelKind, value: StoredGeometry) {
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(value));
  } catch { }
}

function clampGeometry(value: StoredGeometry, constraints: Constraints): StoredGeometry {
  return {
    ...value,
    width: limit(value.width, constraints.minWidth, window.innerWidth * constraints.maxWidthRatio),
    height: limit(value.height, constraints.minHeight, window.innerHeight * constraints.maxHeightRatio),
    x: limit(value.x, 0, 1),
    y: limit(value.y, 0, 1),
  };
}

export function usePanelGeometry(
  key: PanelKind,
  minWidth: number,
  minHeight: number,
  maxWidthRatio: number,
  maxHeightRatio: number,
) {
  const constraints = useMemo<Constraints>(
    () => ({ minWidth, minHeight, maxWidthRatio, maxHeightRatio }),
    [minWidth, minHeight, maxWidthRatio, maxHeightRatio],
  );
  const [geometry, setGeometry] = useState<StoredGeometry>(() => clampGeometry(readGeometry(key), constraints));
  const [panelKey, setPanelKey] = useState(0);
  const initialPosition = useMemo<Number2>(() => ({ x: geometry.x, y: geometry.y }), [geometry.x, geometry.y, panelKey]);

  useEffect(() => {
    const handleResize = () => {
      setGeometry(current => clampGeometry(current, constraints));
      setPanelKey(current => current + 1);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [constraints]);

  const onPanelMouseUp = (event: ReactMouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const availableX = Math.max(1, window.innerWidth - rect.width);
    const availableY = Math.max(1, window.innerHeight - rect.height);
    setGeometry(current => {
      const next = clampGeometry({ ...current, x: rect.left / availableX, y: rect.top / availableY }, constraints);
      writeGeometry(key, next);
      return next;
    });
  };

  const startResize = (event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const { clientX: startX, clientY: startY } = event;
    const { width: startWidth, height: startHeight } = geometry;
    const resized = (next: MouseEvent, current: StoredGeometry) => clampGeometry({
      ...current,
      width: startWidth + next.clientX - startX,
      height: startHeight + next.clientY - startY,
    }, constraints);
    const move = (next: MouseEvent) => setGeometry(current => resized(next, current));
    const up = (next: MouseEvent) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      setGeometry(current => {
        const value = resized(next, current);
        writeGeometry(key, value);
        return value;
      });
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const reset = () => {
    try { localStorage.removeItem(storageKey(key)); } catch { }
    setGeometry(clampGeometry(defaults[key], constraints));
    setPanelKey(current => current + 1);
  };

  return {
    panelKey,
    initialPosition,
    panelStyle: { width: `${geometry.width}px`, height: `${geometry.height}px` } as CSSProperties,
    onPanelMouseUp,
    startResize,
    reset,
  };
}
