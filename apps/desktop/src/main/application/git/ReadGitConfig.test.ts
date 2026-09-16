import { describe, expect, it } from 'vitest'
import type { Toolchain } from '../../ports/toolchain'
import { ReadGitConfig } from './ReadGitConfig'

function fakeToolchain(values: Record<string, string>, gitExe: string | null): Toolchain {
  return {
    locate: async () => gitExe,
    run: async () => true,
    read: async (_exe, args) => values[args[args.length - 1] ?? ''] ?? '',
    forgetPath: () => {},
  }
}

describe('ReadGitConfig', () => {
  it('returns the default config when git is not installed', async () => {
    const readGitConfig = new ReadGitConfig(fakeToolchain({}, null))
    const config = await readGitConfig.run()
    expect(config).toEqual({ name: '', email: '', branch: 'main' })
  })

  it('reads name/email/branch and derives saveLogin from credential.helper', async () => {
    const readGitConfig = new ReadGitConfig(
      fakeToolchain(
        {
          'user.name': 'Ana',
          'user.email': 'ana@example.com',
          'init.defaultBranch': 'trunk',
          'credential.helper': 'manager',
        },
        'C:\\Git\\cmd\\git.exe',
      ),
    )
    const config = await readGitConfig.run()
    expect(config).toEqual({
      name: 'Ana',
      email: 'ana@example.com',
      branch: 'trunk',
      saveLogin: true,
    })
  })

  it('falls back to the default branch when none is configured', async () => {
    const readGitConfig = new ReadGitConfig(
      fakeToolchain({ 'user.name': 'Ana' }, 'C:\\Git\\cmd\\git.exe'),
    )
    const config = await readGitConfig.run()
    expect(config.branch).toBe('main')
    expect(config.saveLogin).toBe(false)
  })
})
