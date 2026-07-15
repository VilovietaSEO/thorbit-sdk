import type { z } from 'zod'

import type {
  GeneratedThorbitToolMethods,
  ThorbitGeneratedToolName,
} from './generated-thorbit-tools'

export interface IThorbitClient extends GeneratedThorbitToolMethods {
  callTool<TInput, TOutput>(
    toolName: ThorbitGeneratedToolName,
    input: TInput,
    outputSchema: z.ZodType<TOutput>,
  ): Promise<TOutput>
}
