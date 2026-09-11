import { normalizeText } from '@pulse/utils'

const UNITS: Record<string, number> = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 }

const BYTES_RE = /(\d+(?:[.,]\d+)?)\s*(B|KB|MB|GB)?\s*\/\s*(\d+(?:[.,]\d+)?)\s*(B|KB|MB|GB)/i

function bytes(value: string, unit: string | undefined, fallback: string): number {
  return Number(value.replace(',', '.')) * (UNITS[(unit ?? fallback).toLowerCase()] ?? 1)
}

export interface WingetProgress {
  percent?: number
  phase?: 'downloading' | 'installing'
}

// O winget não tem uma saída estruturada para o progresso de "install" (só
// "--output json" para consultas de catálogo, não para a instalação em si),
// então a fase e o percentual só dão para ser lidos de casar texto com a
// barra de progresso que ele imprime no console, em português ou inglês.
export function readWingetProgress(line: string): WingetProgress {
  const text = normalizeText(line)
  const progress: WingetProgress = {}

  const m = BYTES_RE.exec(line)
  if (m?.[1] && m[3] && m[4]) {
    const done = bytes(m[1], m[2], m[4])
    const total = bytes(m[3], m[4], m[4])
    if (total > 0) progress.percent = Math.min(100, Math.round((done / total) * 100))
  }

  if (text.includes('baixand') || text.includes('download')) progress.phase = 'downloading'
  if (text.includes('nstalando') || text.includes('nstalacao') || text.includes('nstalling')) {
    progress.phase = 'installing'
  }

  return progress
}
