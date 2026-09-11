import { describe, expect, it } from 'vitest'
import type { ProcessRunner, SpawnResult } from '../../ports/process-runner'
import { ReadGitConfig } from './ReadGitConfig'

function fakeProcessRunner(values: Record<string, string>, gitExe: string | null): ProcessRunner {
  return {
    runOnce: async (_exe, args): Promise<SpawnResult> => {
      const key = args[args.length - 1] ?? ''
      return { code: 0, text: values[key] ?? '' }
    },
    runWinget: async () => ({ code: 0, text: '' }),
    killWinget: () => {},
    run: async () => true,
    launchDetached: async () => {},
    runCommandLine: async () => true,
    openUri: async () => true,
    runElevated: async () => ({ code: 0, text: '' }),
    runAsInteractiveUser: async () => ({ code: 0, text: '' }),
    isElevated: async () => false,
    locateVsCode: async () => null,
    locateGit: async () => gitExe,
    forgetPathCache: () => {},
  }
}

describe('ReadGitConfig', () => {
  it('returns the default config when git is not installed', async () => {
    const readGitConfig = new ReadGitConfig(fakeProcessRunner({}, null))
    const config = await readGitConfig.run()
    expect(config).toEqual({ name: '', email: '', branch: 'main' })
  })

  it('reads name/email/branch and derives saveLogin from credential.helper', async () => {
    const readGitConfig = new ReadGitConfig(
      fakeProcessRunner(
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
      fakeProcessRunner({ 'user.name': 'Ana' }, 'C:\\Git\\cmd\\git.exe'),
    )
    const config = await readGitConfig.run()
    expect(config.branch).toBe('main')
    expect(config.saveLogin).toBe(false)
  })
})
