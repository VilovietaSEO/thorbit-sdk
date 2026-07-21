# Thorbit Node.js SDK

Typed Node.js client for the unified Thorbit API. The generated surface includes one method, input schema, output schema, and TypeScript type set for each of the 79 Thorbit tools.

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

Inputs and successful responses are validated against generated Zod schemas. Catch the exported stable error classes for validation, HTTP, timeout, response, and transport failures.

Source and the generated contract are public at [VilovietaSEO/thorbit-sdk](https://github.com/VilovietaSEO/thorbit-sdk).

## License

MIT
