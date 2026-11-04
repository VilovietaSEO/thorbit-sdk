# Thorbit Node.js SDK

Typed Node.js client for the unified Thorbit API. The generated surface includes one method, input schema, output schema, and TypeScript type set for each of the 148 Thorbit tools.

## Install

```bash
npm install thorbit-sdk
```

Node.js 20 or newer is required.

## Use

```ts
import { CallThorbitTools } from "thorbit-sdk";

const thorbit = new CallThorbitTools({
  apiKey: process.env.THORBIT_API_KEY!,
});

const response = await thorbit.thorbitAccountProjectsList({ limit: 25 });

if (response.ok) {
  console.log(response.result?.projects);
} else {
  console.error(response.error?.code, response.error?.message);
}
```

Purposeful Images uses a plan-then-produce flow:

```ts
const article = "A complete article to analyze for useful image opportunities.";
const board = await thorbit.thorbitImagesStart({
  sourceText: article,
  mode: "opportunity_board_only",
});

const run = await thorbit.thorbitImagesGet({
  runPublicId: board.result!.runPublicId,
});
```

Inputs and successful responses are validated against generated Zod schemas. Catch the exported stable error classes for validation, HTTP, timeout, response, and transport failures.

Source and the generated contract are public at [VilovietaSEO/thorbit-sdk](https://github.com/VilovietaSEO/thorbit-sdk).

## License

MIT

## Release 0.11.0

Bindings cover the current 148-tool Thorbit contract. Node SDK and CLI schemas require Zod 4; Python retains Pydantic 2. Existing per-tool batch limits are preserved. Standard Node requests use the MCP SDK's existing 10 MiB transport allowance, and hosted providers may impose a lower body limit. See the [package changelog](https://github.com/VilovietaSEO/thorbit-sdk/blob/main/packages/thorbit-sdk-node/CHANGELOG.md) and [migration notes](https://github.com/VilovietaSEO/thorbit-sdk/blob/main/docs/zod4-migration.md).
