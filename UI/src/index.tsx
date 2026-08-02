import React, { createElement } from "react";
import type { ModRegistrar } from "cs2/modding";
import { MainPanel } from "./components/MainPanel";
import { MapToolbar } from "./components/ToggleButton";
import { DraftNotePanel } from "./components/DraftNotePanel";
import { MapNotesOverlay } from "./components/MapNotesOverlay";
import { makeDistrictAction } from "./components/DistrictAction";

const register: ModRegistrar = (moduleRegistry) => {
  moduleRegistry.append("Game", MainPanel);
  moduleRegistry.append("Game", MapNotesOverlay);
  moduleRegistry.append("Game", DraftNotePanel);

  try {
    moduleRegistry.extend(
      "game-ui/game/components/toolbar/top/toggles.tsx",
      "EconomyPanelToggle",
      (EconomyPanelToggle: React.ComponentType<any>) => (props: any) => createElement(
        React.Fragment,
        null,
        createElement(MapToolbar),
        createElement(EconomyPanelToggle, props)
      )
    );
  } catch (error) {
    console.warn("Planboard: native toolbar hook is unavailable; keyboard access remains active", error);
  }

  try {
    const InfoSection = moduleRegistry.registry.get(
      "game-ui/game/components/selected-info-panel/shared-components/info-section/info-section.tsx"
    )?.InfoSection as React.ComponentType<any> | undefined;
    if (!InfoSection) return;
    const DistrictAction = makeDistrictAction(InfoSection);
    moduleRegistry.extend(
      "game-ui/game/components/selected-info-panel/selected-info-sections/selected-info-sections.tsx",
      "selectedInfoSectionComponents",
      (original: Record<string, React.ComponentType<any>>) => {
        const Policies = original["Game.UI.InGame.PoliciesSection"];
        return {
          ...original,
          "Game.UI.InGame.PoliciesSection": (props: any) => createElement(
            "div", null,
            Policies ? createElement(Policies, props) : null,
            createElement(DistrictAction, props)
          )
        };
      }
    );
  } catch (error) {
    console.warn("Planboard: district action hook is unavailable", error);
  }
};

export default register;
