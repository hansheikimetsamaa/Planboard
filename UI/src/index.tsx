// Bootstraps the Planboard Gameface UI and installs its game-facing toolbar hooks.

import React, { createElement } from "react";
import type { ModRegistrar } from "cs2/modding";
import { MainPanel } from "./components/MainPanel";
import { MapToolbar, TopLeftToolbar } from "./components/ToggleButton";
import { DraftNotePanel } from "./components/DraftNotePanel";
import { MapNotesOverlay } from "./components/MapNotesOverlay";
import { makeDistrictAction } from "./components/DistrictAction";
import { CompatibilityNotice, reportCompatibilityIssue } from "./components/CompatibilityNotice";

const register: ModRegistrar = (moduleRegistry) => {
  // Core Planboard surfaces must remain available even if an optional native extension changes.
  moduleRegistry.append("Game", MainPanel);
  moduleRegistry.append("Game", MapNotesOverlay);
  moduleRegistry.append("Game", DraftNotePanel);
  moduleRegistry.append("Game", CompatibilityNotice);
  // GameTopLeft is the public mod-toolbar hook used by Traffic and other CS2 mods.
  // MapToolbar itself chooses whether this or the legacy footer hook is visible.
  moduleRegistry.append("GameTopLeft", TopLeftToolbar);

  try {
    moduleRegistry.extend(
      "game-ui/game/components/toolbar/top/toggles.tsx",
      "EconomyPanelToggle",
      (EconomyPanelToggle: React.ComponentType<any>) => (props: any) =>
        createElement(
          React.Fragment,
          null,
          createElement(MapToolbar),
          createElement(EconomyPanelToggle, props),
        ),
    );
  } catch (error) {
    console.warn(
      "Planboard: native toolbar hook is unavailable; keyboard access remains active",
      error,
    );
    reportCompatibilityIssue(
      "The toolbar button is unavailable after a game UI change. Use Open Planboard here or Ctrl+Alt+P.",
    );
  }

  try {
    const InfoSection = moduleRegistry.registry.get(
      "game-ui/game/components/selected-info-panel/shared-components/info-section/info-section.tsx",
    )?.InfoSection as React.ComponentType<any> | undefined;
    if (!InfoSection) {
      reportCompatibilityIssue("District quick-add is unavailable after a game UI change.");
      return;
    }
    const DistrictAction = makeDistrictAction(InfoSection);
    moduleRegistry.extend(
      "game-ui/game/components/selected-info-panel/selected-info-sections/selected-info-sections.tsx",
      "selectedInfoSectionComponents",
      (original: Record<string, React.ComponentType<any>>) => {
        const Policies = original["Game.UI.InGame.PoliciesSection"];
        return {
          ...original,
          "Game.UI.InGame.PoliciesSection": (props: any) =>
            createElement(
              "div",
              null,
              Policies ? createElement(Policies, props) : null,
              createElement(DistrictAction, props),
            ),
        };
      },
    );
  } catch (error) {
    console.warn("Planboard: district action hook is unavailable", error);
    reportCompatibilityIssue("District quick-add is unavailable after a game UI change.");
  }
};

export default register;
