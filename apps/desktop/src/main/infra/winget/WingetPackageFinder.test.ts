import { describe, expect, it } from 'vitest'
import { WingetPackageFinder } from './WingetPackageFinder'
import type { ProcessRunner } from '../../ports/process-runner'

// Saída real de `winget search --name Discord --source winget` nesta máquina,
// com o cabeçalho e a régua traduzidos que o parser precisa descartar.
const DISCORD = [
  'Nome                        ID                                  Versão',
  '------------------------------------------------------------------------',
  'Discord                     Discord.Discord                     1.0.9258',
  'Discord Canary              Discord.Discord.Canary              1.0.1173',
  'Discord Canary (arm64)      Discord.Discord.Canary.arm64        1.0.506',
  'Discord PTB                 Discord.Discord.PTB                 1.0.1220',
].join('\r\n')

function runnerWith(text: string): ProcessRunner {
  return { runOnce: async () => ({ code: 0, text }) } as unknown as ProcessRunner
}

describe('procurar um pacote no winget', () => {
  it('lê a tabela e prefere o nome exato', async () => {
    const finder = new WingetPackageFinder(runnerWith(DISCORD))
    expect(await finder.search('Discord')).toEqual({
      name: 'Discord',
      winget: 'Discord.Discord',
      version: '1.0.9258',
    })
  })

  // O nome pode ter espaço simples dentro, então a coluna só quebra em dois
  // espaços ou mais.
  it('não parte o nome que tem espaço', async () => {
    const finder = new WingetPackageFinder(runnerWith(DISCORD))
    expect((await finder.search('Discord Canary (arm64)'))?.winget).toBe(
      'Discord.Discord.Canary.arm64',
    )
  })

  it('sem nome exato, fica com a primeira linha', async () => {
    const finder = new WingetPackageFinder(runnerWith(DISCORD))
    expect((await finder.search('Discor'))?.winget).toBe('Discord.Discord')
  })

  it('nada encontrado devolve nulo', async () => {
    const finder = new WingetPackageFinder(runnerWith('Nenhum pacote encontrado.'))
    expect(await finder.search('zzz')).toBeNull()
  })

  it('nome vazio nem chega a perguntar', async () => {
    let asked = false
    const runner = {
      runOnce: async () => {
        asked = true
        return { code: 0, text: DISCORD }
      },
    } as unknown as ProcessRunner

    expect(await new WingetPackageFinder(runner).search('   ')).toBeNull()
    expect(asked).toBe(false)
  })

  it('winget que não respondeu não vira pacote', async () => {
    const runner = {
      runOnce: async () => {
        throw new Error('winget sumiu')
      },
    } as unknown as ProcessRunner

    expect(await new WingetPackageFinder(runner).search('Discord')).toBeNull()
  })
})
