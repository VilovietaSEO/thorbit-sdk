# Thorbit Python SDK

Typed Python client for the unified Thorbit API. Generated Pydantic models and methods cover all 79 Thorbit tools.

## Registry install (after publication)

The PyPI package is not published yet. Clone the public repository and use the
Development commands below today.

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

The lower-level `CallThorbitTools.call_tool` method accepts a tool name, an input mapping, and a Pydantic-compatible result model for dynamic integrations.

## Authentication

Pass the API key as `api_key`. The options model stores it as `SecretStr`, sends it only to the configured Thorbit base URL, and rejects credentials embedded in URLs.

## Errors

Catch the exported stable exception classes:

- `ThorbitRequestValidationError`
- `ThorbitHttpError`
- `ThorbitResponseValidationError`
- `ThorbitResultModelError`
- `ThorbitTimeoutError`
- `ThorbitTransportError`

## Development

```bash
python -m pip install -e .
PYTHONPATH=src python -m unittest discover -s tests -p 'test_*.py'
```

## License

MIT
