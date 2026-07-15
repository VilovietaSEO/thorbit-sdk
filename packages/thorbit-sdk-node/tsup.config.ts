import { existsSync } from 'node:fs'
import { defineConfig } from 'tsup'

const publicEntry = 'src/index.ts'
const generatedContractEntry = 'src/generated-thorbit-tools.ts'

export default defineConfig({
  entry: {
    index: existsSync(publicEntry) ? publicEntry : generatedContractEntry,
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  target: 'node20',
})
