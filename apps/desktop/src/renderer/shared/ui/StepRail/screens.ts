// As quatro etapas da instalação e os dois lugares que valem a qualquer momento.
// Antes eram dois conceitos, um número de etapa e uma sobreposição, que não
// podiam ser verdadeiros ao mesmo tempo mas nada impedia.
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
// A lista de bloqueados é uma tela cheia que se chega pela Configuração, e
// por isso não tem parada própria no rail.
export type Screen = 'home' | TrailKey | PlaceKey | 'blocked'
