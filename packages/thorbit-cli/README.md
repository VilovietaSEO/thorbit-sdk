# Thorbit CLI

Generated command-line interface for all 79 tools in the unified Thorbit API.

## Registry install (after publication)

The npm package is not published yet. Clone the public repository and use the
Development commands below today.

```bash
npm install --global thorbit-cli
```

Node.js 20 or newer is required.

## Use

```bash
export THORBIT_API_KEY="replace-with-your-key"

thorbit thorbit-account-projects-list \
  --input-json '{"limit":25}' \
  --output json
```

Use `thorbit --help` to list every command. Each command's help includes its exact MCP tool name, required fields, defaults, caps, scopes, cost, side effects, result mode, and suggested next tools.

Global options include:

- `--api-key <key>` or `THORBIT_API_KEY`
- `--base-url <url>`
- `--timeout-ms <milliseconds>`
- `--output json|text`

## Development

From the repository root:

```bash
npm install
npm run typecheck --workspace=thorbit-cli
npm run build --workspace=thorbit-cli
```

## License

MIT
