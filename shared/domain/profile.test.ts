import { describe, expect, it } from 'vitest'
import { hasProgram } from './catalog'
import { cleanProfile, EMPTY_PROFILE, profileIsEmpty, profileSchema, type Profile } from './profile'

const known = (id: string): boolean => hasProgram(id)

function profile(partial: Partial<Profile> = {}): Profile {
  return { ...EMPTY_PROFILE, ...partial }
}

describe('profileSchema', () => {
  it('aceita o perfil vazio', () => {
    expect(profileSchema.safeParse(EMPTY_PROFILE).success).toBe(true)
  })

  it('recusa formato estranho', () => {
    expect(profileSchema.safeParse({ selected: 'chrome' }).success).toBe(false)
    expect(profileSchema.safeParse(null).success).toBe(false)
  })

  it('aceita ajuste dentro do perfil', () => {
    const lido = profileSchema.safeParse({
      selected: ['vscode'],
      drives: { vscode: 'D:' },
      settings: { vscode: { steps: { vscodeExtensions: ['esbenp.prettier-vscode'] } } },
    })
    expect(lido.success).toBe(true)
  })
})

describe('profileIsEmpty', () => {
  it('reconhece o vazio', () => {
    expect(profileIsEmpty(EMPTY_PROFILE)).toBe(true)
  })

  it('reconhece que tem coisa', () => {
    expect(profileIsEmpty(profile({ selected: ['vim'] }))).toBe(false)
    expect(profileIsEmpty(profile({ drives: { vim: 'D:' } }))).toBe(false)
  })
})

describe('cleanProfile', () => {
  it('joga fora programa que saiu do catálogo', () => {
    const sujo = profile({
      selected: ['chrome', 'programa-que-nao-existe'],
      drives: { chrome: 'D:', 'programa-que-nao-existe': 'E:' },
      settings: { 'programa-que-nao-existe': { autostart: true } },
    })
    const limpo = cleanProfile(sujo, known)

    expect(limpo.selected).toEqual(['chrome'])
    expect(limpo.drives).toEqual({ chrome: 'D:' })
    expect(limpo.settings).toEqual({})
  })

  it('joga fora ajuste que ficou vazio', () => {
    const limpo = cleanProfile(profile({ settings: { vim: { steps: { vscodeExtensions: [] } } } }), known)
    expect(limpo.settings).toEqual({})
  })

  it('guarda autostart desligado, que é uma escolha', () => {
    const limpo = cleanProfile(profile({ settings: { vim: { autostart: false } } }), known)
    expect(limpo.settings['vim']).toEqual({ autostart: false })
  })

  it('tira disco em branco', () => {
    const limpo = cleanProfile(profile({ drives: { vim: '  ' } }), known)
    expect(limpo.drives).toEqual({})
  })

  it('tira id repetido da seleção', () => {
    const limpo = cleanProfile(profile({ selected: ['vim', 'vim', 'go'] }), known)
    expect(limpo.selected).toEqual(['vim', 'go'])
  })

  it('não mexe no perfil que recebeu', () => {
    const original = profile({ selected: ['vim', 'nao-existe'] })
    cleanProfile(original, known)
    expect(original.selected).toEqual(['vim', 'nao-existe'])
  })
})
