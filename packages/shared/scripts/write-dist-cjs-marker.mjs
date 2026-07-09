// The package root is `"type": "module"`, so Node would treat dist/*.js as ESM.
// The CJS build (tsconfig.build.json → module: commonjs) emits CommonJS syntax,
// so drop a package.json into dist/ that scopes it back to CommonJS. Runs as the
// second half of the `build` script, after tsc has (re)created dist/.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
writeFileSync(join(distDir, 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2) + '\n')
console.log('wrote dist/package.json { type: commonjs }')
