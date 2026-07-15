import {
  ThorbitGeneratedToolNameSchema,
  type ThorbitGeneratedToolName,
} from "thorbit-sdk";
import { z } from "zod";

export const ThorbitCliOutputFormatSchema = z.enum(["json", "text"]);

const ThorbitCliBaseUrlSchema = z
  .string()
  .url()
  .default("https://thorbit.ai")
  .superRefine((value, context) => {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      return;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "base URL must use http or https",
      });
    }
    if (parsed.username || parsed.password) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "base URL must not contain credentials",
      });
    }
    if (parsed.search || parsed.hash) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "base URL must not contain a query or fragment",
      });
    }
  });

const ThorbitCliRawInvocationSchema = z
  .object({
    toolName: ThorbitGeneratedToolNameSchema,
    inputJson: z.string().default("{}"),
    apiKey: z.string().optional(),
    environmentApiKey: z.string().optional(),
    baseUrl: ThorbitCliBaseUrlSchema,
    timeoutMs: z.coerce.number().int().min(1_000).max(300_000).default(120_000),
    output: ThorbitCliOutputFormatSchema.default("text"),
  })
  .strict();

export const ThorbitCliInvocationSchema =
  ThorbitCliRawInvocationSchema.transform((value, context) => {
    let invalid = false;
    let input: Record<string, unknown> | undefined;

    try {
      const parsedInput: unknown = JSON.parse(value.inputJson);
      if (
        typeof parsedInput !== "object" ||
        parsedInput === null ||
        Array.isArray(parsedInput)
      ) {
        invalid = true;
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["inputJson"],
          message: "--input-json must decode to a JSON object",
        });
      } else {
        input = parsedInput as Record<string, unknown>;
      }
    } catch {
      invalid = true;
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["inputJson"],
        message: "--input-json must be valid JSON",
      });
    }

    const apiKey = (value.apiKey ?? value.environmentApiKey)?.trim();
    if (!apiKey) {
      invalid = true;
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["apiKey"],
        message: "Missing API key; pass --api-key or set THORBIT_API_KEY",
      });
    }

    if (invalid || input === undefined || apiKey === undefined) {
      return z.NEVER;
    }

    return {
      toolName: value.toolName,
      input,
      apiKey,
      baseUrl: value.baseUrl,
      timeoutMs: value.timeoutMs,
      output: value.output,
    };
  });

export type ThorbitCliInvocationInput = z.input<
  typeof ThorbitCliInvocationSchema
>;

export type ThorbitCliInvocation = z.infer<typeof ThorbitCliInvocationSchema>;

export type ThorbitCliToolName = ThorbitGeneratedToolName;
