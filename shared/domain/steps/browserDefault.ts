import { z } from 'zod'
import type { StepDescriptor } from './step'

export const browserChoiceSchema = z.object({
  makeDefault: z.boolean().optional(),
  openAfter: z.boolean().optional(),
})
export type BrowserChoice = z.infer<typeof browserChoiceSchema>

export const browserDefault: StepDescriptor<BrowserChoice> = {
  id: 'browserDefault',
  title: 'QUANDO A INSTALAÇÃO TERMINAR',
  description:
    'O Windows não deixa um programa se tornar o navegador padrão sozinho, e faz bem. O Pulse pede ao próprio navegador, que ou se define, ou abre a tela do Windows para você confirmar. No fim o resumo diz qual dos dois aconteceu.',
  schema: browserChoiceSchema,
  isEmpty: (value) => value.makeDefault !== true && value.openAfter !== true,
  summary: (value) => {
    const parts: string[] = []
    if (value.makeDefault) parts.push('navegador padrão')
    if (value.openAfter) parts.push('abre no fim')
    return parts
  },
}
