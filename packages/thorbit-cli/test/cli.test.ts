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
})
