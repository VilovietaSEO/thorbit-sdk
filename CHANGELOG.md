# Changelog

All notable changes to the public Thorbit SDK source are documented here.

## [Unreleased]

## [0.11.0] - 2026-11-04

### Changed

- Publish matched Node SDK, CLI and Python SDK for the current 148-tool contract. Node SDK and CLI require Zod 4 and enforce shared input limits before validation or transmission.
- Preserve Python's Pydantic 2 API and refresh generated models. Public npm archives omit source maps.

## [0.10.1] - 2026-08-05

### Added

- Add Purposeful Images across the Node SDK, Python SDK, CLI, cURL guide, and
  canonical 117-tool contract.
- Expose opportunity-board planning, selected image production, status,
  review, artifact, and cost operations through generated clients.

### Changed

- Regenerate every public client surface for 12 specialist MCP products and
  add automatic prepublish builds to the Node SDK and CLI packages.

## [0.5.0] - 2026-07-25

### Added

- Expose `thorbit_money_kw_artifact_read` across the Node SDK, Python SDK, CLI,
  cURL guide, and canonical 84-tool contract.
- Support paginated reads of the complete final Money Keyword list, candidate
  ledger, research, and run artifacts without rerunning the workflow.

### Changed

- Update every generated public client surface to the Thorbit Phoenix 0.17.0
  Money Keyword retrieval contract.

### Fixed

- Preserve the uv runtime setup required by the provenance publisher's full
  Node, CLI, and Python verification command.

## [0.2.0] - 2026-07-21

### Added

- Publish the generated Node SDK, Python SDK, CLI, cURL reference, and canonical
  tool contract from one public source repository with trusted-publishing
  workflows.

### Changed

- Bring all SDK surfaces to the current 79-tool unified Thorbit contract.
- Add the current Money Keyword MCP start contract, including
  `websiteUrl` and `idempotencyKey`, to every generated client surface.
- Include the complete Topic Map competitor mapping limits and the protected
  operator CLI capability in the public CLI source.

### Fixed

- Correct stale Money Keyword and Topic Map descriptions, input caps, and
  examples in generated clients and cURL documentation.

[Unreleased]: https://github.com/VilovietaSEO/thorbit-sdk/compare/v0.11.0...HEAD
[0.10.1]: https://github.com/VilovietaSEO/thorbit-sdk/compare/v0.5.0...v0.10.1
[0.5.0]: https://github.com/VilovietaSEO/thorbit-sdk/compare/v0.4.0...v0.5.0
[0.2.0]: https://github.com/VilovietaSEO/thorbit-sdk/compare/v0.1.0...v0.2.0

[0.11.0]: https://github.com/VilovietaSEO/thorbit-sdk/compare/v0.10.1...v0.11.0
