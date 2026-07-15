import { existsSync } from 'node:fs'
import { defineConfig } from 'tsup'

const publicEntry = 'src/index.ts'
const generatedCommandEntry = 'src/generated-thorbit-commands.ts'

export default defineConfig({
  entry: {
    index: existsSync(publicEntry) ? publicEntry : generatedCommandEntry,
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  target: 'node20',
  platform: 'node',
  banner: {
    js: '#!/usr/bin/env node',
  },
})
