import type { z } from 'zod'

export interface IThorbitClientTransport {
  callTool<TInput, TOutput>(
    toolName: string,
    input: TInput,
    outputSchema: z.ZodType<TOutput>,
  ): Promise<TOutput>
}
