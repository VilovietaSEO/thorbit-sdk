# Thorbit Python SDK

Typed Python client for the unified Thorbit API. Generated Pydantic models and methods cover all 148 Thorbit tools.

## Install

```bash
python -m pip install thorbit-sdk
```

Python 3.11 or newer is required.

## Use

```python
import os

from thorbit.generated_tools import GeneratedCallThorbitTools

with GeneratedCallThorbitTools(
    {"api_key": os.environ["THORBIT_API_KEY"]}
) as thorbit:
    response = thorbit.thorbit_account_projects_list({"limit": 25})
    print(response.result)
```

Purposeful Images starts with an opportunity board before selected generation:

```python
article = "A complete article to analyze for useful image opportunities."
board = thorbit.thorbit_images_start({
    "sourceText": article,
    "mode": "opportunity_board_only",
})
run = thorbit.thorbit_images_get({
    "runPublicId": board.result["runPublicId"],
})
```

The lower-level `CallThorbitTools.call_tool` method supports dynamic integrations. Catch the exported stable exception classes for validation, HTTP, timeout, response, and transport failures.

Source and the generated contract are public at [VilovietaSEO/thorbit-sdk](https://github.com/VilovietaSEO/thorbit-sdk).

## License

MIT

## Release 0.11.0

Bindings cover the current 148-tool Thorbit contract. Node SDK and CLI schemas require Zod 4; Python retains Pydantic 2. Existing per-tool batch limits are preserved. Standard Node requests use the MCP SDK's existing 10 MiB transport allowance, and hosted providers may impose a lower body limit. See the [package changelog](https://github.com/VilovietaSEO/thorbit-sdk/blob/main/packages/thorbit-sdk-python/CHANGELOG.md) and [migration notes](https://github.com/VilovietaSEO/thorbit-phoenix/blob/codex-harness/docs/releases/thorbit-mcp-zod4-migration.md).
