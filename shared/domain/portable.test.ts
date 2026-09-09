import { describe, expect, it } from 'vitest'
import {
  csvOf,
  fileFor,
  portableOf,
  PORTABLE_VERSION,
  profileOf,
  readPortable,
  scriptOf,
  unknownOf,
  wingetImportOf,
  type Portable,
} from './portable'
import type { Profile } from './profile'

const PROFILE: Profile = {
  selected: ['chrome', 'steam'],
  drives: { steam: 'D:' },
  settings: { chrome: { locale: 'pt-BR' } },
}

function portable(over: Partial<Portable> = {}): Portable {
  return {
    pulse: PORTABLE_VERSION,
    savedAt: '2026-09-09T10:00:00.000Z',
    programs: ['vscode'],
    drives: {},
    settings: {},
    ...over,
  }
}

describe('portableOf', () => {
  it('leva a lista, os discos e as exceções', () => {
    const saved = portableOf(PROFILE, 'D:', new Date('2026-09-09T10:00:00.000Z'))

    expect(saved.programs).toEqual(['chrome', 'steam'])
    expect(saved.drives).toEqual({ steam: 'D:' })
    expect(saved.settings).toEqual({ chrome: { locale: 'pt-BR' } })
    expect(saved.drive).toBe('D:')
    expect(saved.savedAt).toBe('2026-09-09T10:00:00.000Z')
  })

  it('não leva o disco quando não há um escolhido', () => {
    expect(portableOf(PROFILE)).not.toHaveProperty('drive')
  })

  it('copia em vez de apontar para o perfil de dentro', () => {
    const saved = portableOf(PROFILE)
    saved.drives['steam'] = 'E:'
    expect(PROFILE.drives['steam']).toBe('D:')
  })
})

describe('readPortable', () => {
  it('aceita o que ele mesmo escreveu', () => {
    expect(readPortable(portableOf(PROFILE))).not.toBeNull()
  })

  it('recusa arquivo de outra versão do formato', () => {
    expect(readPortable(portable({ pulse: 99 }))).toBeNull()
  })

  it('recusa qualquer outro json', () => {
    expect(readPortable({ programas: ['chrome'] })).toBeNull()
    expect(readPortable('nada disso')).toBeNull()
  })
})

describe('profileOf', () => {
  it('somando, mantém o que já estava marcado', () => {
    const merged = profileOf(portable({ programs: ['vscode'] }), 'merge', PROFILE)
    expect(merged.selected).toEqual(['chrome', 'steam', 'vscode'])
  })

  it('somando, não repete quem já estava lá', () => {
    const merged = profileOf(portable({ programs: ['chrome'] }), 'merge', PROFILE)
    expect(merged.selected).toEqual(['chrome', 'steam'])
  })

  it('substituindo, fica só a lista do arquivo', () => {
    const trocado = profileOf(portable({ programs: ['vscode'] }), 'replace', PROFILE)
    expect(trocado.selected).toEqual(['vscode'])
    expect(trocado.drives).toEqual({})
  })

  it('somando, o ajuste do arquivo vence o de casa', () => {
    const merged = profileOf(
      portable({ settings: { chrome: { locale: 'en-US' } } }),
      'merge',
      PROFILE,
    )
    expect(merged.settings['chrome']).toEqual({ locale: 'en-US' })
  })
})

describe('wingetImportOf', () => {
  it('sai no formato que o winget import lê', () => {
    const parsed = JSON.parse(wingetImportOf(['chrome'])) as {
      Sources: { Packages: { PackageIdentifier: string }[] }[]
    }

    expect(parsed.Sources[0]?.Packages[0]?.PackageIdentifier).toBe('Google.Chrome')
  })

  it('pula quem não tem pacote no winget', () => {
    const parsed = JSON.parse(wingetImportOf(['nao-existe'])) as {
      Sources: { Packages: unknown[] }[]
    }

    expect(parsed.Sources[0]?.Packages).toEqual([])
  })
})

describe('scriptOf', () => {
  it('escreve um install por programa, com o identificador exato', () => {
    expect(scriptOf(['chrome'])).toContain('winget install --id Google.Chrome --exact')
  })

  it('quebra linha do jeito do Windows', () => {
    expect(scriptOf(['chrome'])).toContain('\r\n')
  })
})

describe('csvOf', () => {
  it('põe o cabeçalho e uma linha por programa', () => {
    const rows = csvOf(['chrome']).trim().split('\r\n')
    expect(rows[0]).toBe('nome;identificador;categoria;tamanho_mb')
    expect(rows[1]).toContain('Google Chrome')
  })

  it('protege o nome que tem ponto e vírgula', () => {
    expect(csvOf(['chrome'])).not.toContain('""')
  })
})

describe('fileFor', () => {
  it('cada formato sai diferente do outro', () => {
    const pulse = fileFor('pulse', PROFILE)
    const winget = fileFor('winget', PROFILE)
    const script = fileFor('script', PROFILE)
    const csv = fileFor('csv', PROFILE)

    expect(pulse).toContain('"pulse"')
    expect(winget).toContain('PackageIdentifier')
    expect(script).toContain('winget install')
    expect(csv).toContain('identificador')
  })

  it('o do Pulse volta a ser lido pelo próprio Pulse', () => {
    expect(readPortable(JSON.parse(fileFor('pulse', PROFILE)))).not.toBeNull()
  })
})

describe('bagagem do arquivo', () => {
  const adotado = {
    id: 'protonvpn',
    name: 'Proton VPN',
    winget: 'Proton.ProtonVPN',
    version: '',
    mb: 0,
    category: 'utilities',
    hints: ['proton vpn'],
  }

  it('leva a ficha de quem o catálogo publicado não tem', () => {
    const perfil = { ...PROFILE, selected: ['chrome', 'protonvpn'] }
    const saved = portableOf(perfil, undefined, new Date(), [adotado])

    expect(saved.extras).toEqual([adotado])
  })

  it('não leva ficha de quem não está marcado', () => {
    const saved = portableOf(PROFILE, undefined, new Date(), [adotado])
    expect(saved).not.toHaveProperty('extras')
  })

  it('diz quem do arquivo o catálogo daqui não conhece', () => {
    const saved = portableOf({ ...PROFILE, selected: ['protonvpn'] }, undefined, new Date(), [
      adotado,
    ])

    const desconhecidos = unknownOf(saved, (id) => id === 'chrome')
    expect(desconhecidos.map((p) => p.id)).toEqual(['protonvpn'])
  })

  it('não repete quem o catálogo daqui já conhece', () => {
    const saved = portableOf({ ...PROFILE, selected: ['protonvpn'] }, undefined, new Date(), [
      adotado,
    ])

    expect(unknownOf(saved, () => true)).toEqual([])
  })

  it('arquivo sem bagagem não quebra a leitura', () => {
    expect(unknownOf(portableOf(PROFILE), () => false)).toEqual([])
  })
})
