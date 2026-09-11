import { PROGRAM_BY_ID } from '@pulse/catalog-data'
import { equalsIgnoreCase } from '@pulse/domain'
import type { Item, ItemStage, ItemStatus, Request, Run, Settings } from '@pulse/domain'
import { secondsBetween, secondsSince } from './time'

export function driveLabel(drive: string, general: string): string {
  return equalsIgnoreCase(drive, general) ? `Geral · ${drive}` : drive
}

export const ACTIVE_STATUSES: readonly ItemStatus[] = ['downloading', 'installing', 'configuring']

export function isActive(item: Item): boolean {
  return ACTIVE_STATUSES.includes(item.status)
}

export function isWaiting(item: Item): boolean {
  return item.status === 'waiting'
}

export function anyoneWaiting(items: readonly Item[]): boolean {
  return items.some(isWaiting)
}

export function needsPermission(item: Item): boolean {
  return item.needsPermission === true
}

export function anyoneNeedingPermission(items: readonly Item[]): boolean {
  return items.some(needsPermission)
}

export function isFinished(item: Item): boolean {
  return item.status === 'done' || item.status === 'failed' || item.status === 'canceled'
}

export function canCancel(item: Item): boolean {
  return !isFinished(item)
}

export function stageOf(item: Item): ItemStage | null {
  if (item.status === 'downloading') return 'download'
  if (item.status === 'installing') return 'install'
  if (item.status === 'waiting') return needsPermission(item) ? 'install' : 'settings'
  if (item.status === 'configuring') return 'settings'
  if (item.status === 'done') return 'ready'
  return null
}

export function itemDuration(item: Item): number | null {
  if (!item.startedAt || !item.finishedAt) return null
  return secondsBetween(item.startedAt, item.finishedAt)
}

export function hasSettings(item: Item): boolean {
  const settings = item.settings
  if (!settings) return false
  return Boolean(
    settings.extensions?.length ||
      settings.games?.length ||
      settings.tibia?.length ||
      settings.riot?.length ||
      settings.workloads?.length ||
      settings.makeDefault ||
      settings.openAfter ||
      settings.git,
  )
}

function signature(settings: Settings | undefined): string {
  if (!settings) return ''

  const extensions = [...(settings.extensions ?? [])].sort().join(',')
  const games = (settings.games ?? [])
    .map((g) => g.appid)
    .sort()
    .join(',')
  const tibia = [...(settings.tibia ?? [])].sort().join(',')
  const riot = [...(settings.riot ?? [])].sort().join(',')
  const workloads = [...(settings.workloads ?? [])].sort().join(',')
  const browser = `${settings.makeDefault ?? false}|${settings.openAfter ?? false}`
  const git = settings.git
    ? `${settings.git.name}|${settings.git.email}|${settings.git.branch}|${settings.git.saveLogin ?? false}`
    : ''

  return `${extensions}#${games}#${tibia}#${riot}#${workloads}#${browser}#${git}`
}

export function requestChanged(request: Request, existing: Item): boolean {
  if (request.drive !== existing.drive) return true
  return signature(request.settings) !== signature(existing.settings)
}

export function canEnqueue(existing: Item | undefined, request?: Request): boolean {
  if (!existing) return true
  if (existing.status === 'queued' || isActive(existing) || isWaiting(existing)) return false
  if (existing.status === 'failed' || existing.status === 'canceled') return true
  return request ? requestChanged(request, existing) : false
}

export function requestsToAppend(
  requests: readonly Request[],
  run: Run | null,
): Request[] {
  const queue = new Map((run?.items ?? []).map((i) => [i.id, i]))
  return requests.filter((r) => canEnqueue(queue.get(r.id), r))
}

export function elapsedSeconds(run: Run, now: number = Date.now()): number {
  const end = run.finishedAt ? Date.parse(run.finishedAt) : now
  return secondsSince(run.startedAt, end)
}

function weight(item: Item): number {
  return PROGRAM_BY_ID.get(item.id)?.mb ?? 100
}

export function itemPercent(item: Item): number {
  if (isFinished(item)) return 100
  if (item.status === 'downloading') return Math.round(item.percent * 0.45)
  if (item.status === 'installing') return Math.round(45 + item.percent * 0.45)
  if (item.status === 'configuring' || item.status === 'waiting') return 90
  return 0
}

export function overallPercent(items: readonly Item[]): number {
  const total = items.reduce((sum, item) => sum + weight(item), 0)
  if (total === 0) return 0

  const done = items.reduce((sum, item) => sum + weight(item) * (itemPercent(item) / 100), 0)
  return Math.min(100, Math.round((done / total) * 100))
}

export interface Tally {
  total: number
  done: number
  failed: number
  canceled: number
  remaining: number
}

export function tally(items: readonly Item[]): Tally {
  return {
    total: items.length,
    done: items.filter((i) => i.status === 'done').length,
    failed: items.filter((i) => i.status === 'failed').length,
    canceled: items.filter((i) => i.status === 'canceled').length,
    remaining: items.filter((i) => !isFinished(i)).length,
  }
}

export function remainingMb(items: readonly Item[]): number {
  return items.reduce((sum, item) => {
    if (isFinished(item)) return sum
    const size = weight(item)
    if (item.status === 'downloading') return sum + size * (1 - item.percent / 100)
    return sum + size
  }, 0)
}

export function remainingMinutes(items: readonly Item[]): number {
  return Math.max(1, Math.round(remainingMb(items) / 90))
}

export type SummaryGroupKind = 'ready' | 'restart' | 'attention' | 'out'

export interface SummaryLine {
  id: string
  note: string
  drive: string
  duration: number | null
  extras: readonly string[]
  driveIgnored: boolean
}

export function settingsResultLines(item: Item): string[] {
  const result = item.result
  if (!result) return []

  const lines: string[] = []

  if (result.extensionsRequested > 0) {
    lines.push(
      result.extensions === result.extensionsRequested
        ? `${result.extensions} ${result.extensions === 1 ? 'extensão instalada' : 'extensões instaladas'}`
        : `${result.extensions} de ${result.extensionsRequested} extensões instaladas`,
    )
  }
  if (result.git) lines.push('Git configurado')
  if (result.gitLogin) lines.push('login do GitHub guardado pelo Windows')
  if (result.madeDefault === 'yes') lines.push('agora é o navegador padrão')
  if (result.madeDefault === 'asked') lines.push('confirme como padrão na janela do Windows')
  if (result.madeDefault === 'failed') lines.push('não deu para pedir para ser o padrão')
  if (result.autostart === 'on') lines.push('abre com o Windows')
  if (result.autostart === 'off') lines.push('não abre mais sozinho')
  if (result.autostart === 'no-entry') lines.push('não se cadastra na inicialização')
  if (result.gamesAccepted.length > 0) lines.push(`Steam baixando: ${result.gamesAccepted.join(', ')}`)
  if (result.gamesRefused.length > 0) lines.push(`recusado por você: ${result.gamesRefused.join(', ')}`)
  if (result.gamesPending.length > 0) lines.push(`ficou para depois: ${result.gamesPending.join(', ')}`)
  if (result.importWizard) lines.push('aberto no assistente de importação')
  if (result.importAddress) {
    lines.push(`para importar seus dados, abra ${result.importAddress} no navegador`)
  }
  if (result.pagesOpened.length > 0) {
    lines.push(`página aberta para baixar: ${result.pagesOpened.join(', ')}`)
  }
  if (result.riotInstalled.length > 0) lines.push(`instalado junto: ${result.riotInstalled.join(', ')}`)
  if (result.riotFailed.length > 0) lines.push(`não entrou: ${result.riotFailed.join(', ')}`)

  return lines
}

export interface SummaryGroup {
  kind: SummaryGroupKind
  title: string
  lines: readonly SummaryLine[]
}

export function groupSummary(items: readonly Item[]): readonly SummaryGroup[] {
  const line = (item: Item, note: string): SummaryLine => ({
    id: item.id,
    note,
    drive: item.drive,
    duration: itemDuration(item),
    extras: settingsResultLines(item),
    driveIgnored: Boolean(item.driveIgnored),
  })

  const groups: SummaryGroup[] = [
    {
      kind: 'ready',
      title: 'INSTALADOS E PRONTOS',
      lines: items
        .filter((i) => i.status === 'done' && !i.needsRestart)
        .map((i) => line(i, i.detail)),
    },
    {
      kind: 'restart',
      title: 'PEDE REINÍCIO DO PC',
      lines: items
        .filter((i) => i.status === 'done' && i.needsRestart)
        .map((i) => line(i, 'termina depois de reiniciar')),
    },
    {
      kind: 'attention',
      title: 'PRECISA DE VOCÊ',
      lines: items
        .filter((i) => i.status === 'failed')
        .map((i) => line(i, i.error ?? 'não instalado')),
    },
    {
      kind: 'out',
      title: 'FICARAM DE FORA',
      lines: items.filter((i) => i.status === 'canceled').map((i) => line(i, 'cancelado por você')),
    },
  ]

  return groups.filter((g) => g.lines.length > 0)
}

export function anyNeedsRestart(items: readonly Item[]): boolean {
  return items.some((i) => i.status === 'done' && i.needsRestart)
}
