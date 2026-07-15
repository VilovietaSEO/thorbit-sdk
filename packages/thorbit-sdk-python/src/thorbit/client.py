"""Validated synchronous transport for the unified Thorbit tool API."""

from __future__ import annotations

from collections.abc import Mapping
from types import TracebackType
from typing import Protocol, TypeVar, cast, runtime_checkable
from urllib.parse import quote

import httpx
from pydantic import (
    AnyHttpUrl,
    BaseModel,
    ConfigDict,
    Field,
    SecretStr,
    TypeAdapter,
    ValidationError,
    field_validator,
)
from pydantic.errors import PydanticUserError

TResult = TypeVar("TResult")

DEFAULT_THORBIT_BASE_URL = "https://thorbit.ai"
DEFAULT_THORBIT_TIMEOUT_SECONDS = 120.0
THORBIT_TOOL_ROUTE = "/api/v1/mcp/thorbit"


class ThorbitClientOptions(BaseModel):
    """Validated connection options whose representation redacts the API key."""

    model_config = ConfigDict(
        extra="forbid",
        frozen=True,
        str_strip_whitespace=True,
        validate_default=True,
    )

    api_key: SecretStr
    base_url: AnyHttpUrl = Field(default=DEFAULT_THORBIT_BASE_URL)
    timeout_seconds: float = Field(
        default=DEFAULT_THORBIT_TIMEOUT_SECONDS,
        ge=1,
        le=300,
    )

    @field_validator("api_key")
    @classmethod
    def validate_api_key(cls, api_key: SecretStr) -> SecretStr:
        if not api_key.get_secret_value().strip():
            raise ValueError("api_key must not be empty")
        return api_key

    @field_validator("base_url")
    @classmethod
    def validate_base_url(cls, base_url: AnyHttpUrl) -> AnyHttpUrl:
        if base_url.username is not None or base_url.password is not None:
            raise ValueError("base_url must not contain credentials")
        if base_url.query is not None or base_url.fragment is not None:
            raise ValueError("base_url must not contain a query or fragment")
        return base_url


@runtime_checkable
class ThorbitClientProtocol(Protocol):
    """Structural contract implemented by the generic and generated clients."""

    def call_tool(
        self,
        tool_name: str,
        input: Mapping[str, object],
        result_model: type[TResult],
    ) -> TResult:
        """Call one exact MCP tool and validate its response model."""
        ...


class ThorbitSdkError(Exception):
    """Base class for stable, catchable Thorbit SDK failures."""


class ThorbitRequestValidationError(ThorbitSdkError):
    """The local tool invocation could not be safely serialized."""


class ThorbitTransportError(ThorbitSdkError):
    """The Thorbit HTTP exchange did not produce a response."""


class ThorbitTimeoutError(ThorbitTransportError):
    """The Thorbit request exceeded the configured timeout."""

    def __init__(self, timeout_seconds: float) -> None:
        super().__init__(
            f"Thorbit API request timed out after {timeout_seconds:g} seconds"
        )
        self.timeout_seconds = timeout_seconds


class ThorbitHttpError(ThorbitSdkError):
    """A non-success HTTP response with canonical Thorbit error metadata."""

    def __init__(
        self,
        status_code: int,
        message: str,
        *,
        code: str | None = None,
        request_id: str | None = None,
        retryable: bool | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.request_id = request_id
        self.retryable = retryable


class ThorbitResponseValidationError(ThorbitSdkError):
    """A success response did not match the caller-supplied Pydantic model."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int,
        issues: tuple[dict[str, object], ...] = (),
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.issues = issues


class ThorbitResultModelError(ThorbitSdkError):
    """The supplied result model cannot be used by Pydantic v2."""


def _optional_string(value: object) -> str | None:
    return value if isinstance(value, str) and value else None


def _http_error(response: httpx.Response, payload: object) -> ThorbitHttpError:
    code: str | None = None
    message: str | None = None
    request_id: str | None = None
    retryable: bool | None = None

    if isinstance(payload, Mapping):
        request_id = _optional_string(payload.get("requestId"))
        error = payload.get("error")
        if isinstance(error, Mapping):
            code = _optional_string(error.get("code"))
            message = _optional_string(error.get("message"))
            raw_retryable = error.get("retryable")
            retryable = raw_retryable if isinstance(raw_retryable, bool) else None
        else:
            message = _optional_string(payload.get("message"))
            code = _optional_string(error)

    return ThorbitHttpError(
        response.status_code,
        message or f"Thorbit API request failed with HTTP {response.status_code}",
        code=code,
        request_id=request_id,
        retryable=retryable,
    )


def _validation_issues(error: ValidationError) -> tuple[dict[str, object], ...]:
    return tuple(
        {
            "type": issue["type"],
            "location": tuple(issue["loc"]),
            "message": issue["msg"],
        }
        for issue in error.errors(include_url=False, include_input=False)
    )


class CallThorbitTools(ThorbitClientProtocol):
    """Call Thorbit MCP tools through the unified authenticated REST route."""

    def __init__(
        self,
        options: ThorbitClientOptions | Mapping[str, object],
        *,
        http_client: httpx.Client | None = None,
    ) -> None:
        self._options = (
            options
            if isinstance(options, ThorbitClientOptions)
            else ThorbitClientOptions.model_validate(options)
        )
        self._owns_http_client = http_client is None
        self._http_client = http_client or httpx.Client()
        self._base_url = str(self._options.base_url).rstrip("/")

    @property
    def options(self) -> ThorbitClientOptions:
        """Return the immutable, secret-redacting connection options."""
        return self._options

    def call_tool(
        self,
        tool_name: str,
        input: Mapping[str, object],
        result_model: type[TResult],
    ) -> TResult:
        """Call one tool and return a Pydantic-validated result."""
        if not isinstance(tool_name, str) or not tool_name.strip():
            raise ThorbitRequestValidationError("tool_name must not be empty")
        if not isinstance(input, Mapping):
            raise ThorbitRequestValidationError("input must be a mapping")
        if not isinstance(result_model, type):
            raise ThorbitResultModelError("result_model must be a type")

        encoded_tool_name = quote(tool_name, safe="")
        url = f"{self._base_url}{THORBIT_TOOL_ROUTE}/{encoded_tool_name}"
        headers = {
            "Accept": "application/vnd.thorbit.tool-result+json",
            "Content-Type": "application/json",
            "x-thorbit-api-key": self._options.api_key.get_secret_value(),
        }

        try:
            response = self._http_client.post(
                url,
                headers=headers,
                json=dict(input),
                timeout=self._options.timeout_seconds,
            )
        except httpx.TimeoutException as error:
            raise ThorbitTimeoutError(self._options.timeout_seconds) from error
        except httpx.HTTPError as error:
            raise ThorbitTransportError("Thorbit API network request failed") from error
        except (TypeError, ValueError, OverflowError) as error:
            raise ThorbitRequestValidationError(
                "Thorbit tool input could not be serialized as JSON"
            ) from error

        try:
            payload: object = response.json()
        except ValueError as error:
            if not response.is_success:
                raise _http_error(response, None) from error
            raise ThorbitResponseValidationError(
                "Thorbit API returned malformed JSON",
                status_code=response.status_code,
            ) from error

        if not response.is_success:
            raise _http_error(response, payload)

        try:
            adapter = TypeAdapter(result_model)
        except (PydanticUserError, TypeError) as error:
            raise ThorbitResultModelError(
                "result_model must define a Pydantic-compatible schema"
            ) from error

        try:
            return cast(TResult, adapter.validate_python(payload))
        except ValidationError as error:
            raise ThorbitResponseValidationError(
                "Thorbit API response failed result-model validation",
                status_code=response.status_code,
                issues=_validation_issues(error),
            ) from error

    def close(self) -> None:
        """Close the internally owned HTTP client, if any."""
        if self._owns_http_client:
            self._http_client.close()

    def __enter__(self) -> CallThorbitTools:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        self.close()


__all__ = [
    "CallThorbitTools",
    "ThorbitClientOptions",
    "ThorbitClientProtocol",
    "ThorbitHttpError",
    "ThorbitRequestValidationError",
    "ThorbitResponseValidationError",
    "ThorbitResultModelError",
    "ThorbitSdkError",
    "ThorbitTimeoutError",
    "ThorbitTransportError",
]
