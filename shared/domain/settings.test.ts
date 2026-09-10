import { describe, expect, it } from 'vitest'
import { settingsAreEmpty, settingsKey, settingsSummary, type Settings } from './settings'

describe('settingsAreEmpty', () => {
  it('trata ausente e vazio como a mesma coisa', () => {
    expect(settingsAreEmpty(undefined)).toBe(true)
    expect(settingsAreEmpty({})).toBe(true)
  })

  it('ignora listas vazias e campos apagados', () => {
    expect(settingsAreEmpty({ steps: { vscodeExtensions: [], riotProducts: [], tibiaPages: [] } })).toBe(true)
    expect(settingsAreEmpty({ packageId: undefined, autostart: undefined })).toBe(true)
  })

  it('reconhece uma lista com item', () => {
    expect(settingsAreEmpty({ steps: { vscodeExtensions: ['esbenp.prettier-vscode'] } })).toBe(false)
  })

  it('reconhece a versão escolhida', () => {
    expect(settingsAreEmpty({ packageId: 'OpenJS.NodeJS.LTS' })).toBe(false)
  })

  it('reconhece autostart desligado, que é uma escolha', () => {
    expect(settingsAreEmpty({ autostart: false })).toBe(false)
    expect(settingsAreEmpty({ autostart: true })).toBe(false)
  })

  it('trata caixa de seleção desmarcada como vazio', () => {
    expect(settingsAreEmpty({ steps: { browserDefault: { makeDefault: false, openAfter: false } } })).toBe(true)
    expect(settingsAreEmpty({ steps: { browserDefault: { makeDefault: true } } })).toBe(false)
  })

  it('olha dentro do git', () => {
    expect(settingsAreEmpty({ steps: { gitConfig: { name: '', email: '', branch: '' } } })).toBe(true)
    expect(settingsAreEmpty({ steps: { gitConfig: { name: '  ', email: '', branch: '' } } })).toBe(true)
    expect(settingsAreEmpty({ steps: { gitConfig: { name: '', email: '', branch: 'main' } } })).toBe(false)
    expect(settingsAreEmpty({ steps: { gitConfig: { name: 'Wesley', email: '', branch: '' } } })).toBe(false)
  })
})

describe('settingsKey', () => {
  it('não distingue ausente de vazio', () => {
    expect(settingsKey(undefined)).toBe(settingsKey({}))
  })

  it('ignora a ordem das listas', () => {
    const a: Settings = { steps: { vscodeExtensions: ['b', 'a', 'c'] } }
    const b: Settings = { steps: { vscodeExtensions: ['c', 'b', 'a'] } }
    expect(settingsKey(a)).toBe(settingsKey(b))
  })

  it('ignora a ordem das chaves', () => {
    const a: Settings = { packageId: 'x', autostart: true }
    const b: Settings = { autostart: true, packageId: 'x' }
    expect(settingsKey(a)).toBe(settingsKey(b))
  })

  it('ignora campo apagado', () => {
    expect(settingsKey({ packageId: 'x', autostart: undefined })).toBe(settingsKey({ packageId: 'x' }))
  })

  it('separa versões diferentes', () => {
    expect(settingsKey({ packageId: 'a' })).not.toBe(settingsKey({ packageId: 'b' }))
  })

  it('separa autostart ligado de desligado e de não escolhido', () => {
    const on = settingsKey({ autostart: true })
    const off = settingsKey({ autostart: false })
    const untouched = settingsKey({})
    expect(new Set([on, off, untouched]).size).toBe(3)
  })

  it('enxerga mudança dentro do git', () => {
    const antes = settingsKey({ steps: { gitConfig: { name: 'Wesley', email: 'a@b.c', branch: 'main' } } })
    const depois = settingsKey({ steps: { gitConfig: { name: 'Wesley', email: 'a@b.c', branch: 'master' } } })
    expect(antes).not.toBe(depois)
  })

  it('enxerga mudança na lista de jogos', () => {
    const antes = settingsKey({ steps: { steamGames: [{ appid: '730', name: 'CS' }] } })
    const depois = settingsKey({ steps: { steamGames: [{ appid: '570', name: 'Dota' }] } })
    expect(antes).not.toBe(depois)
  })
})

describe('opções universais', () => {
  it('escopo, idioma e instalador na tela contam como ajuste', () => {
    expect(settingsAreEmpty({ scope: 'machine' })).toBe(false)
    expect(settingsAreEmpty({ locale: 'pt-BR' })).toBe(false)
    expect(settingsAreEmpty({ interactive: true })).toBe(false)
  })

  it('instalador na tela desmarcado não conta', () => {
    expect(settingsAreEmpty({ interactive: false })).toBe(true)
  })

  it('cada um deles muda a assinatura', () => {
    const vazio = settingsKey({})
    expect(settingsKey({ scope: 'user' })).not.toBe(vazio)
    expect(settingsKey({ scope: 'user' })).not.toBe(settingsKey({ scope: 'machine' }))
    expect(settingsKey({ locale: 'pt-BR' })).not.toBe(settingsKey({ locale: 'en-US' }))
    expect(settingsKey({ interactive: true })).not.toBe(vazio)
  })

  it('o resumo do cartão fala deles em português', () => {
    expect(settingsSummary({ scope: 'machine' })).toBe('para todos os usuários')
    expect(settingsSummary({ scope: 'user' })).toBe('só para você')
    expect(settingsSummary({ locale: 'pt-BR' })).toBe('Português do Brasil')
    expect(settingsSummary({ interactive: true })).toBe('instalador na tela')
  })

  it('idioma fora da lista aparece pelo código mesmo', () => {
    expect(settingsSummary({ locale: 'de-DE' })).toBe('de-DE')
  })
})

describe('atalho na área de trabalho', () => {
  it('querer e não querer são escolhas, ausente não é', () => {
    expect(settingsAreEmpty({ desktopShortcut: true })).toBe(false)
    expect(settingsAreEmpty({ desktopShortcut: false })).toBe(false)
    expect(settingsAreEmpty({ desktopShortcut: undefined })).toBe(true)
  })

  it('as três situações têm assinaturas diferentes', () => {
    const quer = settingsKey({ desktopShortcut: true })
    const naoQuer = settingsKey({ desktopShortcut: false })
    const tantoFaz = settingsKey({})
    expect(new Set([quer, naoQuer, tantoFaz]).size).toBe(3)
  })

  it('o resumo do cartão distingue as duas escolhas', () => {
    expect(settingsSummary({ desktopShortcut: true })).toBe('atalho na área de trabalho')
    expect(settingsSummary({ desktopShortcut: false })).toBe('sem atalho na área de trabalho')
  })
})
