import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import packageManifest from "../package.json";

import { Command, CommanderError } from "commander";
import {
  CallThorbitTools,
  THORBIT_GENERATED_TOOLS,
  ThorbitHttpError,
  ThorbitRequestValidationError,
  ThorbitResponseValidationError,
  ThorbitSdkError,
  ThorbitTransportError,
  type IThorbitClient,
  type ThorbitClientOptionsInput,
  type ThorbitGeneratedToolName,
} from "thorbit-sdk";
import { z } from "zod";

import {
  THORBIT_GENERATED_COMMANDS,
  type ThorbitGeneratedCliCommand,
} from "./generated-thorbit-commands";
import {
  ThorbitCliInvocationSchema,
  type ThorbitCliInvocationInput,
} from "./thorbit-cli-schema";

const THORBIT_DEFAULT_BASE_URL = "https://thorbit.ai";
const THORBIT_DEFAULT_TIMEOUT_MS = 120_000;
export const THORBIT_CLI_VERSION = packageManifest.version;

interface ThorbitCliToolRuntime {
  readonly name: ThorbitGeneratedToolName;
  readonly inputSchema: z.ZodType<Record<string, unknown>>;
  readonly outputSchema: z.ZodType<unknown>;
}

class ThorbitCliResultError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "ThorbitCliResultError";
    this.code = code;
  }
}

const THORBIT_CLI_TOOL_RUNTIME_BY_NAME = new Map<
  ThorbitGeneratedToolName,
  ThorbitCliToolRuntime
>(
  THORBIT_GENERATED_TOOLS.map(
    (tool): readonly [ThorbitGeneratedToolName, ThorbitCliToolRuntime] => [
      tool.name as ThorbitGeneratedToolName,
      {
        name: tool.name as ThorbitGeneratedToolName,
        inputSchema: tool.inputSchema as unknown as z.ZodType<
          Record<string, unknown>
        >,
        outputSchema: tool.outputSchema as unknown as z.ZodType<unknown>,
      },
    ],
  ),
);

export interface CallThorbitCliDependencies {
  readonly client?: IThorbitClient;
  readonly createClient?: (
    options: ThorbitClientOptionsInput,
  ) => IThorbitClient;
}

export async function call(
  rawInvocation: ThorbitCliInvocationInput,
  dependencies: CallThorbitCliDependencies = {},
): Promise<unknown> {
  const invocation = ThorbitCliInvocationSchema.parse(rawInvocation);
  const runtime = THORBIT_CLI_TOOL_RUNTIME_BY_NAME.get(invocation.toolName);
  if (!runtime) {
    throw new Error(
      "Generated Thorbit CLI runtime is missing the selected tool",
    );
  }

  const validatedInput = runtime.inputSchema.parse(invocation.input);
  const client =
    dependencies.client ??
    dependencies.createClient?.({
      apiKey: invocation.apiKey,
      baseUrl: invocation.baseUrl,
      timeoutMs: invocation.timeoutMs,
    }) ??
    new CallThorbitTools({
      apiKey: invocation.apiKey,
      baseUrl: invocation.baseUrl,
      timeoutMs: invocation.timeoutMs,
    });

  return client.callTool(
    invocation.toolName,
    validatedInput,
    runtime.outputSchema,
  );
}

interface ThorbitCliOptionValues {
  readonly inputJson: string;
  readonly apiKey?: string;
  readonly adminApiKey?: string;
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly output: string;
}

export interface RunThorbitCliDependencies extends CallThorbitCliDependencies {
  readonly argv?: readonly string[];
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly fetch?: typeof fetch;
  readonly stdout?: (text: string) => void;
  readonly stderr?: (text: string) => void;
}

interface ThorbitCliContext extends CallThorbitCliDependencies {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly fetch: typeof fetch;
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

const THORBIT_ADMIN_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

type ThorbitAdminMethod = (typeof THORBIT_ADMIN_METHODS)[number];

class ThorbitAdminHttpError extends Error {
  readonly statusCode: number;
  readonly code?: string;

  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.name = "ThorbitAdminHttpError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function jsonObject(raw: string, label: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${label} must be valid JSON`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${label} must be one JSON object`);
  }
  return parsed as Record<string, unknown>;
}

function adminUrl(baseUrl: string, pathInput: string): URL {
  const base = new URL(baseUrl);
  const trimmed = pathInput.trim();
  if (
    !trimmed ||
    trimmed.includes("?") ||
    trimmed.includes("#") ||
    trimmed.includes("\\") ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(trimmed) ||
    trimmed.split("/").includes("..")
  ) {
    throw new Error("Admin requests are limited to /api/admin paths");
  }
  const pathname = trimmed.startsWith("/api/admin")
    ? trimmed
    : `/api/admin/${trimmed.replace(/^\/+/, "")}`;
  const url = new URL(pathname, base);
  if (
    url.origin !== base.origin ||
    (url.pathname !== "/api/admin" && !url.pathname.startsWith("/api/admin/"))
  ) {
    throw new Error("Admin requests are limited to /api/admin");
  }
  return url;
}

function addAdminQuery(url: URL, query: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(
      key,
      typeof value === "string" ? value : JSON.stringify(value),
    );
  }
}

function adminCredential(
  options: ThorbitCliOptionValues,
  env: Readonly<Record<string, string | undefined>>,
): string {
  const credential = options.adminApiKey?.trim() || env.THORBIT_ADMIN_API_KEY?.trim();
  if (!credential) {
    throw new ThorbitCliResultError(
      "Missing admin API key; pass --admin-api-key or set THORBIT_ADMIN_API_KEY",
      "unauthorized",
    );
  }
  return credential;
}

async function callAdmin(
  input: {
    method: ThorbitAdminMethod;
    path: string;
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
    options: ThorbitCliOptionValues;
  },
  context: ThorbitCliContext,
): Promise<unknown> {
  const url = adminUrl(input.options.baseUrl, input.path);
  addAdminQuery(url, input.query ?? {});
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.options.timeoutMs);
  try {
    const response = await context.fetch(url, {
      method: input.method,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${adminCredential(input.options, context.env)}`,
        ...(input.body ? { "content-type": "application/json" } : {}),
      },
      body: input.body ? JSON.stringify(input.body) : undefined,
      signal: controller.signal,
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const envelope = recordValue(payload);
      throw new ThorbitAdminHttpError(
        response.status,
        typeof envelope?.message === "string"
          ? envelope.message
          : `Admin request failed with HTTP ${response.status}`,
        typeof envelope?.code === "string" ? envelope.code : undefined,
      );
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function commandHelp(command: ThorbitGeneratedCliCommand): string {
  const required =
    command.requiredInputFields.length > 0
      ? command.requiredInputFields.join(", ")
      : "none";
  const defaults =
    Object.keys(command.inputDefaults).length > 0
      ? JSON.stringify(command.inputDefaults)
      : "none";
  const caps =
    Object.keys(command.inputCaps).length > 0
      ? JSON.stringify(command.inputCaps)
      : "none";
  const sideEffects =
    command.sideEffects.length > 0 ? command.sideEffects.join(" ") : "none";
  const nextLabel = command.resultMode === "async" ? "Async next" : "Next";
  const next =
    command.nextTools.length > 0 ? command.nextTools.join(", ") : "none";

  return [
    "",
    `Product: ${command.productId}`,
    `MCP tool: ${command.toolName}`,
    `Description: ${command.description}`,
    `Required input fields: ${required}`,
    `Defaults: ${defaults}`,
    `Caps: ${caps}`,
    `Required scopes: ${command.requiredScopes.join(", ")}`,
    `Cost: ${command.costSummary}`,
    `Side effects: ${sideEffects}`,
    `Result mode: ${command.resultMode}`,
    `${nextLabel}: ${next}`,
    "",
  ].join("\n");
}

function commandOptions(command: Command): Command {
  return command.option(
    "--input-json <json>",
    "tool input as one non-null JSON object",
    "{}",
  );
}

function invocationInput(
  toolName: string,
  options: ThorbitCliOptionValues,
  environmentApiKey: string | undefined,
): ThorbitCliInvocationInput {
  return {
    toolName: toolName as ThorbitGeneratedToolName,
    inputJson: options.inputJson,
    apiKey: options.apiKey,
    environmentApiKey,
    baseUrl: options.baseUrl,
    timeoutMs: options.timeoutMs,
    output: options.output as "json" | "text",
  };
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function compactJson(value: unknown): string {
  const serialized = JSON.stringify(value);
  return serialized === undefined ? "null" : serialized;
}

function textOutput(result: unknown): string {
  const envelope = recordValue(result);
  if (!envelope) return compactJson(result);

  const lines: string[] = [];
  if (typeof envelope.ok === "boolean") {
    lines.push(`Status: ${envelope.ok ? "ok" : "error"}`);
  }
  if (typeof envelope.toolName === "string") {
    lines.push(`Tool: ${envelope.toolName}`);
  }
  if (typeof envelope.requestId === "string") {
    lines.push(`Request: ${envelope.requestId}`);
  }
  if (typeof envelope.summary === "string") {
    lines.push(`Summary: ${envelope.summary}`);
  }
  if (envelope.result !== undefined) {
    lines.push(`Result: ${compactJson(envelope.result)}`);
  }

  const error = recordValue(envelope.error);
  if (error) {
    const code = typeof error.code === "string" ? ` [${error.code}]` : "";
    const message =
      typeof error.message === "string" ? error.message : "Thorbit tool failed";
    lines.push(`Error${code}: ${message}`);
  }

  if (Array.isArray(envelope.next) && envelope.next.length > 0) {
    lines.push("Next:");
    for (const item of envelope.next) {
      const next = recordValue(item);
      if (!next || typeof next.toolName !== "string") continue;
      const reason = typeof next.reason === "string" ? ` — ${next.reason}` : "";
      lines.push(`- ${next.toolName}${reason}`);
    }
  }
  if (Array.isArray(envelope.warnings) && envelope.warnings.length > 0) {
    lines.push(`Warnings: ${envelope.warnings.map(String).join("; ")}`);
  }

  return lines.length > 0 ? lines.join("\n") : compactJson(result);
}

function printResult(
  result: unknown,
  output: string,
  write: (text: string) => void,
): void {
  write(
    (output === "json" ? JSON.stringify(result, null, 2) : textOutput(result)) +
      "\n",
  );
}

function resultError(result: unknown): ThorbitCliResultError | undefined {
  const envelope = recordValue(result);
  const error = recordValue(envelope?.error);
  if (envelope?.ok !== false && !error) return undefined;
  const code = typeof error?.code === "string" ? error.code : undefined;
  const message =
    typeof error?.message === "string" ? error.message : "Thorbit tool failed";
  return new ThorbitCliResultError(message, code);
}

async function executeCommand(
  toolName: string,
  command: Command,
  context: ThorbitCliContext,
): Promise<void> {
  const options = command.optsWithGlobals() as ThorbitCliOptionValues;
  const result = await call(
    invocationInput(toolName, options, context.env.THORBIT_API_KEY),
    context,
  );
  printResult(result, options.output, context.stdout);
  const failure = resultError(result);
  if (failure) throw failure;
}

export function createThorbitCliProgram(context: ThorbitCliContext): Command {
  const program = new Command();
  program
    .name("thorbit")
    .description(
      `Generated CLI for all ${THORBIT_GENERATED_COMMANDS.length} Thorbit MCP tools`,
    )
    .version(THORBIT_CLI_VERSION)
    .configureHelp({ showGlobalOptions: true })
    .showHelpAfterError()
    .exitOverride()
    .configureOutput({
      writeOut: context.stdout,
      writeErr: context.stderr,
    })
    .option("--api-key <key>", "Thorbit API key (or set THORBIT_API_KEY)")
    .option(
      "--admin-api-key <key>",
      "personal admin API key (or set THORBIT_ADMIN_API_KEY)",
    )
    .option(
      "--base-url <url>",
      "Thorbit API base URL",
      THORBIT_DEFAULT_BASE_URL,
    )
    .option(
      "--timeout-ms <milliseconds>",
      "request timeout from 1000 to 300000 milliseconds",
      (value) => Number(value),
      THORBIT_DEFAULT_TIMEOUT_MS,
    )
    .option("--output <format>", "output format: json or text", "text");

  const admin = program
    .command("admin")
    .description("Use the private Phoenix admin API with your personal key");

  admin
    .command("whoami")
    .description("Show the current operator, roles, and capabilities")
    .action(async (_options: unknown, command: Command) => {
      const options = command.optsWithGlobals() as ThorbitCliOptionValues;
      const result = await callAdmin(
        { method: "GET", path: "/api/admin", options },
        context,
      );
      printResult(result, options.output, context.stdout);
    });

  admin
    .command("request <method> <path>")
    .description("Call an exact /api/admin path using the server's normal permissions")
    .option("--query-json <json>", "query parameters as one JSON object", "{}")
    .option("--body-json <json>", "request body as one JSON object", "{}")
    .action(
      async (
        methodInput: string,
        path: string,
        _options: unknown,
        command: Command,
      ) => {
        const options = command.optsWithGlobals() as ThorbitCliOptionValues & {
          queryJson: string;
          bodyJson: string;
        };
        const method = methodInput.toUpperCase();
        if (!THORBIT_ADMIN_METHODS.includes(method as ThorbitAdminMethod)) {
          throw new Error(
            `Admin method must be one of ${THORBIT_ADMIN_METHODS.join(", ")}`,
          );
        }
        const result = await callAdmin(
          {
            method: method as ThorbitAdminMethod,
            path,
            query: jsonObject(options.queryJson, "Admin query"),
            ...(method === "GET"
              ? {}
              : { body: jsonObject(options.bodyJson, "Admin body") }),
            options,
          },
          context,
        );
        printResult(result, options.output, context.stdout);
      },
    );

  for (const generatedCommand of THORBIT_GENERATED_COMMANDS) {
    commandOptions(
      program
        .command(generatedCommand.command)
        .description(generatedCommand.title)
        .addHelpText("after", commandHelp(generatedCommand)),
    ).action(async (_options: ThorbitCliOptionValues, command: Command) => {
      await executeCommand(generatedCommand.toolName, command, context);
    });
  }

  commandOptions(
    program
      .command("call <exact_mcp_name>")
      .description("Call one Thorbit MCP tool by its exact manifest name")
      .addHelpText(
        "after",
        "\nThe exact MCP name is validated against the generated 79-tool catalog.\n",
      ),
  ).action(
    async (
      exactMcpName: string,
      _options: ThorbitCliOptionValues,
      command: Command,
    ) => {
      await executeCommand(exactMcpName, command, context);
    },
  );

  return program;
}

function exitCodeForError(error: unknown): number {
  if (error instanceof CommanderError) {
    return error.exitCode === 0 ? 0 : 2;
  }
  if (error instanceof z.ZodError) {
    const nonCredentialIssue = error.issues.some(
      (issue) => issue.path[0] !== "apiKey",
    );
    return nonCredentialIssue ? 2 : 3;
  }
  if (error instanceof ThorbitCliResultError) {
    if (error.code === "unauthorized" || error.code === "forbidden") return 3;
    if (error.code === "payment_required") return 4;
    if (error.code === "rate_limited") return 5;
    if (error.code === "validation_error") return 2;
    return error.code ? 6 : 1;
  }
  if (error instanceof ThorbitHttpError) {
    if (
      error.statusCode === 401 ||
      error.statusCode === 403 ||
      error.code === "unauthorized" ||
      error.code === "forbidden"
    ) {
      return 3;
    }
    if (error.statusCode === 402 || error.code === "payment_required") return 4;
    if (error.statusCode === 429 || error.code === "rate_limited") return 5;
    if (error.code === "validation_error") return 2;
    return 6;
  }
  if (error instanceof ThorbitAdminHttpError) {
    if (error.statusCode === 401 || error.statusCode === 403) return 3;
    if (error.statusCode === 429) return 5;
    if (error.statusCode >= 400 && error.statusCode < 500) return 2;
    return 6;
  }
  if (error instanceof ThorbitRequestValidationError) return 2;
  if (
    error instanceof ThorbitTransportError ||
    error instanceof ThorbitResponseValidationError ||
    error instanceof ThorbitSdkError
  ) {
    return 6;
  }
  return 1;
}

function knownSecrets(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): readonly string[] {
  const values = new Set<string>();
  if (env.THORBIT_API_KEY) values.add(env.THORBIT_API_KEY);
  if (env.THORBIT_ADMIN_API_KEY) values.add(env.THORBIT_ADMIN_API_KEY);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--api-key" && argv[index + 1]) {
      values.add(argv[index + 1]!);
    } else if (argument?.startsWith("--api-key=")) {
      values.add(argument.slice("--api-key=".length));
    } else if (argument === "--admin-api-key" && argv[index + 1]) {
      values.add(argv[index + 1]!);
    } else if (argument?.startsWith("--admin-api-key=")) {
      values.add(argument.slice("--admin-api-key=".length));
    }
  }
  return [...values].filter(Boolean);
}

function redactSecrets(message: string, secrets: readonly string[]): string {
  return secrets.reduce(
    (redacted, secret) => redacted.split(secret).join("[REDACTED]"),
    message,
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    if (error.issues[0]?.path[0] === "toolName") {
      return "Unknown Thorbit tool name; use --help to list generated commands";
    }
    return error.issues[0]?.message ?? "Invalid Thorbit CLI invocation";
  }
  if (error instanceof ThorbitHttpError) {
    return `Thorbit request failed${error.code ? ` [${error.code}]` : ""}: ${error.message}`;
  }
  if (error instanceof ThorbitAdminHttpError) {
    return `Thorbit admin request failed${error.code ? ` [${error.code}]` : ""}: ${error.message}`;
  }
  if (error instanceof ThorbitCliResultError) {
    return `Thorbit tool failed${error.code ? ` [${error.code}]` : ""}: ${error.message}`;
  }
  if (error instanceof ThorbitSdkError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unexpected Thorbit CLI failure";
}

export async function runThorbitCli(
  dependencies: RunThorbitCliDependencies = {},
): Promise<number> {
  const argv = [...(dependencies.argv ?? process.argv)];
  const env = dependencies.env ?? process.env;
  const stdout =
    dependencies.stdout ?? ((text: string) => process.stdout.write(text));
  const stderr =
    dependencies.stderr ?? ((text: string) => process.stderr.write(text));
  const context: ThorbitCliContext = {
    env,
    fetch: dependencies.fetch ?? globalThis.fetch,
    stdout,
    stderr,
    client: dependencies.client,
    createClient: dependencies.createClient,
  };
  const program = createThorbitCliProgram(context);

  try {
    await program.parseAsync(argv, { from: "node" });
    return 0;
  } catch (error) {
    const exitCode = exitCodeForError(error);
    if (error instanceof CommanderError || exitCode === 0) return exitCode;
    const safeMessage = redactSecrets(
      errorMessage(error),
      knownSecrets(argv, env),
    );
    stderr(`Error: ${safeMessage}\n`);
    return exitCode;
  }
}

export function isMainModule(
  metaUrl: string,
  argvPath: string | undefined = process.argv[1],
): boolean {
  if (!argvPath) return false;
  try {
    return realpathSync(argvPath) === realpathSync(fileURLToPath(metaUrl));
  } catch {
    return false;
  }
}

export {
  THORBIT_GENERATED_CLI_COMMANDS,
  THORBIT_GENERATED_COMMANDS,
} from "./generated-thorbit-commands";
export type { ThorbitGeneratedCliCommand } from "./generated-thorbit-commands";
export {
  ThorbitCliInvocationSchema,
  ThorbitCliOutputFormatSchema,
} from "./thorbit-cli-schema";
export type {
  ThorbitCliInvocation,
  ThorbitCliInvocationInput,
  ThorbitCliToolName,
} from "./thorbit-cli-schema";

if (isMainModule(import.meta.url)) {
  process.exitCode = await runThorbitCli();
}
