# Planboard

**City Tasks & Map Notes & ToDo**

Planboard is a location-aware planning mod for Cities: Skylines II. It keeps issues, notes, and ideas inside the city save and can attach them to map points, districts, roads, or buildings.

## Features

- Issue, Note, and Idea entry kinds
- Open, Doing, and Done statuses
- Built-in and custom categories with four priority levels
- One preferred deadline calendar: real-life or in-game
- Search, tabs, filters, sorting, overdue indicators, and recoverable deletion
- Optional map placement, marker navigation, sticky notes, and visibility modes
- District-panel quick creation
- Versioned save data with repair and missing-link reporting
- Remembered, resizable window layouts

## Repository layout

- `Code/` — C# mod, ECS systems, placement tool, serialization, rendering, settings, and UI bindings
- `UI/` — React/TypeScript Gameface UI
- `Tests/` — domain, lifecycle, binding-contract, and repository tests
- `docs/` — build, testing, and dependency notes
- `Inspiration/` — ignored local reference material; never published or included in builds

Planboard uses `Planboard` consistently for its assembly, namespaces, settings, localization, bindings, UI module, and serializer identity. Pre-release development saves made under an older internal identity are not supported.

## Local verification

```powershell
cd UI
npm ci
npm run typecheck
npm test
npm run build
```

`npm run build` writes only to `UI/build`. Use `npm run deploy` to build directly into the local CS2 Mods folder. A full native build runs that deployment automatically:

```powershell
cd ..
dotnet build .\Planboard.sln -c Release
```

The C# build requires Cities: Skylines II and its official Windows modding toolchain. See [docs/WINDOWS_BUILD.md](docs/WINDOWS_BUILD.md).

## License

MIT. See [LICENSE](LICENSE).
