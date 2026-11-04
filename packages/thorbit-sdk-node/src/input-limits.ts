/** Resource limits are checked before a schema can accumulate element errors. */
// Match the MCP SDK's existing stdio frame allowance. Width/node ceilings are
// derived from JSON's minimum encoding cost, not independent business limits.
export const THORBIT_MCP_INPUT_LIMITS = Object.freeze({
  maxBytes: 10 * 1024 * 1024,
  maxDepth: 512, // Native WordPress JSON decoding uses PHP's 512-level boundary.
  maxNodes: 10 * 1024 * 1024,
  maxArrayItems: 5 * 1024 * 1024,
  maxObjectKeys: Math.floor(10 * 1024 * 1024 / 5),
})
// IndexNow permits 10,000 URLs x 2,048 characters; allow UTF-8 expansion and
// the operation envelope within 128 MiB (10,000 * 2,048 * 6 JSON bytes < 128 MiB).
export const THORBIT_WORDPRESS_INPUT_LIMITS = Object.freeze({
  ...THORBIT_MCP_INPUT_LIMITS,
  maxBytes: 128 * 1024 * 1024,
  maxNodes: 128 * 1024 * 1024,
  maxArrayItems: 64 * 1024 * 1024,
  maxObjectKeys: Math.floor(128 * 1024 * 1024 / 5),
})
export type ThorbitMcpJsonLimits = Readonly<{ maxBytes: number; maxDepth: number; maxNodes: number; maxArrayItems: number; maxObjectKeys: number }>

export class ThorbitMcpInputLimitError extends Error {
  constructor(readonly limit: keyof ThorbitMcpJsonLimits, limits: ThorbitMcpJsonLimits = THORBIT_MCP_INPUT_LIMITS) {
    super(`MCP input exceeds ${limit} (${limits[limit]})`)
    this.name = 'ThorbitMcpInputLimitError'
  }
}

/** Iterative, descriptor-only walk: no getters/toJSON, recursion or issue-per-element allocation. */
export function assertThorbitMcpInput(value: unknown, limits: ThorbitMcpJsonLimits = THORBIT_MCP_INPUT_LIMITS): void {
  const active = new WeakSet<object>()
  type Frame = { value: unknown; depth: number; keys?: string[]; next?: number; array?: boolean }
  const stack: Frame[] = [{ value, depth: 0 }]
  let nodes = 0
  let stringBytes = 0
  const encoder = new TextEncoder()
  while (stack.length) {
    const frame = stack[stack.length - 1]!
    const current = frame.value
    if (frame.next !== undefined) {
      const container = current as object
      const length = frame.array ? (current as unknown[]).length : frame.keys!.length
      if (frame.next >= length) { active.delete(container); stack.pop(); continue }
      const key = frame.array ? String(frame.next++) : frame.keys![frame.next++]!
      if (key.length > limits.maxBytes) throw new ThorbitMcpInputLimitError('maxBytes', limits)
      if (!frame.array) stringBytes += encoder.encode(key).byteLength
      if (stringBytes > limits.maxBytes) throw new ThorbitMcpInputLimitError('maxBytes', limits)
      const descriptor = Object.getOwnPropertyDescriptor(container, key)
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) throw new TypeError('MCP input cannot contain holes or accessors')
      stack.push({ value: descriptor.value, depth: frame.depth + 1 })
      continue
    }
    if (++nodes > limits.maxNodes) throw new ThorbitMcpInputLimitError('maxNodes', limits)
    if (frame.depth > limits.maxDepth) throw new ThorbitMcpInputLimitError('maxDepth', limits)
    if (typeof current === 'string') {
      if (current.length > limits.maxBytes) throw new ThorbitMcpInputLimitError('maxBytes', limits)
      stringBytes += encoder.encode(current).byteLength
      if (stringBytes > limits.maxBytes) throw new ThorbitMcpInputLimitError('maxBytes', limits)
      stack.pop(); continue
    }
    if (current === null || current === undefined || typeof current === 'boolean' || (typeof current === 'number' && Number.isFinite(current))) { stack.pop(); continue }
    if (typeof current !== 'object') throw new TypeError('MCP input must contain only JSON data')
    if (active.has(current)) throw new TypeError('MCP input cannot contain cycles')
    const array = Array.isArray(current)
    const prototype = Object.getPrototypeOf(current)
    if (prototype !== (array ? Array.prototype : Object.prototype) && !(prototype === null && !array)) throw new TypeError('MCP input must contain plain JSON containers')
    if (Object.getOwnPropertySymbols(current).length) throw new TypeError('MCP input cannot contain symbol keys')
    // Never invoke serialization hooks; array non-index properties are not JSON data.
    if (Object.getOwnPropertyDescriptor(current, 'toJSON')) throw new TypeError('MCP input cannot contain toJSON hooks')
    if (array && current.length > limits.maxArrayItems) throw new ThorbitMcpInputLimitError('maxArrayItems', limits)
    const keys = array ? undefined : Object.keys(current)
    if (keys && keys.length > limits.maxObjectKeys) throw new ThorbitMcpInputLimitError('maxObjectKeys', limits)
    const width = array ? current.length : keys!.length
    if (nodes + width > limits.maxNodes) throw new ThorbitMcpInputLimitError('maxNodes', limits)
    active.add(current)
    frame.array = array; frame.keys = keys; frame.next = 0
  }
  // The structural gate above makes serialization bounded and prevents execution of user code.
  const encoded = JSON.stringify(value)
  if (encoded !== undefined && encoder.encode(encoded).byteLength > limits.maxBytes) {
    throw new ThorbitMcpInputLimitError('maxBytes', limits)
  }
}

/** Count observed bytes; Content-Length is not trusted and no schema runs before this gate. */
export async function readThorbitMcpRequestJson(request: Pick<Request, 'body'>): Promise<unknown> {
  if (!request.body) throw new SyntaxError('MCP request body is empty')
  const reader = request.body.getReader()
  let buffer = new Uint8Array(4096)
  let size = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > THORBIT_MCP_INPUT_LIMITS.maxBytes) {
        await reader.cancel().catch(() => {})
        throw new ThorbitMcpInputLimitError('maxBytes')
      }
      if (size > buffer.length) {
        const grown = new Uint8Array(Math.min(THORBIT_MCP_INPUT_LIMITS.maxBytes, Math.max(buffer.length * 2, size)))
        grown.set(buffer)
        buffer = grown
      }
      buffer.set(value, size - value.byteLength)
    }
  } finally { reader.releaseLock() }
  const bytes = buffer.subarray(0, size)
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  assertThorbitMcpInput(value)
  return value
}

export function serializeThorbitMcpInput(value: unknown): string {
  const input = value ?? {}
  assertThorbitMcpInput(input)
  return JSON.stringify(input)
}
