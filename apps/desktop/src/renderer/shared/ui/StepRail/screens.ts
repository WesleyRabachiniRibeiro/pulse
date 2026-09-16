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

export type Screen = 'home' | TrailKey | PlaceKey | 'blocked'
