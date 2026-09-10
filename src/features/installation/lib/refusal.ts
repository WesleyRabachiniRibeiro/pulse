import type { Refusal } from '@shared/features/installation/contracts'

const SAID: Record<Refusal, string> = {
  'one-blocked': 'Este programa está bloqueado pelo controle dos pais.',
  'all-blocked': 'Todos os programas escolhidos estão bloqueados pelo controle dos pais.',
  'needs-pin': 'Com o controle dos pais ligado, tirar programa do PC pede o PIN.',
}

export function refusalText(refused: Refusal): string {
  return SAID[refused]
}
