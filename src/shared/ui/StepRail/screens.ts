export const TRAIL = [
  { key: 'check', number: '01', title: 'Verificação' },
  { key: 'select', number: '02', title: 'Seleção' },
  { key: 'run', number: '03', title: 'Instalação' },
  { key: 'summary', number: '04', title: 'Resumo' },
] as const

export const PLACES = [
  { key: 'config', title: 'Configuração' },
  { key: 'manage', title: 'Gerenciamento' },
] as const

export type TrailKey = (typeof TRAIL)[number]['key']
export type PlaceKey = (typeof PLACES)[number]['key']
export type Screen = 'home' | TrailKey | PlaceKey

export const TRAIL_KEYS: readonly TrailKey[] = TRAIL.map((stop) => stop.key)
export const PLACE_KEYS: readonly PlaceKey[] = PLACES.map((place) => place.key)

export function isTrail(screen: Screen): screen is TrailKey {
  return (TRAIL_KEYS as readonly string[]).includes(screen)
}

export function isPlace(screen: Screen): screen is PlaceKey {
  return (PLACE_KEYS as readonly string[]).includes(screen)
}
