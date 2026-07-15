# Thorbit SDK

Typed clients and generated command surfaces for the unified Thorbit API.

This repository contains customer-safe interfaces for all 79 Thorbit tools across Account, Knowledge Graph, Topic Map, ICP, Deposition, Money Keyword Research, Knowledge Base, and Content/On-page.

## Included surfaces

- `packages/thorbit-sdk-node` — typed Node.js SDK with generated methods and Zod schemas.
- `packages/thorbit-sdk-python` — typed Python SDK with generated Pydantic models and methods.
- `packages/thorbit-cli` — generated CLI commands for every tool.
- `docs/curl.md` — one cURL example per tool.
- `contracts/thorbit-mcp-tools.json` — canonical customer-safe tool contract.

All clients call the unified route:

```text
POST https://thorbit.ai/api/v1/mcp/thorbit/{toolName}
```

Authentication uses a Thorbit API key. Keep the key in `THORBIT_API_KEY`; never commit it to source.

> **Registry status:** this public repository is usable source today. The `thorbit-sdk` and
> `thorbit-cli` npm packages and the `thorbit-sdk` PyPI package are release-ready names, but they
> have not been published yet. The registry commands below become active with that separate release.

## Use from source today

```bash
git clone https://github.com/VilovietaSEO/thorbit-sdk.git
cd thorbit-sdk
npm install
npm run verify
```

## Node.js (after npm publication)

```bash
npm install thorbit-sdk
```

```ts
import { CallThorbitTools } from "thorbit-sdk";

const thorbit = new CallThorbitTools({
  apiKey: process.env.THORBIT_API_KEY!,
});

const balance = await thorbit.thorbitAccountCreditsGetBalance({});
console.log(balance.result);
```

See [the Node SDK README](packages/thorbit-sdk-node/README.md).

## Python (after PyPI publication)

```bash
python -m pip install thorbit-sdk
```

```python
import os

from thorbit.generated_tools import GeneratedCallThorbitTools

with GeneratedCallThorbitTools({"api_key": os.environ["THORBIT_API_KEY"]}) as thorbit:
    balance = thorbit.thorbit_account_credits_get_balance({})
    print(balance.result)
```

See [the Python SDK README](packages/thorbit-sdk-python/README.md).

## CLI (after npm publication)

```bash
npm install --global thorbit-cli
export THORBIT_API_KEY="replace-with-your-key"
thorbit thorbit-account-credits-get-balance --input-json '{}'
```

Use `thorbit --help` to list commands and `thorbit <command> --help` for scopes, cost, side effects, result mode, and continuation tools.

See [the CLI README](packages/thorbit-cli/README.md).

## cURL

The [cURL reference](docs/curl.md) documents authentication, structured responses, error behavior, and every generated tool call.

## Development

Requirements:

- Node.js 20 or newer
- npm 10 or newer
- Python 3.11 or newer

```bash
npm install
npm run verify
```

`npm run verify` type-checks and builds the Node SDK and CLI, runs the Node transport tests, and runs the Python transport tests. Build outputs and dependency directories are intentionally not committed.

## Package publication

This repository is the public source distribution. Publishing `thorbit-sdk` or `thorbit-cli` to npm and `thorbit-sdk` to PyPI is a separate release operation.

## License

MIT
