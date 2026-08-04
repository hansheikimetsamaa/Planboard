# Windows build and game validation

## Prerequisites

1. Install Cities: Skylines II.
2. Install or update the official code-modding toolchain from **Options → Modding**.
3. Confirm the user environment variables `CSII_TOOLPATH` and `CSII_USERDATAPATH` exist.
4. Install the .NET SDK/Visual Studio tooling and Node.js 18 or newer.
5. Restart terminals and IDEs after changing the toolchain environment.

## Verify the UI

```powershell
cd "<checkout>\UI"
npm ci
npm run typecheck
npm test
npm run build
```

`npm run build` is intentionally local-only and writes to `UI/build`. To install only the UI bundle into the game:

```powershell
npm run deploy
```

## Build and deploy the complete mod

Close Cities: Skylines II, then run:

```powershell
cd "<checkout>"
dotnet build .\Planboard.sln -c Release
```

The official `Mod.targets` post-processes and deploys the native assembly. The `BuildUI` target runs `npm run deploy`, so the matching UI bundle is installed in the same build. Do not manually copy `UI/build` into the game folder.

## In-game smoke test

1. Enable Planboard in the active playset and load a disposable city.
2. Confirm `Logs\Planboard.log` contains `Loading Planboard`.
3. Confirm the three-button Planboard group appears immediately left of the bottom money/economy field.
4. Open the panel, click `+`, and verify the full new-item detail page appears.
5. Test list-only creation and Create & place, including placement cancellation.
6. Verify the selected deadline preference controls the editor, sorting, overdue filter, and sticky cards.
7. Test terrain, road, building, and district placement; then move and remove locations.
8. Test marker visibility modes, selected-row sticky display, deletion, and Undo.
9. Save and reload, then remove a linked city object and verify fallback coordinates and missing-link reporting.

## Native CI runner

`Native Verify` is a manual GitHub Actions workflow for a self-hosted Windows runner labelled `cs2-modding`. It runs the same native Release build that deploys the mod UI. Configure `CSII_TOOLPATH` and `CSII_USERDATAPATH` as user environment variables for the runner service, install the official Cities: Skylines II code-modding toolchain, and use a disposable local city-save directory. GitHub-hosted runners cannot run this workflow because the official toolchain depends on locally installed game files.

## Packaging

1. Update versions, changelog, description, thumbnail, and screenshots.
2. Run the Release build and the full smoke test with only the packaged output enabled.
3. Publish with the official toolchain-generated profile.
