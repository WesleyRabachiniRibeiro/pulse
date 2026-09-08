import { describe, expect, it } from 'vitest'
import {
  EDITOR_TWEAK_BY_ID,
  EDITOR_TWEAKS,
  editorFolderFor,
  editorPatch,
  mergeEditorSettings,
} from './editor'

describe('lista de ajustes do editor', () => {
  it('não tem id repetido', () => {
    expect(new Set(EDITOR_TWEAKS.map((t) => t.id)).size).toBe(EDITOR_TWEAKS.length)
  })

  it('todo ajuste escreve pelo menos uma chave', () => {
    for (const tweak of EDITOR_TWEAKS) {
      expect(Object.keys(tweak.patch).length).toBeGreaterThan(0)
    }
  })

  it('todo ajuste tem nome, dica e categoria', () => {
    for (const tweak of EDITOR_TWEAKS) {
      expect(tweak.name.length).toBeGreaterThan(0)
      expect(tweak.hint.length).toBeGreaterThan(0)
      expect(tweak.category.length).toBeGreaterThan(0)
    }
  })

  it('dois ajustes não brigam pela mesma chave', () => {
    const seen = new Set<string>()
    for (const tweak of EDITOR_TWEAKS) {
      for (const key of Object.keys(tweak.patch)) {
        expect(seen.has(key), key).toBe(false)
        seen.add(key)
      }
    }
  })
})

describe('editorPatch', () => {
  it('devolve vazio quando nada foi marcado', () => {
    expect(editorPatch([])).toEqual({})
  })

  it('monta só o que foi marcado', () => {
    expect(editorPatch(['formatOnSave'])).toEqual({ 'editor.formatOnSave': true })
  })

  it('junta as chaves de vários ajustes', () => {
    const patch = editorPatch(['formatOnSave', 'wordWrap'])
    expect(patch).toEqual({ 'editor.formatOnSave': true, 'editor.wordWrap': 'on' })
  })

  it('um ajuste pode escrever mais de uma chave', () => {
    expect(Object.keys(editorPatch(['autoSave']))).toHaveLength(2)
  })

  it('ignora id que não existe', () => {
    expect(editorPatch(['nao-existe'])).toEqual({})
  })

  it('não liga para a ordem', () => {
    expect(editorPatch(['wordWrap', 'formatOnSave'])).toEqual(
      editorPatch(['formatOnSave', 'wordWrap']),
    )
  })
})

describe('mergeEditorSettings', () => {
  it('mantém o que o usuário já tinha', () => {
    const antes = { 'editor.fontFamily': 'Fira Code', 'workbench.colorTheme': 'Dracula' }
    const depois = mergeEditorSettings(antes, ['formatOnSave'])

    expect(depois['editor.fontFamily']).toBe('Fira Code')
    expect(depois['workbench.colorTheme']).toBe('Dracula')
    expect(depois['editor.formatOnSave']).toBe(true)
  })

  it('sobrescreve só a chave que o ajuste cuida', () => {
    const depois = mergeEditorSettings({ 'editor.wordWrap': 'off' }, ['wordWrap'])
    expect(depois['editor.wordWrap']).toBe('on')
  })

  it('não mexe no objeto que recebeu', () => {
    const antes = { 'editor.wordWrap': 'off' }
    mergeEditorSettings(antes, ['wordWrap'])
    expect(antes['editor.wordWrap']).toBe('off')
  })

  it('sem ajuste marcado, devolve o mesmo conteúdo', () => {
    const antes = { 'editor.fontSize': 12 }
    expect(mergeEditorSettings(antes, [])).toEqual(antes)
  })
})

describe('editorFolderFor', () => {
  it('conhece o VS Code e o Cursor', () => {
    expect(editorFolderFor('vscode')).toBe('Code')
    expect(editorFolderFor('cursor')).toBe('Cursor')
  })

  it('não inventa pasta para quem não é editor', () => {
    expect(editorFolderFor('chrome')).toBeNull()
  })
})

describe('EDITOR_TWEAK_BY_ID', () => {
  it('acha cada ajuste pelo id', () => {
    for (const tweak of EDITOR_TWEAKS) {
      expect(EDITOR_TWEAK_BY_ID.get(tweak.id)).toBe(tweak)
    }
  })
})
