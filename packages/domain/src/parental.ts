import { z } from 'zod'

export const PIN_LENGTH = 4

export const parentalSchema = z.object({
  on: z.boolean(),
  // Guardado embaralhado com sal, nunca o PIN em si.
  secret: z.string().optional(),
  blocked: z.array(z.string()),
})
export type Parental = z.infer<typeof parentalSchema>

export const EMPTY_PARENTAL: Parental = { on: false, blocked: [] }

export function hasPin(parental: Parental): boolean {
  return Boolean(parental.secret?.trim())
}

export function pinIsValid(digits: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(digits)
}

// Ligado sem PIN cadastrado não tranca nada: sem segredo não há o que conferir.
export function locked(parental: Parental): boolean {
  return parental.on && hasPin(parental)
}

export function isBlocked(parental: Parental, id: string): boolean {
  return locked(parental) && parental.blocked.includes(id)
}

export function blockedAmong(parental: Parental, ids: readonly string[]): string[] {
  if (!locked(parental)) return []
  const wall = new Set(parental.blocked)
  return [...new Set(ids.filter((id) => wall.has(id)))]
}

export function withBlocked(parental: Parental, ids: readonly string[]): Parental {
  return { ...parental, blocked: [...new Set(ids)].sort() }
}

export function toggleBlocked(parental: Parental, id: string): Parental {
  const wall = new Set(parental.blocked)
  if (wall.has(id)) wall.delete(id)
  else wall.add(id)
  return withBlocked(parental, [...wall])
}

export type PinPurpose = 'create' | 'turnOff' | 'install' | 'uninstall' | 'list' | 'change'

export const PIN_TITLE: Record<PinPurpose, string> = {
  create: 'Crie o seu PIN',
  turnOff: 'Desligar o controle dos pais',
  install: 'Instalar um programa bloqueado',
  uninstall: 'Tirar um programa deste PC',
  list: 'Mexer na lista de bloqueados',
  change: 'Trocar o PIN',
}

export const PIN_DESC: Record<PinPurpose, string> = {
  create: `São ${PIN_LENGTH} números. É ele que vai destravar tudo daqui para a frente, então escolha um que você lembre e a criança não adivinhe.`,
  turnOff: 'Sem o controle ligado, tudo do catálogo volta a poder ser instalado.',
  install: 'Este programa está na sua lista de bloqueados.',
  uninstall: 'Com o controle ligado, tirar programa do PC pede o PIN.',
  list: 'Quem escolhe o que fica bloqueado é você.',
  change: 'Primeiro o PIN de agora, depois o novo.',
}
