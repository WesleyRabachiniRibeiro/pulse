export type EditorWriteResult = 'written' | 'nothing' | 'unreadable' | 'failed'

export interface EditorSettingsStore {
  apply(programId: string, tweakIds: readonly string[]): Promise<EditorWriteResult>
}
