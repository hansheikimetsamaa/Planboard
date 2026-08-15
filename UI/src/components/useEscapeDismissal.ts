// Coordinates the game's Back action across independent Gameface surfaces.

import { createElement, useEffect, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { InputActionConsumer } from "cs2/input";

type EscapeHandler = () => boolean;

type RegisteredHandler = {
  id: number;
  priority: number;
  handler: EscapeHandler;
};

const handlers: RegisteredHandler[] = [];
let nextHandlerId = 1;
export function dispatchBack() {
  const ordered = [...handlers].sort(
    (left, right) => right.priority - left.priority || right.id - left.id,
  );

  for (const entry of ordered) {
    if (!entry.handler()) continue;
    return true;
  }

  return false;
}

// Text controls receive their own keyboard event before the game-level action. The first Escape
// deliberately only leaves text-editing mode; a later Escape follows the normal panel hierarchy.
export function blurTextInputOnEscape(
  event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
) {
  if (event.key !== "Escape") return false;
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.blur();
  return true;
}

// Gameface resolves input from the deepest active surface. This scope is mounted with each open
// Planboard panel, so it sits above gameplay's Pause Menu handler without affecting map placement.
export function EscapeDismissalScope({ children }: { children: ReactNode }) {
  return createElement(InputActionConsumer, {
    actions: {
      Back: dispatchBack,
      "Pause Menu": dispatchBack,
    },
    ignoreFocusState: true,
    children,
  });
}

// Higher-priority child surfaces consume Escape before their containing panel.
// The ref keeps a registration stable while React refreshes the callback each render.
export function useEscapeDismissal(priority: number, handler: EscapeHandler, enabled = true) {
  const latestHandler = useRef(handler);
  latestHandler.current = handler;

  useEffect(() => {
    if (!enabled) return;

    const entry: RegisteredHandler = {
      id: nextHandlerId++,
      priority,
      handler: () => latestHandler.current(),
    };
    handlers.push(entry);

    return () => {
      const index = handlers.indexOf(entry);
      if (index >= 0) handlers.splice(index, 1);
    };
  }, [enabled, priority]);
}
