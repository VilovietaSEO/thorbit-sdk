import { z } from 'zod'

export const ThorbitClientOptionsSchema = z.object({
  apiKey: z.string().min(1),
  baseUrl: z.string().url().default('https://thorbit.ai'),
  timeoutMs: z.number().int().min(1000).max(300000).default(120000),
})

export type ThorbitClientOptionsInput = z.input<
  typeof ThorbitClientOptionsSchema
>

export type ThorbitClientOptions = z.infer<typeof ThorbitClientOptionsSchema>
