import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Program } from '@shared/domain/catalog'

let home = ''

vi.mock('electron', () => ({
  app: { getPath: (): string => join(home, 'Desktop') },
}))

const { applyDesktopShortcut, findStartMenuShortcut } = await import('./shortcuts')

const chrome: Program = {
  id: 'chrome',
  name: 'Google Chrome',
  winget: 'Google.Chrome',
  version: '1',
  mb: 1,
  category: 'browsers',
  hints: ['google chrome'],
}

const kubectl: Program = {
  id: 'kubectl',
  name: 'kubectl',
  winget: 'Kubernetes.kubectl',
  version: '1',
  mb: 1,
  category: 'dev',
  hints: ['kubectl'],
}

function startMenu(): string {
  return join(home, 'AppData', 'Microsoft', 'Windows', 'Start Menu', 'Programs')
}

function desktop(): string {
  return join(home, 'Desktop')
}

async function putShortcut(folder: string, name: string): Promise<void> {
  await mkdir(folder, { recursive: true })
  await writeFile(join(folder, name), 'atalho de mentira', 'utf8')
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'pulse-lnk-'))
  await mkdir(desktop(), { recursive: true })
  process.env['APPDATA'] = join(home, 'AppData')
  process.env['ProgramData'] = join(home, 'ProgramData')
})

afterEach(async () => {
  await rm(home, { recursive: true, force: true })
})

describe('findStartMenuShortcut', () => {
  it('acha o atalho pelo nome do programa', async () => {
    await putShortcut(startMenu(), 'Google Chrome.lnk')
    await expect(findStartMenuShortcut(chrome)).resolves.toContain('Google Chrome.lnk')
  })

  it('procura dentro de subpasta', async () => {
    await putShortcut(join(startMenu(), 'Google', 'Chrome'), 'Google Chrome.lnk')
    await expect(findStartMenuShortcut(chrome)).resolves.toContain('Google Chrome.lnk')
  })

  it('devolve nulo quando o programa não tem atalho', async () => {
    await putShortcut(startMenu(), 'Outra Coisa.lnk')
    await expect(findStartMenuShortcut(kubectl)).resolves.toBeNull()
  })

  it('ignora arquivo que não é atalho', async () => {
    await putShortcut(startMenu(), 'Google Chrome.txt')
    await expect(findStartMenuShortcut(chrome)).resolves.toBeNull()
  })
})

describe('applyDesktopShortcut', () => {
  it('copia o atalho para a área de trabalho', async () => {
    await putShortcut(startMenu(), 'Google Chrome.lnk')

    await expect(applyDesktopShortcut(chrome, true)).resolves.toBe('created')
    await expect(readdir(desktop())).resolves.toContain('Google Chrome.lnk')
  })

  it('não copia de novo quando já está lá', async () => {
    await putShortcut(startMenu(), 'Google Chrome.lnk')
    await putShortcut(desktop(), 'Google Chrome.lnk')

    await expect(applyDesktopShortcut(chrome, true)).resolves.toBe('kept')
  })

  it('avisa quando não há atalho para copiar', async () => {
    await expect(applyDesktopShortcut(kubectl, true)).resolves.toBe('not-found')
  })

  it('apaga o atalho quando não é para ter', async () => {
    await putShortcut(desktop(), 'Google Chrome.lnk')

    await expect(applyDesktopShortcut(chrome, false)).resolves.toBe('removed')
    await expect(readdir(desktop())).resolves.not.toContain('Google Chrome.lnk')
  })

  it('não reclama de apagar o que não existe', async () => {
    await expect(applyDesktopShortcut(chrome, false)).resolves.toBe('kept')
  })

  it('não encosta no atalho de outro programa', async () => {
    await putShortcut(desktop(), 'Outra Coisa.lnk')

    await applyDesktopShortcut(chrome, false)
    await expect(readdir(desktop())).resolves.toContain('Outra Coisa.lnk')
  })
})

describe('findStartMenuShortcut escolhe o melhor, não o primeiro', () => {
  const acrobat: Program = {
    id: 'acrobat',
    name: 'Acrobat Reader',
    winget: 'Adobe.Acrobat.Reader.64-bit',
    version: '1',
    mb: 1,
    category: 'media',
    hints: ['acrobat reader', 'adobe acrobat'],
  }

  it('prefere o nome que é exatamente a pista', async () => {
    await putShortcut(startMenu(), 'Adobe Acrobat Distiller.lnk')
    await putShortcut(startMenu(), 'Adobe Acrobat.lnk')

    await expect(findStartMenuShortcut(acrobat)).resolves.toContain('Adobe Acrobat.lnk')
  })

  it('sem nome exato, prefere o mais curto', async () => {
    await putShortcut(startMenu(), 'Adobe Acrobat Distiller Server.lnk')
    await putShortcut(startMenu(), 'Adobe Acrobat Distiller.lnk')

    await expect(findStartMenuShortcut(acrobat)).resolves.toContain(
      'Adobe Acrobat Distiller.lnk',
    )
  })

  it('não muda de ideia quando só existe um', async () => {
    await putShortcut(startMenu(), 'Adobe Acrobat Distiller.lnk')
    await expect(findStartMenuShortcut(acrobat)).resolves.toContain('Distiller')
  })
})
