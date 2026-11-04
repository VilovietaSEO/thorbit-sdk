# Thorbit CLI

Generated command-line interface for all 148 tools in the unified Thorbit API.

## Install

```bash
npm install --global thorbit-cli
```

## Use

```bash
export THORBIT_API_KEY="replace-with-your-key"

thorbit thorbit-account-projects-list \
  --input-json '{"limit":25}' \
  --output json
```

Create an image opportunity board without invoking paid image generation:

```bash
thorbit thorbit-images-start \
  --input-json '{"sourceText":"Article text here","mode":"opportunity_board_only"}' \
  --output json
```

Use `thorbit --help` to list every command. Each command documents its exact MCP tool name, required fields, defaults, caps, scopes, cost, side effects, result mode, and suggested next tools.

Source and the generated contract are public at [VilovietaSEO/thorbit-sdk](https://github.com/VilovietaSEO/thorbit-sdk).

## Private admin CLI

Thorbit operators create a personal CLI key in **Admin → Team access → Personal
CLI access**. Admin credentials are separate from customer API keys and keep the
operator's current Phoenix roles and permissions.

```bash
export THORBIT_ADMIN_API_KEY="thbt_op_..."

thorbit admin whoami --output json
thorbit admin request GET users/list/pii \
  --query-json '{"search":"person@example.com","limit":25}' \
  --output json
```

Mutations use the same confirmation fields, policies, permission checks, and
audit behavior as the web admin. The generic command refuses paths outside
`/api/admin`.

## License

MIT

## Release 0.13.0

Bindings cover the current 148-tool Thorbit contract. Node SDK and CLI schemas require Zod 4; Python retains Pydantic 2. Existing per-tool batch limits are preserved. Standard Node requests use the MCP SDK's existing 10 MiB transport allowance, and hosted providers may impose a lower body limit. See the [package changelog](https://github.com/VilovietaSEO/thorbit-sdk/blob/main/packages/thorbit-cli/CHANGELOG.md) and [migration notes](https://github.com/VilovietaSEO/thorbit-sdk/blob/main/docs/zod4-migration.md).
