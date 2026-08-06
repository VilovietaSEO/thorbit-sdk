# Thorbit Python SDK

Typed Python client for the unified Thorbit API. Generated Pydantic models and methods cover all 117 Thorbit tools.

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
