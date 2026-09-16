import { describe, expect, it } from 'vitest'
import {
  alreadyInstalled,
  needsAdmin,
  refusedElevation,
  needsReboot,
  installerBusy,
  refusedDrive,
  refusesElevation,
  wingetErrorMessage,
} from './WingetErrorClassifier'

describe('alreadyInstalled', () => {
  it('recognizes the known exit code regardless of output text', () => {
    expect(alreadyInstalled(0x8a15002b, '')).toBe(true)
  })

  it('falls back to matching text in Portuguese and English', () => {
    expect(alreadyInstalled(1, 'No newer package version is available')).toBe(true)
    expect(alreadyInstalled(1, 'Nenhuma atualização disponível')).toBe(true)
  })

  it('is false for unrelated errors', () => {
    expect(alreadyInstalled(1, 'Download failed')).toBe(false)
  })
})

describe('needsAdmin', () => {
  it('recognizes known access-denied exit codes', () => {
    expect(needsAdmin(5, '')).toBe(true)
    expect(needsAdmin(0x80070005, '')).toBe(true)
  })

  it('falls back to matching access-denied text', () => {
    expect(needsAdmin(1, 'Acesso negado.')).toBe(true)
    expect(needsAdmin(1, 'Access is denied.')).toBe(true)
  })
})

describe('refusedElevation', () => {
  it('matches the UAC-cancelled exit code only', () => {
    expect(refusedElevation(1223)).toBe(true)
    expect(refusedElevation(0)).toBe(false)
  })
})

describe('needsReboot', () => {
  it('recognizes known reboot-required exit codes', () => {
    expect(needsReboot(3010, '')).toBe(true)
  })

  it('falls back to matching reboot-required text', () => {
    expect(needsReboot(1, 'Restart required to finish the installation')).toBe(true)
    expect(needsReboot(1, 'Reinicie o computador para concluir')).toBe(true)
  })
})

describe('installerBusy', () => {
  it('recognizes the MSI-busy exit code', () => {
    expect(installerBusy(1618, '')).toBe(true)
  })

  it('falls back to matching text about another installer running', () => {
    expect(installerBusy(1, 'Another installation is already in progress')).toBe(true)
  })
})

describe('refusedDrive / refusesElevation', () => {
  it('detects when the installer ignores the chosen install location', () => {
    expect(refusedDrive('This package does not support installing to a custom location')).toBe(true)
  })

  it('detects when the installer refuses to run elevated', () => {
    expect(refusesElevation('This application cannot run in an administrator context')).toBe(true)
  })
})

describe('wingetErrorMessage', () => {
  it('prioritizes the elevation-refusal explanation over the generic exit code', () => {
    const message = wingetErrorMessage(
      1,
      'cannot run in an administrator context',
      'Discord',
    )
    expect(message).toContain('sem "Executar como administrador"')
  })

  it('falls back to the raw exit code and last output line', () => {
    const message = wingetErrorMessage(1, 'linha 1\nlinha final', 'Discord')
    expect(message).toContain('0x1')
    expect(message).toContain('linha final')
  })
})
