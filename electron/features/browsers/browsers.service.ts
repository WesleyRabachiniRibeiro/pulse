import { spawn } from 'node:child_process'
import { entryMatchesProgram, type Program } from '@shared/domain/catalog'

const REGISTERED_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
@(foreach ($raiz in @('HKLM:\\SOFTWARE\\Clients\\StartMenuInternet', 'HKCU:\\SOFTWARE\\Clients\\StartMenuInternet')) {
  Get-ChildItem $raiz | ForEach-Object {
    [pscustomobject]@{
      key    = [string]$_.PSChildName
      exe    = [string](Get-ItemProperty "$($_.PSPath)\\shell\\open\\command").'(default)'
      progId = [string](Get-ItemProperty "$($_.PSPath)\\Capabilities\\URLAssociations").http
    }
  }
}) | ConvertTo-Json -Compress

`

const DEFAULT_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$k = Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice'
if ($k.ProgId) { $k.ProgId } else { '' }
`

export interface RegisteredBrowser {
  key: string
  exe: string
  progId: string
}

function powershell(script: string): Promise<string> {
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  return new Promise((resolve) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { windowsHide: true },
    )
    let out = ''
    child.stdout?.on('data', (b: Buffer) => (out += b.toString('utf8')))
    child.on('error', () => resolve(''))
    child.on('close', () => resolve(out.trim()))
  })
}

async function registered(): Promise<RegisteredBrowser[]> {
  const raw = await powershell(REGISTERED_SCRIPT)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return (Array.isArray(parsed) ? parsed : [parsed]) as RegisteredBrowser[]
  } catch {
    return []
  }
}

export async function findBrowser(program: Program): Promise<RegisteredBrowser | null> {
  const all = await registered()
  return all.find((b) => b?.key && entryMatchesProgram(b.key, b.exe ?? '', program)) ?? null
}

async function currentDefault(): Promise<string> {
  return powershell(DEFAULT_SCRIPT)
}

function executable(command: string): string | null {
  const quoted = /^"([^"]+)"/.exec(command)
  if (quoted?.[1]) return quoted[1]
  const bare = command.trim().split(' ')[0]
  return bare || null
}

function launch(exe: string, args: readonly string[]): Promise<void> {
  return new Promise((resolve) => {
    const child = spawn(exe, [...args], { windowsHide: true, detached: true, stdio: 'ignore' })
    child.on('error', () => resolve())
    child.unref()
    resolve()
  })
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export type DefaultResult = 'yes' | 'asked' | 'failed'

function fileName(exe: string): string {
  const cut = Math.max(exe.lastIndexOf('\\'), exe.lastIndexOf('/'))
  return exe.slice(cut + 1).replace(/\.exe$/i, '')
}

interface ImportRoute {
  file: RegExp
  wizardArg?: string
  address?: string
}

const IMPORT_ROUTES: readonly ImportRoute[] = [
  { file: /^firefox$/i, wizardArg: '-migration' },
  { file: /^chrome$/i, address: 'chrome://settings/importData' },
  { file: /^brave$/i, address: 'brave://settings/importData' },
  { file: /^opera(\b|_)/i, address: 'opera://settings/importData' },
  { file: /^msedge$/i, address: 'edge://settings/profiles/importBrowsingData' },
  { file: /^vivaldi$/i, address: 'vivaldi://settings/importData' },
]

function importRoute(exe: string): ImportRoute | null {
  const name = fileName(exe)
  return IMPORT_ROUTES.find((r) => r.file.test(name)) ?? null
}

async function isRunning(exe: string): Promise<boolean> {
  const file = fileName(exe)
  const out = await powershell(
    `$p = Get-Process -Name '${file.replace(/'/g, "''")}' -ErrorAction SilentlyContinue
if ($p) { 'sim' } else { 'nao' }`,
  )
  return out.includes('sim')
}

export async function makeDefault(program: Program): Promise<DefaultResult> {
  const browser = await findBrowser(program)
  const exe = browser ? executable(browser.exe) : null
  if (!browser || !exe) return 'failed'

  const isFirefox = /firefox/i.test(exe)
  await launch(exe, [isFirefox ? '-setDefaultBrowser' : '--make-default-browser'])

  await wait(4000)

  const now = await currentDefault()
  if (!now) return 'asked'
  return now.toLowerCase() === browser.progId.toLowerCase() ? 'yes' : 'asked'
}

export type OpenResult = 'opened' | 'already-running' | 'failed'

export interface OpenOutcome {
  result: OpenResult
  address: string | null
}

export async function openOnce(program: Program): Promise<OpenOutcome> {
  const browser = await findBrowser(program)
  const exe = browser ? executable(browser.exe) : null
  if (!exe) return { result: 'failed', address: null }

  const route = importRoute(exe)

  if (route?.wizardArg) {
    const running = await isRunning(exe)
    await launch(exe, running ? [] : [route.wizardArg])
    return { result: running ? 'already-running' : 'opened', address: null }
  }

  await launch(exe, [])
  return { result: 'opened', address: route?.address ?? null }
}
