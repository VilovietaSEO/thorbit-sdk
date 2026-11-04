import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as sdk from '../src/index'
const baseline = JSON.parse(readFileSync(new URL('../../../contracts/compatibility/published-sdk-0.12.0.json', import.meta.url), 'utf8')) as { nodeExports: string[]; toolNames: string[] }

describe('published 0.12.0 compatibility', () => {
  it('retains every published runtime export and tool name', () => {
    expect(baseline.toolNames.length).toBeGreaterThan(0)
    expect(baseline.nodeExports.filter(name => !(name in sdk))).toEqual([])
    const current = new Set(sdk.THORBIT_GENERATED_TOOLS.map(tool => tool.name))
    expect(baseline.toolNames.filter(name => !current.has(name as sdk.ThorbitGeneratedToolName))).toEqual([])
  })
})
