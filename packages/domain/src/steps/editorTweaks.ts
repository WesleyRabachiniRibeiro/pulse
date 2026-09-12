import { z } from 'zod'
import { EDITOR_TWEAKS } from '../editor'
import { countLabel } from './label'
import type { StepDescriptor } from './step'

export const editorTweaks: StepDescriptor<string[]> = {
  id: 'editorTweaks',
  title: 'COMO O EDITOR SE COMPORTA',
  description:
    'O Pulse grava isso no settings.json do editor, na sua pasta de usuário. Se o arquivo já tiver comentário ou estiver fora do formato JSON, o Pulse não encosta nele e avisa no resumo, para não estragar o que você já ajustou.',
  schema: z.array(z.string()),
  options: EDITOR_TWEAKS,
  searchPlaceholder: 'Buscar um ajuste…',
  isEmpty: (value) => value.length === 0,
  summary: (value) => [countLabel(value.length, 'ajuste do editor', 'ajustes do editor')],
}
