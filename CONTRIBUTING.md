# Contributing

Thanks for helping improve Planboard.

## Development

1. Install Node.js 18 or newer.
2. Run `npm ci` in `UI/`.
3. Run `npm run typecheck`, `npm test`, and `npm run build`.
4. Run `npm run format:check` before committing UI, style, documentation, or workflow changes.
5. For native builds, install Cities: Skylines II and its official Windows modding toolchain as described in `docs/WINDOWS_BUILD.md`.

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for repository layout, formatting commands, and full local verification.

Keep changes focused and include tests for data, lifecycle, binding, or UI-contract behavior where practical. Do not commit generated build output, dependencies, local game files, or the ignored `Inspiration/` reference directory.
