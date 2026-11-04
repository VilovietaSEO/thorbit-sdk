# Changelog

## [Unreleased]

## [0.13.1] - 2026-11-04

### Fixed

- Preserve rejection of undefined and serialize explicit JSON null unchanged while enforcing input bounds. Do not substitute an empty request.

## [0.13.0] - 2026-11-04

### Changed

- Refresh generated bindings from the current 148-tool Thorbit MCP contract, including WordPress operations and bounded collection schemas.
- Node SDK and CLI use Zod 4 and reject oversized inputs before schema parsing or network calls. Exported Node schemas require Zod 4. Python retains Pydantic 2.
- Omit source maps from public npm archives.


[Unreleased]: https://github.com/VilovietaSEO/thorbit-sdk/compare/node-v0.13.1...HEAD
[0.13.0]: https://github.com/VilovietaSEO/thorbit-sdk/compare/v0.10.1...node-v0.13.0

[0.13.1]: https://github.com/VilovietaSEO/thorbit-sdk/compare/node-v0.13.0...node-v0.13.1
