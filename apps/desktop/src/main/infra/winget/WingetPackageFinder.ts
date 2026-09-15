import { normalizeText } from '@pulse/domain'
import type { ProcessRunner } from '../../ports/process-runner'
import type { FoundPackage, PackageFinder } from '../../ports/package-finder'

// A saída de "winget search" é uma tabela de texto, e o cabeçalho e a régua
// aparecem traduzidos. Em vez de procurar as colunas pelo nome, cada linha é
// lida de trás para frente: os dois últimos campos são a fonte e a versão, o
// anterior é o id, e o que sobra na frente é o nome.
function readRow(line: string): FoundPackage | null {
  const tokens = line.trim().split(/\s{2,}/)
  if (tokens.length < 3) return null

  const [name, winget, version] = tokens
  if (!name || !winget || !version) return null
  if (!winget.includes('.')) return null

  return { name, winget, version }
}

export class WingetPackageFinder implements PackageFinder {
  constructor(private readonly processRunner: ProcessRunner) {}

  async search(name: string): Promise<FoundPackage | null> {
    const wanted = name.trim()
    if (!wanted) return null

    const { text } = await this.processRunner
      .runOnce('winget', [
        'search',
        '--name',
        wanted,
        '--disable-interactivity',
        '--accept-source-agreements',
        '--source',
        'winget',
      ])
      .catch((): { code: number; text: string } => ({ code: -1, text: '' }))

    const rows: FoundPackage[] = []
    for (const line of text.split(/\r?\n/)) {
      const row = readRow(line)
      if (row) rows.push(row)
    }

    if (rows.length === 0) return null

    // Um nome igual ganha de qualquer parecido: "Discord" não pode virar
    // "Discord Canary" só porque veio antes na tabela.
    const needle = normalizeText(wanted)
    return rows.find((row) => normalizeText(row.name) === needle) ?? rows[0] ?? null
  }
}
