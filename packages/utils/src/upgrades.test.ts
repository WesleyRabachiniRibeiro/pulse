import { describe, expect, it } from 'vitest'
import { readUpgrades } from './upgrades'

const PT = [
  'Nome                     ID                        Versão      Disponível  Origem',
  '-------------------------------------------------------------------------------',
  'Google Chrome            Google.Chrome             130.0.1     131.0.2     winget',
  'Visual Studio Code       Microsoft.VisualStudioCode 1.94.0     1.95.1      winget',
  '2 atualizações disponíveis.',
].join('\r\n')

const EN = [
  'Name                     Id                        Version     Available   Source',
  '-------------------------------------------------------------------------------',
  'Google Chrome            Google.Chrome             130.0.1     131.0.2     winget',
].join('\n')

describe('leitura das atualizações do winget', () => {
  it('lê a tabela em português', () => {
    const found = readUpgrades(PT)

    expect(found).toHaveLength(2)
    expect(found[0]).toMatchObject({
      wingetId: 'Google.Chrome',
      name: 'Google Chrome',
      current: '130.0.1',
      available: '131.0.2',
    })
  })

  it('lê a tabela em inglês igual', () => {
    expect(readUpgrades(EN)[0]?.wingetId).toBe('Google.Chrome')
  })

  it('CRLF e LF dão o mesmo resultado', () => {
    expect(readUpgrades(PT)).toEqual(readUpgrades(PT.replace(/\r\n/g, '\n')))
  })

  it('o rodapé não vira atualização', () => {
    expect(readUpgrades(PT).map((u) => u.name)).not.toContain('2 atualizações disponíveis.')
  })

  it('saber os ids do catálogo ajuda a achar a coluna certa', () => {
    expect(readUpgrades(PT, ['Google.Chrome'])[0]?.wingetId).toBe('Google.Chrome')
  })

  it('número de versão não é confundido com identificador', () => {
    const found = readUpgrades(
      ['Nome      ID        Versão   Disponível', '------------------------------', 'App  1.2.3  1.2.3  1.2.4'].join(
        '\n',
      ),
    )
    expect(found.map((u) => u.wingetId)).not.toContain('1.2.3')
  })

  it('sem nada para atualizar, a lista é vazia', () => {
    expect(readUpgrades('')).toEqual([])
    expect(readUpgrades('Nenhum pacote instalado encontrado.')).toEqual([])
  })

  it('o mesmo pacote não aparece duas vezes', () => {
    const twice = [
      'Nome            ID              Versão   Disponível  Origem',
      '-----------------------------------------------------------',
      'Google Chrome   Google.Chrome   130.0    131.0       winget',
      'Google Chrome   Google.Chrome   130.0    131.0       winget',
    ].join('\n')
    expect(readUpgrades(twice)).toHaveLength(1)
  })

  it('sem régua, ainda lê separando por espaço', () => {
    const loose = 'Google Chrome Google.Chrome 130.0.1 131.0.2 winget'
    expect(readUpgrades(loose)[0]?.wingetId).toBe('Google.Chrome')
  })

  it('linha sem versão disponível é ignorada', () => {
    expect(readUpgrades('Google Chrome Google.Chrome 130.0.1')).toEqual([])
  })
})
