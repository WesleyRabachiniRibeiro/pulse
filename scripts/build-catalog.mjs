import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { build } from 'esbuild'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const target = join(root, 'catalog.json')

const bundled = await build({
  entryPoints: [join(root, 'shared', 'domain', 'catalog.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'silent',
})

const code = bundled.outputFiles[0].text
const module = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

const catalog = module.BUILTIN_CATALOG
const checked = module.catalogSchema.parse(catalog)

await writeFile(target, `${JSON.stringify(checked, null, 2)}\n`, 'utf8')

console.log(
  `catalog.json: ${checked.programs.length} programas, ${checked.categories.length} categorias`,
)
