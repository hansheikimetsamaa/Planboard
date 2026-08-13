# Development guide

## Repository layout

- `Code/` — C# mod, ECS systems, placement, serialization, rendering, settings, and UI bindings.
- `UI/` — React/TypeScript Gameface UI.
- `Tests/` — domain, lifecycle, binding-contract, and repository tests.
- `docs/` — build, testing, formatting, and dependency notes.
- `Inspiration/` — ignored local reference material; never published or included in builds.

Planboard uses `Planboard` consistently for its assembly, namespaces, settings, localization, bindings,
UI module, and serializer identity. Pre-release saves created under an older internal identity are not
supported.

## Formatting

The repository uses `.editorconfig`, Prettier, and `dotnet format` to keep source readable.

```powershell
cd UI
npm ci
npm run format
npm run format:check
```

Run the C# formatter from the repository root after the Cities: Skylines II modding toolchain is
available:

```powershell
dotnet restore .\Planboard.sln
dotnet format .\Planboard.sln --no-restore
dotnet format .\Planboard.sln --verify-no-changes --no-restore
```

## Local verification

```powershell
cd UI
npm ci
npm run typecheck
npm test
npm run build
```

`npm run build` writes only to `UI/build`. Use `npm run deploy` to build directly into the local CS2
Mods folder. A full native build runs that UI deployment automatically:

```powershell
cd ..
dotnet build .\Planboard.sln -c Release
```

The C# build requires Cities: Skylines II and its official Windows modding toolchain. See
[WINDOWS_BUILD.md](WINDOWS_BUILD.md) for machine setup and in-game smoke testing.
