import { describe, expect, it } from 'vitest'
import { ipcChannels, ipcContracts, ipcEventChannels, ipcEvents } from './contracts'

const CHANNELS = [
  'preflight:drives',
  'preflight:run',
  'update:state',
  'update:install',
  'catalog:list',
  'catalog:state',
  'catalog:retry',
  'catalog:installed',
  'catalog:inventory',
  'catalog:add',
  'catalog:mine',
  'catalog:remove',
  'catalog:startup',
  'catalog:setStartup',
  'catalog:autostart',
  'catalog:versions',
  'parental:read',
  'parental:turnOn',
  'parental:turnOff',
  'parental:change',
  'parental:check',
  'parental:allowOnce',
  'parental:setBlocked',
  'prefs:read',
  'prefs:write',
  'profile:export',
  'profile:import',
  'profile:importLink',
  'profile:folders',
  'profile:pickFolder',
  'profile:read',
  'profile:write',
  'git:config',
  'installation:start',
  'installation:append',
  'installation:state',
  'installation:cancel',
  'installation:cancelItem',
  'installation:retry',
  'installation:grant',
  'installation:open',
  'installation:openable',
  'installation:mayInstall',
  'installation:uninstall',
  'history:read',
  'steam:library',
  'steam:search',
  'windows:tweaks',
  'windows:setTweak',
  'system:icon',
  'system:copy',
  'system:openFamily',
  'system:restart',
  'system:cancelRestart',
  'window:minimize',
  'window:toggleMaximize',
  'window:close',
]

const EVENTS = ['installation:event', 'preflight:event', 'update:event', 'catalog:event']

describe('contrato de IPC', () => {
  it('tem exatamente os canais combinados', () => {
    expect([...ipcChannels].sort()).toEqual([...CHANNELS].sort())
  })

  it('tem exatamente os eventos combinados', () => {
    expect([...ipcEventChannels].sort()).toEqual([...EVENTS].sort())
  })

  it('nenhuma feature sobrescreve o canal de outra', () => {
    expect(ipcChannels.length).toBe(new Set(ipcChannels).size)
    expect(ipcChannels.length).toBe(CHANNELS.length)
  })

  it('todo canal declara entrada e saída', () => {
    for (const channel of ipcChannels) {
      const contract = ipcContracts[channel]
      expect(typeof contract.input.safeParse).toBe('function')
      expect(typeof contract.output.safeParse).toBe('function')
    }
  })

  it('a saída recusa payload fora do formato', () => {
    expect(ipcContracts['installation:state'].output.safeParse({ items: 'nada' }).success).toBe(
      false,
    )
    expect(ipcContracts['catalog:mine'].output.safeParse([1, 2]).success).toBe(false)
    expect(ipcContracts['window:toggleMaximize'].output.safeParse('sim').success).toBe(false)
  })

  it('a saída aceita o que o processo principal devolve de verdade', () => {
    expect(ipcContracts['installation:state'].output.safeParse(null).success).toBe(true)
    expect(ipcContracts['catalog:mine'].output.safeParse(['vscode']).success).toBe(true)
    expect(ipcContracts['window:toggleMaximize'].output.safeParse(true).success).toBe(true)
  })

  it('todo evento declara um schema', () => {
    for (const event of ipcEventChannels) {
      expect(typeof ipcEvents[event].safeParse).toBe('function')
    }
  })
})
