---
name: thorbit-admin
description: Use the private Thorbit Phoenix admin API through the thorbit CLI to find and help customers, inspect usage, manage billing and credits, operate workflows, and administer operator access.
---

# Thorbit Admin CLI

Use this skill only for authorized Thorbit operator work. The human operator
creates a personal key in **Thorbit Admin → Team access → Personal CLI access**
and exposes it locally as `THORBIT_ADMIN_API_KEY`. Never print, log, or paste the
key into a command argument when an environment variable is available.

## Start every session

```bash
thorbit admin whoami --output json
```

Stop if this does not return the expected operator identity and capabilities.

## Call the admin surface

```bash
thorbit admin request GET users/list/pii \
  --query-json '{"search":"person@example.com","limit":25}' \
  --output json
```

Paths are relative to `/api/admin`. Use exact public IDs returned by list/read
commands. Read before writing. Do not guess customer, operator, Stripe, workflow,
or invitation identifiers.

For writes, send the exact body required by the admin endpoint, including its
reason, confirmation, preview token, idempotency key, or approval evidence when
required. Never bypass a preview/confirm/execute flow. After a write, read the
same resource again and report the request ID and final state.

Common read paths:

- `GET users/list/pii` — find people and sign-in activity.
- `GET accounts/list/pii` — find customer accounts.
- `GET operators/list` — list operator access.
- `GET operations/runs` — inspect workflow runs.
- `GET audit/entries` — inspect change history.

Use `--query-json` for query fields and filters. Use `--body-json` for POST,
PUT, PATCH, and DELETE bodies. Prefer `--output json` for agent use.

The API applies the key owner's current Phoenix roles on every request. If a
role changes, permissions change immediately; if the operator or key is
revoked, access stops immediately.
