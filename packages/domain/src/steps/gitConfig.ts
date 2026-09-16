import { gitIsEmpty, gitSchema, gitSummary, type GitConfig } from '../git'
import type { StepDescriptor } from './step'

export const gitConfig: StepDescriptor<GitConfig> = {
  id: 'gitConfig',
  title: 'COMO ASSINAR SEUS COMMITS',
  description:
    'É o nome e o email que aparecem em cada commit seu. Os campos já vêm com o que está cadastrado nesta máquina, lido na hora. Mude só o que quiser mudar: o que você não tocar continua como está.',
  schema: gitSchema,
  isEmpty: (value) => gitIsEmpty(value),
  summary: (value) => gitSummary(value),
}
