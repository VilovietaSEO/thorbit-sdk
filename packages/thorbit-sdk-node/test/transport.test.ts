import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { SendThorbitHttpToolCall } from '../src/SendThorbitHttpToolCall'
import { THORBIT_ACCOUNT_BILLING_GET_PLAN_OUTPUT_SCHEMA } from '../src/index'

const outputSchema = z
  .object({
    ok: z.literal(true),
    toolName: z.literal('thorbit_account_projects_list'),
    requestId: z.string(),
    result: z.object({ projects: z.array(z.object({ name: z.string() })) }),
    next: z.array(z.unknown()),
    warnings: z.array(z.string()),
  })
  .strict()

describe('SendThorbitHttpToolCall', () => {
  it('requests and accepts the exact structured tool-result contract', async () => {
    const fetchImplementation = vi.fn(async () => Response.json({
      ok: true,
      toolName: 'thorbit_account_projects_list',
      requestId: 'request_sdk_1',
      result: { projects: [{ name: 'Example project' }] },
      next: [],
      warnings: [],
    })) as unknown as typeof fetch
    const transport = new SendThorbitHttpToolCall(
      {
        apiKey: 'thbt_mcp_test_key',
        baseUrl: 'https://thorbit.ai',
      },
      fetchImplementation,
    )

    const result = await transport.callTool(
      'thorbit_account_projects_list',
      {},
      outputSchema,
    )

    expect(result.toolName).toBe('thorbit_account_projects_list')
    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://thorbit.ai/api/v1/mcp/thorbit/thorbit_account_projects_list',
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: 'application/vnd.thorbit.tool-result+json',
        }),
      }),
    )
  })
})

describe('generated Account billing schema', () => {
  const output = {
    ok: true,
    toolName: 'thorbit_account_billing_get_plan',
    requestId: 'request_billing_1',
    result: {
      planId: 'growth',
      planName: 'Growth',
      status: 'active',
      renewsAt: null,
      limits: { projects: 25 },
      usage: { projects: 4 },
    },
    next: [],
  }

  it('enforces JSON Schema propertyNames constraints', () => {
    expect(
      THORBIT_ACCOUNT_BILLING_GET_PLAN_OUTPUT_SCHEMA.safeParse(output).success,
    ).toBe(true)
    expect(
      THORBIT_ACCOUNT_BILLING_GET_PLAN_OUTPUT_SCHEMA.safeParse({
        ...output,
        result: { ...output.result, limits: { '': 25 } },
      }).success,
    ).toBe(false)
    expect(
      THORBIT_ACCOUNT_BILLING_GET_PLAN_OUTPUT_SCHEMA.safeParse({
        ...output,
        result: { ...output.result, usage: { ['x'.repeat(81)]: 4 } },
      }).success,
    ).toBe(false)
  })
})
