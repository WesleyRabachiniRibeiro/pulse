import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyEditorTweaks, editorSettingsPath } from './editor'

let roaming = ''

function file(folder = 'Code'): string {
  return join(roaming, folder, 'User', 'settings.json')
}

async function put(content: string, folder = 'Code'): Promise<void> {
  await mkdir(join(roaming, folder, 'User'), { recursive: true })
  await writeFile(file(folder), content, 'utf8')
}

async function read(folder = 'Code'): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(file(folder), 'utf8'))
}

beforeEach(async () => {
  roaming = await mkdtemp(join(tmpdir(), 'pulse-editor-'))
  process.env['APPDATA'] = roaming
})

afterEach(async () => {
  await rm(roaming, { recursive: true, force: true })
})

describe('editorSettingsPath', () => {
  it('aponta para a pasta do editor certo', () => {
    expect(editorSettingsPath('vscode')).toBe(file('Code'))
    expect(editorSettingsPath('cursor')).toBe(file('Cursor'))
  })

  it('devolve nulo para quem não é editor', () => {
    expect(editorSettingsPath('chrome')).toBeNull()
  })
})

describe('applyEditorTweaks', () => {
  it('não faz nada quando não há ajuste marcado', async () => {
    await expect(applyEditorTweaks('vscode', [])).resolves.toBe('nothing')
  })

  it('cria o arquivo quando ele ainda não existe', async () => {
    await expect(applyEditorTweaks('vscode', ['formatOnSave'])).resolves.toBe('written')
    await expect(read()).resolves.toEqual({ 'editor.formatOnSave': true })
  })

  it('mantém o que o usuário já tinha escrito', async () => {
    await put(JSON.stringify({ 'editor.fontFamily': 'Fira Code' }))

    await expect(applyEditorTweaks('vscode', ['wordWrap'])).resolves.toBe('written')

    const depois = await read()
    expect(depois['editor.fontFamily']).toBe('Fira Code')
    expect(depois['editor.wordWrap']).toBe('on')
  })

  it('aceita arquivo vazio', async () => {
    await put('')
    await expect(applyEditorTweaks('vscode', ['wordWrap'])).resolves.toBe('written')
  })

  it('não encosta no arquivo que tem comentário', async () => {
    const original = '{\n  // meu ajuste\n  "editor.fontSize": 20\n}'
    await put(original)

    await expect(applyEditorTweaks('vscode', ['wordWrap'])).resolves.toBe('unreadable')
    await expect(readFile(file(), 'utf8')).resolves.toBe(original)
  })

  it('não encosta no arquivo quebrado', async () => {
    const original = '{ isto não é json'
    await put(original)

    await expect(applyEditorTweaks('vscode', ['wordWrap'])).resolves.toBe('unreadable')
    await expect(readFile(file(), 'utf8')).resolves.toBe(original)
  })

  it('não encosta no arquivo que virou lista', async () => {
    await put('[1, 2, 3]')
    await expect(applyEditorTweaks('vscode', ['wordWrap'])).resolves.toBe('unreadable')
  })

  it('escreve na pasta do Cursor quando é o Cursor', async () => {
    await expect(applyEditorTweaks('cursor', ['wordWrap'])).resolves.toBe('written')
    await expect(read('Cursor')).resolves.toEqual({ 'editor.wordWrap': 'on' })
  })

  it('recusa programa que não é editor', async () => {
    await expect(applyEditorTweaks('chrome', ['wordWrap'])).resolves.toBe('failed')
  })

  it('grava json legível, com quebra de linha no fim', async () => {
    await applyEditorTweaks('vscode', ['formatOnSave'])
    const bruto = await readFile(file(), 'utf8')

    expect(bruto).toContain('\n')
    expect(bruto.endsWith('\n')).toBe(true)
  })

  it('aplicar duas vezes não duplica nada', async () => {
    await applyEditorTweaks('vscode', ['formatOnSave', 'wordWrap'])
    await applyEditorTweaks('vscode', ['formatOnSave', 'wordWrap'])

    expect(Object.keys(await read())).toHaveLength(2)
  })
})
