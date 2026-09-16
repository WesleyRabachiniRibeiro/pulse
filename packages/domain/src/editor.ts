import type { SettingsOption } from '@pulse/catalog-data'

export interface EditorTweak extends SettingsOption {
  patch: Readonly<Record<string, unknown>>
}

export const EDITOR_TWEAKS: readonly EditorTweak[] = [
  {
    id: 'formatOnSave',
    name: 'Formatar ao salvar',
    hint: 'endireita a indentação toda vez que você aperta salvar',
    category: 'Escrever',
    patch: { 'editor.formatOnSave': true },
  },
  {
    id: 'autoSave',
    name: 'Salvar sozinho',
    hint: 'grava um segundo depois que você para de digitar',
    category: 'Escrever',
    patch: { 'files.autoSave': 'afterDelay', 'files.autoSaveDelay': 1000 },
  },
  {
    id: 'trimWhitespace',
    name: 'Tirar espaço sobrando no fim da linha',
    hint: 'evita aquela mudança invisível no diff',
    category: 'Escrever',
    patch: { 'files.trimTrailingWhitespace': true, 'files.insertFinalNewline': true },
  },
  {
    id: 'wordWrap',
    name: 'Quebrar linha comprida',
    hint: 'sem barra de rolagem para o lado',
    category: 'Ver',
    patch: { 'editor.wordWrap': 'on' },
  },
  {
    id: 'bigFont',
    name: 'Letra maior',
    hint: 'sobe a fonte do editor para 15',
    category: 'Ver',
    patch: { 'editor.fontSize': 15 },
  },
  {
    id: 'noMinimap',
    name: 'Esconder o mapa do lado',
    hint: 'aquela miniatura do arquivo na direita',
    category: 'Ver',
    patch: { 'editor.minimap.enabled': false },
  },
  {
    id: 'bracketPairs',
    name: 'Colorir os parênteses em pares',
    hint: 'ajuda a achar onde o bloco fecha',
    category: 'Ver',
    patch: { 'editor.guides.bracketPairs': true, 'editor.bracketPairColorization.enabled': true },
  },
  {
    id: 'noTelemetry',
    name: 'Desligar a telemetria',
    hint: 'para de mandar dados de uso',
    category: 'Privacidade',
    patch: { 'telemetry.telemetryLevel': 'off' },
  },
]

export const EDITOR_TWEAK_BY_ID: ReadonlyMap<string, EditorTweak> = new Map(
  EDITOR_TWEAKS.map((tweak) => [tweak.id, tweak]),
)

export function editorPatch(ids: readonly string[]): Record<string, unknown> {
  const patch: Record<string, unknown> = {}

  for (const tweak of EDITOR_TWEAKS) {
    if (!ids.includes(tweak.id)) continue
    for (const [key, value] of Object.entries(tweak.patch)) patch[key] = value
  }

  return patch
}

export function mergeEditorSettings(
  current: Record<string, unknown>,
  ids: readonly string[],
): Record<string, unknown> {
  return { ...current, ...editorPatch(ids) }
}

export const EDITOR_FOLDERS: Readonly<Record<string, string>> = {
  vscode: 'Code',
  cursor: 'Cursor',
}

export function editorFolderFor(programId: string): string | null {
  return EDITOR_FOLDERS[programId] ?? null
}
