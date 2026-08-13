# Dependency and compatibility policy

Planboard V1 has no runtime mod dependencies. Its Paradox Mods package must remain usable with only the base game and the official code-mod toolchain.

## Unified Icon Library — optional design resource, not a dependency

Unified Icon Library (Paradox mod `74417`) injects game-styled SVG files at `coui://uil/<Style>/<Icon>.svg`. Those icons are useful for ordinary React UI controls, but the library does not provide Planboard save data, placement logic, native world-marker entities, or category-specific notification prefabs.

Planboard therefore bundles the icons required for its essential controls and must not reference `coui://uil/` in V1. This avoids broken images when the library is absent and keeps the playset dependency graph small. If a later release adopts enough UIL artwork to justify requiring it, add Paradox dependency `74417` and test the minimum compatible version; do not silently treat UIL URLs as available.

Apache-2.0 artwork may be adapted and bundled only with the required license and NOTICE attribution. No UIL artwork is currently copied into Planboard.

## I18n Everywhere — soft compatibility

I18n Everywhere (Paradox mod `75426`) loads embedded JSON locales, centralized community translations, and language packs. Planboard already registers its English source with the game's `LocalizationManager` and uses `cs2/l10n` in React, so I18n Everywhere is not required for the base localization path.

A future translation contribution may ship through I18n Everywhere without adding a hard Planboard dependency. A separate language-pack mod that uses I18n Everywhere should declare `75426` itself. If Planboard later relies on I18n Everywhere's `lang/<locale>.json` loading instead of native sources, that change must be explicit and the dependency must be declared.

Do not compile against or reflect into I18n Everywhere. Planboard should continue working unchanged whether it is installed or not.

## Anarchy — compatibility only

Anarchy changes validation and placement behavior for vanilla object, network, area, terrain, bulldoze, and upgrade tools. Planboard places non-destructive planning markers with its own `ToolBaseSystem`; it must not require, enable, disable, or inspect Anarchy.

Compatibility expectation: Planboard placement and cancellation behave identically while Anarchy is installed or active. The only useful reuse is architectural learning about optional UI hooks, localization, tool cleanup, and explicit Paradox dependency declarations.

## ExtraLib / Extra Assets Importer — unrelated

The local `ExtraLib-main` project is the support library for the EXTRA asset/tool suite and its Extra Asset Menu. It registers editor asset categories and patches asset-oriented toolbar behavior. Planboard does not import custom assets into the editor or register EAM prefabs, so it must not reference ExtraLib or Extra Assets Importer.

The linked `AlphaGaming7780/ExtraAssetsImporter` repository and the local `ExtraLib-main` folder are related ecosystem projects but are not interchangeable package names. Neither is required for Planboard.

## Packaging matrix

| Mod                              | Relationship                                          | Paradox dependency |
| -------------------------------- | ----------------------------------------------------- | ------------------ |
| Unified Icon Library             | Optional reference; bundled Planboard icons preferred | None               |
| I18n Everywhere                  | Optional community-translation compatibility          | None               |
| Anarchy                          | Compatibility-test companion                          | None               |
| ExtraLib / Extra Assets Importer | No integration                                        | None               |

Before changing this matrix, require a concrete player-facing benefit that cannot be implemented safely with current game APIs. Any hard dependency must appear in both the Paradox publish configuration and the player documentation, and Planboard must fail clearly if that dependency is unavailable.
