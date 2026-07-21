import type { IThorbitClient } from 'thorbit-sdk'
import { describe, expect, it } from 'vitest'

import { THORBIT_CLI_VERSION, runThorbitCli } from '../src/index'
import { ThorbitCliInvocationSchema } from '../src/thorbit-cli-schema'

describe('ThorbitCliInvocationSchema', () => {
  it('validates an exact generated tool invocation', () => {
    const invocation = ThorbitCliInvocationSchema.parse({
      toolName: 'thorbit_account_credits_get_balance',
      inputJson: '{}',
      environmentApiKey: '  test-key  ',
      baseUrl: 'https://thorbit.ai',
      timeoutMs: 120_000,
      output: 'json',
    })

    expect(invocation.apiKey).toBe('test-key')
    expect(invocation.input).toEqual({})
  })

  it('rejects input JSON that is not an object', () => {
    const parsed = ThorbitCliInvocationSchema.safeParse({
      toolName: 'thorbit_account_credits_get_balance',
      inputJson: '[]',
      environmentApiKey: 'test-key',
      baseUrl: 'https://thorbit.ai',
      timeoutMs: 120_000,
      output: 'json',
    })

    expect(parsed.success).toBe(false)
  })
})

describe('runThorbitCli', () => {
  it('reports the package version', async () => {
    const stdout: string[] = []
    const exitCode = await runThorbitCli({
      argv: ['node', 'thorbit', '--version'],
      env: {},
      stdout: (text) => stdout.push(text),
      stderr: () => undefined,
    })

    expect(exitCode).toBe(0)
    expect(stdout.join('').trim()).toBe(THORBIT_CLI_VERSION)
  })

  it('executes a generated command and prints structured JSON', async () => {
    const stdout: string[] = []
    const stderr: string[] = []
    const client = {
      async callTool() {
        return {
          ok: true,
          toolName: 'thorbit_account_credits_get_balance',
          requestId: 'req_test',
          result: {
            available: 98_000,
            reserved: 0,
            currency: 'credits',
            updatedAt: '2026-07-15T00:00:00.000Z',
          },
          next: [],
          warnings: [],
        } as never
      },
    } as unknown as IThorbitClient

    const exitCode = await runThorbitCli({
      argv: [
        'node',
        'thorbit',
        'thorbit-account-credits-get-balance',
        '--input-json',
        '{}',
        '--output',
        'json',
      ],
      env: { THORBIT_API_KEY: 'test-key' },
      client,
      stdout: (text) => stdout.push(text),
      stderr: (text) => stderr.push(text),
    })

    expect(exitCode).toBe(0)
    expect(stderr).toEqual([])
    expect(JSON.parse(stdout.join(''))).toMatchObject({
      ok: true,
      requestId: 'req_test',
      result: { available: 98_000 },
    })
  })

  it('redacts the API key from unexpected errors', async () => {
    const stderr: string[] = []
    const client = {
      async callTool() {
        throw new Error('request failed with secret-key')
      },
    } as unknown as IThorbitClient

    const exitCode = await runThorbitCli({
      argv: [
        'node',
        'thorbit',
        'thorbit-account-credits-get-balance',
        '--input-json',
        '{}',
      ],
      env: { THORBIT_API_KEY: 'secret-key' },
      client,
      stdout: () => undefined,
      stderr: (text) => stderr.push(text),
    })

    expect(exitCode).toBe(1)
    expect(stderr.join('')).toContain('[REDACTED]')
    expect(stderr.join('')).not.toContain('secret-key')
  })

  it('calls the private admin capability root with a personal operator key', async () => {
    const stdout: string[] = []
    const requests: Array<{ url: string; authorization: string | null }> = []
    const exitCode = await runThorbitCli({
      argv: ['node', 'thorbit', 'admin', 'whoami', '--output', 'json'],
      env: { THORBIT_ADMIN_API_KEY: 'thbt_op_abc123def456_test-secret-value-1234567890' },
      fetch: async (input, init) => {
        requests.push({
          url: String(input),
          authorization: new Headers(init?.headers).get('authorization'),
        })
        return Response.json({
          operator: {
            displayName: 'Admin User',
            roles: ['administrator'],
          },
          capabilities: ['manage_operators'],
        })
      },
      stdout: (text) => stdout.push(text),
      stderr: () => undefined,
    })

    expect(exitCode).toBe(0)
    expect(requests).toEqual([
      {
        url: 'https://thorbit.ai/api/admin',
        authorization:
          'Bearer thbt_op_abc123def456_test-secret-value-1234567890',
      },
    ])
    expect(JSON.parse(stdout.join(''))).toMatchObject({
      operator: { roles: ['administrator'] },
    })
  })

  it('passes structured query input to an exact admin path', async () => {
    let requestedUrl = ''
    const exitCode = await runThorbitCli({
      argv: [
        'node',
        'thorbit',
        'admin',
        'request',
        'GET',
        'users/list/pii',
        '--query-json',
        '{"search":"brian@example.com","limit":25}',
        '--output',
        'json',
      ],
      env: { THORBIT_ADMIN_API_KEY: 'operator-key' },
      fetch: async (input) => {
        requestedUrl = String(input)
        return Response.json({ page: { items: [] } })
      },
      stdout: () => undefined,
      stderr: () => undefined,
    })

    expect(exitCode).toBe(0)
    expect(requestedUrl).toBe(
      'https://thorbit.ai/api/admin/users/list/pii?search=brian%40example.com&limit=25',
    )
  })

  it('refuses admin requests outside the private admin route', async () => {
    const stderr: string[] = []
    const exitCode = await runThorbitCli({
      argv: [
        'node',
        'thorbit',
        'admin',
        'request',
        'GET',
        'https://example.com/secrets',
      ],
      env: { THORBIT_ADMIN_API_KEY: 'operator-key' },
      fetch: async () => {
        throw new Error('fetch must not run')
      },
      stdout: () => undefined,
      stderr: (text) => stderr.push(text),
    })

    expect(exitCode).toBe(1)
    expect(stderr.join('')).toContain('limited to /api/admin')
  })
})
