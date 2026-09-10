import {
  CHECK_ORDER,
  MINIMUM_BUILD,
  checkDrive,
  worstStatus,
  type Check,
  type Drive,
  type Preflight,
  type PreflightInput,
  type PreflightPartial,
} from '@shared/domain/preflight'
import type { FreshInput } from '@shared/ipc/contracts'
import {
  readDrives,
  readSystemFacts,
  type SystemFacts,
} from './infrastructure/systemProbe'

function sortDrives(drives: Drive[]): Drive[] {
  return [...drives].sort((a, b) => {
    if (a.system !== b.system) return a.system ? -1 : 1
    return b.freeBytes - a.freeBytes
  })
}

export async function listDrives(): Promise<Drive[]> {
  return sortDrives(await readDrives())
}

const REUSE_MS = 20_000

let lastDrives: { at: number; drives: Drive[] } | null = null

function peekDrives(): Drive[] | null {
  if (lastDrives && Date.now() - lastDrives.at < REUSE_MS) return lastDrives.drives
  return null
}

export function warmDrives(): void {
  void drivesForScreen().catch(() => undefined)
}

export async function drivesForScreen(input: FreshInput = {}): Promise<Drive[]> {
  if (!input.fresh && lastDrives && Date.now() - lastDrives.at < REUSE_MS) return lastDrives.drives

  const detailed: { drives: Drive[] | null } = { drives: null }

  const drives = sortDrives(
    await readDrives((raw) => {
      const enriched = sortDrives(raw)
      detailed.drives = enriched
      lastDrives = { at: Date.now(), drives: enriched }
      publishPartial({ drives: enriched })
    }),
  )

  if (detailed.drives) return detailed.drives

  lastDrives = { at: Date.now(), drives }
  return drives
}

const NETWORK_ENDPOINTS = [
  'https://www.gstatic.com/generate_204',
  'https://cdn.winget.microsoft.com/cache',
] as const

async function hasInternet(): Promise<boolean> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 8000)
  try {
    await Promise.any(
      NETWORK_ENDPOINTS.map((u) =>
        fetch(u, { method: 'GET', signal: ctrl.signal, cache: 'no-store' }),
      ),
    )
    return true
  } catch {
    return false
  } finally {
    clearTimeout(t)
  }
}

function windowsName(f: SystemFacts): string {
  const product = f.product.replace(/^Microsoft\s+/i, '').trim()
  const family = f.build >= 22000 ? 'Windows 11' : f.build >= 10240 ? 'Windows 10' : ''
  const edition = product.replace(/^Windows\s+\d+\s*/i, '').trim()
  const base = family && !/server/i.test(product) ? `${family} ${edition}`.trim() : product
  return `${base} ${f.version}`.trim() || 'Windows'
}

function checkWindows(f: SystemFacts): Check {
  const name = windowsName(f)
  const build = f.revision ? `${f.build}.${f.revision}` : `${f.build}`
  if (f.build >= MINIMUM_BUILD) {
    return { id: 'windows', status: 'ok', title: name, detail: `build ${build} · compatível` }
  }
  return {
    id: 'windows',
    status: 'blocker',
    title: name,
    detail: `build ${build} · precisa de ${MINIMUM_BUILD} ou maior`,
    fix: 'Atualize o Windows pelo Windows Update e abra o Pulse de novo.',
  }
}

function checkAdmin(f: SystemFacts): Check {
  if (f.admin) {
    return { id: 'admin', status: 'ok', title: 'Permissão de administrador', detail: 'concedida' }
  }
  return {
    id: 'admin',
    status: 'warning',
    title: 'Sem permissão de administrador',
    detail: 'rodando como usuário comum',
    fix: 'O instalador final pede elevação sozinho. Em desenvolvimento, abra o terminal como administrador.',
  }
}

function checkWinget(f: SystemFacts): Check {
  if (f.winget) {
    return {
      id: 'winget',
      status: 'ok',
      title: 'Instalador do Windows disponível',
      detail: `winget ${f.winget} pronto`,
    }
  }
  return {
    id: 'winget',
    status: 'blocker',
    title: 'Instalador do Windows ausente',
    detail: 'winget não encontrado',
    fix: 'Instale o App Installer pela Microsoft Store e tente de novo.',
  }
}

function checkInternet(online: boolean): Check {
  if (online) {
    return { id: 'internet', status: 'ok', title: 'Conexão com a internet', detail: 'ativa' }
  }
  return {
    id: 'internet',
    status: 'blocker',
    title: 'Sem conexão com a internet',
    detail: 'não foi possível alcançar a rede',
    fix: 'Conecte-se ao Wi-Fi ou ao cabo e tente de novo.',
  }
}

function checkVirtualization(f: SystemFacts): Check {
  if (f.hypervisor || f.virtFirmware) {
    return {
      id: 'virtualization',
      status: 'ok',
      title: 'Virtualização ativada',
      detail: 'o Docker pode ser instalado',
    }
  }
  return {
    id: 'virtualization',
    status: 'warning',
    title: 'Virtualização desativada',
    detail: 'só o Docker precisa dela',
    fix: 'Ative a virtualização na BIOS. Todo o resto instala normalmente sem ela.',
  }
}

type PartialListener = (partial: PreflightPartial) => void

const partialListeners = new Set<PartialListener>()

export function subscribePartial(listener: PartialListener): () => void {
  partialListeners.add(listener)
  return () => {
    partialListeners.delete(listener)
  }
}

let token = 0

function publishPartial(payload: Omit<PreflightPartial, 'token'>): void {
  for (const listener of partialListeners) listener({ token, ...payload })
}

function pickDrive(drives: readonly Drive[], wanted?: string): Drive | undefined {
  return drives.find((d) => d.letter === wanted) ?? drives.find((d) => d.system) ?? drives[0]
}

export async function runPreflight(input: PreflightInput = {}): Promise<Preflight> {
  const mine = ++token
  const arrived = new Map<Check['id'], Check>()

  const publish = (...found: Check[]): void => {
    if (mine !== token) return
    for (const c of found) arrived.set(c.id, c)
    const checks = CHECK_ORDER.map((id) => arrived.get(id)).filter((c): c is Check => Boolean(c))
    publishPartial({ checks })
  }

  const ready = peekDrives()
  if (ready) {
    const early = pickDrive(ready, input.drive)
    if (early) publish(checkDrive(early, ready.find((x) => x.system)))
  }

  const systemStep = readSystemFacts().then((f) => {
    publish(checkWindows(f), checkAdmin(f), checkWinget(f), checkVirtualization(f))
    return f
  })

  const internetStep = hasInternet().then((o) => {
    publish(checkInternet(o))
    return o
  })

  const drivesStep = drivesForScreen().then((d) => {
    const early = pickDrive(d, input.drive)
    if (early) publish(checkDrive(early, d.find((x) => x.system)))
    return d
  })

  const [facts, online, drives] = await Promise.all([systemStep, internetStep, drivesStep])

  const chosen = pickDrive(drives, input.drive)

  if (!chosen) {
    throw new Error('Nenhum disco fixo encontrado neste computador.')
  }

  const checks: Check[] = [
    checkWindows(facts),
    checkAdmin(facts),
    checkWinget(facts),
    checkInternet(online),
    checkDrive(chosen, drives.find((d) => d.system)),
    checkVirtualization(facts),
  ]

  return {
    checks,
    overall: worstStatus(checks),
    drives,
    chosenDrive: chosen.letter,
    ranAt: new Date().toISOString(),
  }
}
