export type EditorWriteResult = 'written' | 'nothing' | 'unreadable' | 'failed'

// 'unreadable' é o caso que importa: o settings.json aceita comentário, que
// não é JSON válido. Quando isso acontece o arquivo fica intocado, porque
// reescrevê-lo apagaria o que a pessoa ajustou à mão.
export interface EditorSettingsStore {
  apply(programId: string, tweakIds: readonly string[]): Promise<EditorWriteResult>
}
