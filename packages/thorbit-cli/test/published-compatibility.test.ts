import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import * as cli from '../src/index'
const baseline = JSON.parse(readFileSync(new URL('../../../contracts/compatibility/published-sdk-0.12.0.json', import.meta.url), 'utf8')) as { cliExports: string[] }
it('retains every published 0.12.0 CLI runtime export', () => {
  expect(baseline.cliExports.filter(name => !(name in cli))).toEqual([])
})
