import type { z } from 'zod'

import type { IThorbitClientTransport } from './IThorbitClientTransport'
import {
  ThorbitClientOptionsSchema,
  type ThorbitClientOptions,
  type ThorbitClientOptionsInput,
} from './thorbit-client-schema'

const THORBIT_TOOL_ROUTE = '/api/v1/mcp/thorbit'

export class ThorbitSdkError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = new.target.name
  }
}

export class ThorbitRequestValidationError extends ThorbitSdkError {}

export class ThorbitTransportError extends ThorbitSdkError {}

export class ThorbitTimeoutError extends ThorbitTransportError {
  readonly timeoutMs: number

  constructor(timeoutMs: number, options?: ErrorOptions) {
    super(`Thorbit API request timed out after ${timeoutMs} milliseconds`, options)
    this.timeoutMs = timeoutMs
  }
}

export interface ThorbitHttpErrorDetails {
  readonly statusCode: number
  readonly code?: string
  readonly requestId?: string
  readonly retryable?: boolean
}

export class ThorbitHttpError extends ThorbitSdkError {
  readonly statusCode: number
  readonly code?: string
  readonly requestId?: string
  readonly retryable?: boolean

  constructor(message: string, details: ThorbitHttpErrorDetails) {
    super(message)
    this.statusCode = details.statusCode
    this.code = details.code
    this.requestId = details.requestId
    this.retryable = details.retryable
  }
}

export class ThorbitResponseValidationError extends ThorbitSdkError {
  readonly statusCode: number
  readonly issues: readonly z.ZodIssue[]

  constructor(
    message: string,
    details: {
      readonly statusCode: number
      readonly issues?: readonly z.ZodIssue[]
    },
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.statusCode = details.statusCode
    this.issues = details.issues ?? []
  }
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function httpError(response: Response, payload: unknown): ThorbitHttpError {
  const envelope = recordValue(payload)
  const error = recordValue(envelope?.error)
  const retryable = error?.retryable
  return new ThorbitHttpError(
    optionalString(error?.message) ??
      optionalString(envelope?.message) ??
      `Thorbit API request failed with HTTP ${response.status}`,
    {
      statusCode: response.status,
      code: optionalString(error?.code),
      requestId: optionalString(envelope?.requestId),
      retryable: typeof retryable === 'boolean' ? retryable : undefined,
    },
  )
}

function materializeBaseUrl(options: ThorbitClientOptions): string {
  const baseUrl = new URL(options.baseUrl)
  if (baseUrl.username || baseUrl.password) {
    throw new ThorbitRequestValidationError(
      'Thorbit baseUrl must not contain credentials',
    )
  }
  if (baseUrl.search || baseUrl.hash) {
    throw new ThorbitRequestValidationError(
      'Thorbit baseUrl must not contain a query or fragment',
    )
  }
  return baseUrl.toString().replace(/\/+$/, '')
}

export class SendThorbitHttpToolCall implements IThorbitClientTransport {
  readonly #apiKey: string
  readonly #baseUrl: string
  readonly #timeoutMs: number
  readonly #fetch: typeof globalThis.fetch

  constructor(
    options: ThorbitClientOptionsInput,
    fetchImplementation: typeof globalThis.fetch = globalThis.fetch,
  ) {
    const parsedOptions = ThorbitClientOptionsSchema.parse(options)
    if (!parsedOptions.apiKey.trim()) {
      throw new ThorbitRequestValidationError('Thorbit apiKey must not be empty')
    }
    this.#apiKey = parsedOptions.apiKey
    this.#baseUrl = materializeBaseUrl(parsedOptions)
    this.#timeoutMs = parsedOptions.timeoutMs
    this.#fetch = fetchImplementation
  }

  async callTool<TInput, TOutput>(
    toolName: string,
    input: TInput,
    outputSchema: z.ZodType<TOutput>,
  ): Promise<TOutput> {
    if (typeof toolName !== 'string' || !toolName.trim()) {
      throw new ThorbitRequestValidationError('toolName must not be empty')
    }

    let encodedToolName: string
    let requestBody: string | undefined
    try {
      encodedToolName = encodeURIComponent(toolName)
      requestBody = JSON.stringify(input)
    } catch (error) {
      throw new ThorbitRequestValidationError(
        'Thorbit tool input could not be serialized as JSON',
        { cause: error },
      )
    }
    if (requestBody === undefined) {
      throw new ThorbitRequestValidationError(
        'Thorbit tool input could not be serialized as JSON',
      )
    }

    const abortController = new AbortController()
    const timeout = setTimeout(() => abortController.abort(), this.#timeoutMs)

    try {
      const response = await this.#fetch(
        `${this.#baseUrl}${THORBIT_TOOL_ROUTE}/${encodedToolName}`,
        {
          method: 'POST',
          headers: {
            accept: 'application/vnd.thorbit.tool-result+json',
            'content-type': 'application/json',
            'x-thorbit-api-key': this.#apiKey,
          },
          body: requestBody,
          signal: abortController.signal,
        },
      )

      let payload: unknown
      try {
        payload = await response.json()
      } catch (error) {
        if (!response.ok) {
          throw httpError(response, undefined)
        }
        throw new ThorbitResponseValidationError(
          'Thorbit API returned malformed JSON',
          { statusCode: response.status },
          { cause: error },
        )
      }

      if (!response.ok) {
        throw httpError(response, payload)
      }

      const parsedOutput = outputSchema.safeParse(payload)
      if (!parsedOutput.success) {
        throw new ThorbitResponseValidationError(
          'Thorbit API response failed output-schema validation',
          {
            statusCode: response.status,
            issues: parsedOutput.error.issues,
          },
        )
      }
      return parsedOutput.data
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new ThorbitTimeoutError(this.#timeoutMs, { cause: error })
      }
      if (error instanceof ThorbitSdkError) throw error
      throw new ThorbitTransportError('Thorbit API network request failed', {
        cause: error,
      })
    } finally {
      clearTimeout(timeout)
    }
  }
}
