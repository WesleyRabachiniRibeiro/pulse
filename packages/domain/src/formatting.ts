export function formatMb(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`
  }
  return `${mb.toLocaleString('pt-BR')} MB`
}

export function formatGb(bytes: number): string {
  const gb = bytes / 1024 ** 3
  if (gb >= 1000) {
    return `${(gb / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} TB`
  }
  return `${gb.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`
}

export function formatBytes(bytes: number): string {
  const gb = bytes / 1024 ** 3
  if (gb >= 1) return `${gb.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`
}

export function clock(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}
