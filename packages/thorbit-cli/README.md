# Thorbit CLI

Generated command-line interface for all 79 tools in the unified Thorbit API.

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
