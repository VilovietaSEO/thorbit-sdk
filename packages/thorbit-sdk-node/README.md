# Thorbit Node.js SDK

Typed Node.js client for the unified Thorbit API. The generated surface includes one method, input schema, output schema, and TypeScript type set for each of the 79 Thorbit tools.

## Registry install (after publication)

The npm package is not published yet. Clone the public repository and use the
Development commands below today.

```bash
npm install thorbit-sdk
```

Node.js 20 or newer is required.

## Use

```ts
import { CallThorbitTools } from "thorbit-sdk";

const thorbit = new CallThorbitTools({
  apiKey: process.env.THORBIT_API_KEY!,
  // baseUrl: "https://thorbit.ai",
  // timeoutMs: 120_000,
});

const response = await thorbit.thorbitAccountProjectsList({ limit: 25 });

if (response.ok) {
  console.log(response.result?.projects);
} else {
  console.error(response.error?.code, response.error?.message);
}
```

You can also call a generated tool name through `callTool` when dynamically selecting operations. Inputs and successful responses are validated against generated Zod schemas.

## Authentication

Pass the API key as `apiKey`. The SDK sends it only to the configured Thorbit base URL and requests the structured Thorbit result media type. Do not commit keys or place credentials in the base URL.

## Errors

Catch the exported stable error classes:

- `ThorbitRequestValidationError`
- `ThorbitHttpError`
- `ThorbitResponseValidationError`
- `ThorbitTimeoutError`
- `ThorbitTransportError`

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

## License

MIT
