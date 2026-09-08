import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))
const catalog = JSON.parse(await readFile(join(here, '..', 'catalog.json'), 'utf8'))

const AT_ONCE = 4

async function check(program) {
  if (!program.winget || program.source === 'pages') {
    return { id: program.id, state: 'pulado' }
  }

  const source = program.source === 'msstore' ? 'msstore' : 'winget'
  const { stdout } = await exec(
    'winget',
    ['search', '--id', program.winget, '--exact', '--disable-interactivity', '--source', source],
    { windowsHide: true, timeout: 30_000, maxBuffer: 1024 * 1024 },
  ).catch(() => ({ stdout: '' }))

  const found = stdout.toLowerCase().includes(program.winget.toLowerCase())
  return { id: program.id, winget: program.winget, state: found ? 'achou' : 'NAO ACHOU' }
}

const results = []
let next = 0

async function worker() {
  while (next < catalog.programs.length) {
    const program = catalog.programs[next++]
    results.push(await check(program))
    process.stdout.write('.')
  }
}

await Promise.all(Array.from({ length: AT_ONCE }, worker))
process.stdout.write('\n')

const missing = results.filter((r) => r.state === 'NAO ACHOU')
const skipped = results.filter((r) => r.state === 'pulado')

console.log(`conferidos: ${results.length - skipped.length}`)
console.log(`pulados (página ou sem pacote): ${skipped.map((s) => s.id).join(', ') || 'nenhum'}`)

if (missing.length === 0) {
  console.log('todos os pacotes existem no winget')
} else {
  console.log(`\nNÃO EXISTEM (${missing.length}):`)
  for (const m of missing) console.log(`  ${m.id} -> ${m.winget}`)
  process.exitCode = 1
}
