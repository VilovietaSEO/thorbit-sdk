import type { z } from 'zod'

import type { IThorbitClient } from './IThorbitClient'
import type { IThorbitClientTransport } from './IThorbitClientTransport'
import {
  GeneratedCallThorbitTools,
  type ThorbitGeneratedToolName,
} from './generated-thorbit-tools'
import { SendThorbitHttpToolCall } from './SendThorbitHttpToolCall'
import type { ThorbitClientOptionsInput } from './thorbit-client-schema'

function isThorbitClientTransport(
  value: ThorbitClientOptionsInput | IThorbitClientTransport,
): value is IThorbitClientTransport {
  return typeof (value as Partial<IThorbitClientTransport>).callTool === 'function'
}

export class CallThorbitTools
  extends GeneratedCallThorbitTools
  implements IThorbitClient
{
  readonly #transport: IThorbitClientTransport

  constructor(optionsOrTransport: ThorbitClientOptionsInput | IThorbitClientTransport) {
    super()
    this.#transport = isThorbitClientTransport(optionsOrTransport)
      ? optionsOrTransport
      : new SendThorbitHttpToolCall(optionsOrTransport)
  }

  callTool<TInput, TOutput>(
    toolName: ThorbitGeneratedToolName,
    input: TInput,
    outputSchema: z.ZodType<TOutput>,
  ): Promise<TOutput> {
    return this.#transport.callTool(toolName, input, outputSchema)
  }
}
