import unittest

import httpx
from pydantic import BaseModel, ConfigDict, ValidationError

from thorbit.client import CallThorbitTools
from thorbit.generated_tools import ThorbitAccountBillingGetPlanOutput


class Project(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str


class ProjectList(BaseModel):
    model_config = ConfigDict(extra="forbid")

    projects: list[Project]


class StructuredProjectList(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool
    toolName: str
    requestId: str
    result: ProjectList
    next: list[object]
    warnings: list[str]


class ThorbitPythonTransportTest(unittest.TestCase):
    def test_requests_and_accepts_structured_tool_results(self) -> None:
        captured_accept = None

        def handle(request: httpx.Request) -> httpx.Response:
            nonlocal captured_accept
            captured_accept = request.headers.get("accept")
            return httpx.Response(
                200,
                json={
                    "ok": True,
                    "toolName": "thorbit_account_projects_list",
                    "requestId": "request_python_sdk_1",
                    "result": {"projects": [{"name": "Example project"}]},
                    "next": [],
                    "warnings": [],
                },
            )

        with httpx.Client(transport=httpx.MockTransport(handle)) as http_client:
            client = CallThorbitTools(
                {"api_key": "thbt_mcp_test_key"},
                http_client=http_client,
            )
            result = client.call_tool(
                "thorbit_account_projects_list",
                {},
                StructuredProjectList,
            )

        self.assertEqual(result.toolName, "thorbit_account_projects_list")
        self.assertEqual(
            captured_accept,
            "application/vnd.thorbit.tool-result+json",
        )

    def test_generated_billing_schema_enforces_property_names(self) -> None:
        output = {
            "ok": True,
            "toolName": "thorbit_account_billing_get_plan",
            "requestId": "request_billing_1",
            "result": {
                "planId": "growth",
                "planName": "Growth",
                "status": "active",
                "renewsAt": None,
                "limits": {"projects": 25},
                "usage": {"projects": 4},
            },
            "next": [],
        }

        ThorbitAccountBillingGetPlanOutput.model_validate(output)
        for invalid_name in ("", "x" * 81):
            invalid_output = {
                **output,
                "result": {
                    **output["result"],
                    "limits": {invalid_name: 25},
                },
            }
            with self.assertRaises(ValidationError):
                ThorbitAccountBillingGetPlanOutput.model_validate(invalid_output)


if __name__ == "__main__":
    unittest.main()
