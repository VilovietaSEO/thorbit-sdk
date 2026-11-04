# Zod 4 migration and request capacity

All Thorbit MCP packages now use Zod 4.6.7 or later and MCP SDK 1.32.2 or later. Consumers that import exported schemas must upgrade to Zod 4. Shared core no longer subclasses Zod 3 parser internals. Python continues to use Pydantic 2.

## Capacity evidence and decisions

| Boundary | Evidence | Release behavior |
| --- | --- | --- |
| Standard stdio | MCP SDK `shared/stdio` defines a 10 MiB default frame budget. | Retain 10 MiB and enforce it before the SDK's JSON/Zod parser. HTTP requests use the same ceiling; existing hosting-provider limits still apply. |
| Local WordPress IndexNow | Native operation allows 10,000 URLs, each up to 2,048 characters. Worst-case JSON string encoding uses six bytes per UTF-16 code unit: 122,880,000 bytes plus envelope. | Local WordPress uses 128 MiB, the next binary allocation above that supported payload. The SDK receives the same configured allowance. |
| Native document depth | PHP `json_decode` defaults to depth 512. | Guard excessive nesting at 512, before recursive tool validation. Capacity tests cover 500 nested levels and request envelopes. |
| Container width and nodes | Every JSON value requires at least one byte; array entries require at least two, and object members at least five. | Derive structural ceilings from the byte budget. Do not introduce separate 10,000-item, 1,000-key or 50,000-node business caps. |
| Existing tool limits | Knowledge Graph allows 500 supplied pages and 200 emitted pages; local IndexNow permits 10,000 URLs; native JSON-LD permits 1 MiB. | Preserve existing schema maxima. Test all 500 supplied pages, all 10,000 maximum-length URLs and a 100,000-element JSON-LD document. |
| Input object handling | Existing registrars mix strict schemas and stripping raw shapes. | Preserve those semantics. Zod 4's generated input JSON Schema may omit `additionalProperties: false` for stripping objects. Do not turn stripping into rejection. |
| Canonical JSON and responses | Canonical JSON is used for results as well as inputs. | Keep request budgets at request boundaries; do not apply new response-size or generic JSON business limits. |

The structural walk is iterative with one frame per nesting level, so wide arrays do not allocate one traversal frame per element. Growable byte buffers also avoid one buffered allocation per tiny incoming fragment. Accessors and serialization hooks are refused without execution.

Malformed and excessive HTTP bodies receive HTTP 400 before tool dispatch. Malformed specialist JSON no longer becomes an empty object, since that could accidentally invoke a default operation. Oversized or structurally excessive stdio frames close the transport; reconnect with a smaller request. No request is truncated or silently rewritten.

The [Zod fix](https://github.com/colinhacks/zod/pull/6652) rejects oversized bounded collections before element parsing. Unbounded collections are unchanged upstream. The byte/depth boundary and canonical JSON implementation complement that fix; this is not a claim that every denial-of-service risk is eliminated. Previously unbounded payloads are now finite at the request boundary, and arbitrary workloads outside the tested native contracts are not claimed to be qualified.

The depth rationale follows [PHP's documented default](https://www.php.net/manual/en/function.json-decode.php). Zod 4 public schema imports are a consumer migration. Agency Bridge remains 2.0.4, and parked skills stay inactive.
