import { PROGRAM_BY_ID } from '@pulse/catalog-data'
import {
  PORTABLE_VERSION,
  profileSchema,
  settingsAreEmpty,
  type ExportFormat,
  type ImportMode,
  type Portable,
  type Profile,
  type Settings,
} from '@pulse/domain'

export function profileIsEmpty(profile: Profile): boolean {
  return (
    profile.selected.length === 0 &&
    Object.keys(profile.drives).length === 0 &&
    Object.keys(profile.settings).length === 0
  )
}

// Um perfil vindo de outro PC pode citar programa que saiu do catálogo, disco
// que não existe aqui, ou ajuste que ficou vazio. Nada disso deve entrar.
export function cleanProfile(profile: Profile, known: (id: string) => boolean): Profile {
  const settings: Record<string, Settings> = {}
  for (const [id, value] of Object.entries(profile.settings)) {
    if (known(id) && !settingsAreEmpty(value)) settings[id] = value
  }

  const drives: Record<string, string> = {}
  for (const [id, letter] of Object.entries(profile.drives)) {
    if (known(id) && letter.trim()) drives[id] = letter
  }

  return {
    selected: [...new Set(profile.selected.filter(known))],
    drives,
    settings,
  }
}

export function missingFrom(profile: Profile, known: (id: string) => boolean): string[] {
  return [...new Set(profile.selected.filter((id) => !known(id)))]
}

export function portableOf(profile: Profile, drive?: string, at = new Date()): Portable {
  return {
    pulse: PORTABLE_VERSION,
    savedAt: at.toISOString(),
    ...(drive ? { drive } : {}),
    programs: [...profile.selected],
    drives: { ...profile.drives },
    settings: { ...profile.settings },
  }
}

export function profileOf(portable: Portable, mode: ImportMode, current: Profile): Profile {
  const selected =
    mode === 'merge' ? [...new Set([...current.selected, ...portable.programs])] : portable.programs

  return profileSchema.parse({
    selected,
    drives: mode === 'merge' ? { ...current.drives, ...portable.drives } : { ...portable.drives },
    settings:
      mode === 'merge' ? { ...current.settings, ...portable.settings } : { ...portable.settings },
  })
}

// Identificador do winget é publicador ponto pacote. O que foge disso é
// descartado em vez de escapado: o que não parece identificador não tem o que
// fazer numa linha de comando. Hoje os ids do catálogo cabem nesta forma, mas o
// catálogo vai passar a aceitar programa vindo de fora.
const SAFE_WINGET_ID = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/

function wingetIdsOf(ids: readonly string[]): string[] {
  const found: string[] = []

  for (const id of ids) {
    const winget = PROGRAM_BY_ID.get(id)?.winget
    if (!winget || !SAFE_WINGET_ID.test(winget)) continue
    if (!found.includes(winget)) found.push(winget)
  }

  return found
}

export function wingetImportOf(ids: readonly string[], at = new Date()): string {
  const packages = wingetIdsOf(ids).map((PackageIdentifier) => ({ PackageIdentifier }))

  return `${JSON.stringify(
    {
      $schema: 'https://aka.ms/winget-packages.schema.2.0.json',
      CreationDate: at.toISOString(),
      Sources: [
        {
          Packages: packages,
          SourceDetails: {
            Argument: 'https://cdn.winget.microsoft.com/cache',
            Identifier: 'Microsoft.Winget.Source_8wekyb3d8bbwe',
            Name: 'winget',
            Type: 'Microsoft.PreIndexed.Package',
          },
        },
      ],
      WinGetVersion: '1.0',
    },
    null,
    2,
  )}\n`
}

const SCRIPT_ARGS = '--exact --accept-package-agreements --accept-source-agreements'

const SCRIPT_HEADER: readonly string[] = [
  '# Gerado pelo Pulse. Rode num PowerShell comum, sem administrador.',
  "$ErrorActionPreference = 'Continue'",
  '',
]

// Este texto não é um script do Pulse: ele nunca roda aqui. É um arquivo que a
// pessoa leva embora e executa em outra máquina, como a planilha e a lista do
// winget. Por isso é montado como texto, e não é um `.ps1` versionado em
// `resources`, que é a regra para tudo que o app executa.
//
// CRLF porque o destino é um PowerShell no Windows, aberto no Bloco de Notas
// com alguma frequência.
export function scriptOf(ids: readonly string[]): string {
  const lines = wingetIdsOf(ids).map((winget) => `winget install --id ${winget} ${SCRIPT_ARGS}`)

  return [...SCRIPT_HEADER, ...lines, ''].join('\r\n')
}

function csvCell(value: string): string {
  return /[",;\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

// Ponto e vírgula porque o Excel em português usa vírgula como decimal.
export function csvOf(ids: readonly string[]): string {
  const rows = [['nome', 'identificador', 'categoria', 'tamanho_mb']]

  for (const id of ids) {
    const program = PROGRAM_BY_ID.get(id)
    if (!program) continue
    rows.push([program.name, program.winget ?? '', program.category, String(program.mb)])
  }

  return `${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}\r\n`
}

export function fileFor(format: ExportFormat, profile: Profile, drive?: string): string {
  const ids = [...profile.selected]

  if (format === 'winget') return wingetImportOf(ids)
  if (format === 'script') return scriptOf(ids)
  if (format === 'csv') return csvOf(ids)

  return `${JSON.stringify(portableOf(profile, drive), null, 2)}\n`
}
