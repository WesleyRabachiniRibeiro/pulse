import { describe, expect, it } from 'vitest'
import { EDITOR_TWEAKS, editorFolderFor, editorPatch, mergeEditorSettings } from './editor'

describe('ajustes do editor', () => {
  it('cada ajuste tem id único e pelo menos uma chave para gravar', () => {
    const ids = EDITOR_TWEAKS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const tweak of EDITOR_TWEAKS) {
      expect(Object.keys(tweak.patch).length, `${tweak.id} sem chave`).toBeGreaterThan(0)
    }
  })

  it('um ajuste pode gravar mais de uma chave', () => {
    expect(editorPatch(['autoSave'])).toEqual({
      'files.autoSave': 'afterDelay',
      'files.autoSaveDelay': 1000,
    })
  })

  it('o que não foi marcado não entra', () => {
    expect(editorPatch([])).toEqual({})
    expect(editorPatch(['inexistente'])).toEqual({})
  })

  // Esta é a regra que protege o arquivo: só as chaves marcadas mudam, o
  // resto do que a pessoa ajustou à mão continua exatamente como estava.
  it('o que a pessoa já tinha continua valendo', () => {
    const current = { 'editor.fontFamily': 'Fira Code', 'editor.fontSize': 12 }
    const next = mergeEditorSettings(current, ['bigFont'])

    expect(next['editor.fontFamily']).toBe('Fira Code')
    expect(next['editor.fontSize']).toBe(15)
  })

  it('sem ajuste marcado, o arquivo sai igual ao que entrou', () => {
    const current = { 'editor.fontSize': 12 }
    expect(mergeEditorSettings(current, [])).toEqual(current)
  })

  it('só os editores conhecidos têm pasta', () => {
    expect(editorFolderFor('vscode')).toBe('Code')
    expect(editorFolderFor('cursor')).toBe('Cursor')
    expect(editorFolderFor('chrome')).toBeNull()
  })
})
