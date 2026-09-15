import { SEED_CATALOG } from '@pulse/domain'
import { describe, expect, it } from 'vitest'
import type { Run } from '@pulse/domain'
import { QueueOrchestrator } from './QueueOrchestrator'
import { InMemoryQueueRepository } from '../../infra/queue/InMemoryQueueRepository'
import type { ProcessRunner } from '../../ports/process-runner'
import type { InstallOutcome, PackageInstaller } from '../../ports/package-installer'
import type { PackageRepository } from '../../ports/package-repository'
import type { DiskSpaceProbe } from '../../ports/disk-space-probe'
import type { SteamGameRequester } from '../../ports/steam-game-requester'
import type { BrowserDefaultSetter } from '../../ports/browser-default-setter'
import type { AutostartRegistry } from '../../ports/autostart-registry'
import type { DesktopShortcut } from '../../ports/desktop-shortcut'
import type { ClipboardWriter } from '../../ports/clipboard-writer'

function fakeProcessRunner(overrides: Partial<ProcessRunner> = {}): ProcessRunner {
  return {
    runOnce: async () => ({ code: 0, text: '' }),
    runWinget: async () => ({ code: 0, text: '' }),
    killWinget: () => {},
    run: async () => true,
    launchDetached: async () => {},
    runCommandLine: async () => true,
    openUri: async () => true,
    runElevated: async () => ({ code: 0, text: '' }),
    runAsInteractiveUser: async () => ({ code: 0, text: '' }),
    isElevated: async () => false,
    ...overrides,
  }
}

function fakePackageInstaller(overrides: Partial<PackageInstaller> = {}): PackageInstaller {
  return {
    install: async (): Promise<InstallOutcome> => ({ kind: 'ok', needsReboot: false }),
    installElevated: async (): Promise<InstallOutcome> => ({ kind: 'ok', needsReboot: false }),
    uninstall: async () => ({ kind: 'ok' }),
    cancel: () => {},
    ...overrides,
  }
}

function fakePackageRepository(): PackageRepository {
  return {
    isInstalled: async () => false,
    quietUninstallCommands: async () => [],
    forgetCache: () => {},
  }
}

function fakeDiskSpaceProbe(): DiskSpaceProbe {
  return { listDrives: async () => [] }
}

function fakeSteamGameRequester(): SteamGameRequester {
  return {
    isSignedIn: async () => true,
    hasManifest: async () => true,
    isInstallDialogOpen: async () => false,
  }
}

function fakeBrowserDefaultSetter(): BrowserDefaultSetter {
  return {
    makeDefault: async () => 'yes',
    openOnce: async () => ({ result: 'opened', address: null }),
  }
}

function fakeAutostartRegistry(): AutostartRegistry {
  return { setAutostart: async () => 'no-entry' }
}

function fakeDesktopShortcut(): DesktopShortcut {
  return { setShortcut: async () => 'not-found' }
}

function fakeClipboard(): ClipboardWriter {
  return { writeText: () => {} }
}

function makeOrchestrator(
  packageInstaller: PackageInstaller = fakePackageInstaller(),
  processRunner: ProcessRunner = fakeProcessRunner(),
): QueueOrchestrator {
  return new QueueOrchestrator(
    SEED_CATALOG,
    processRunner,
    packageInstaller,
    fakePackageRepository(),
    fakeDiskSpaceProbe(),
    fakeSteamGameRequester(),
    fakeBrowserDefaultSetter(),
    fakeAutostartRegistry(),
    fakeDesktopShortcut(),
    new InMemoryQueueRepository(),
    fakeClipboard(),
    { apply: async () => 'written' },
    { locate: async () => null, run: async () => true, read: async () => '', forgetPath: () => {} },
  )
}

function waitForStatus(
  orchestrator: QueueOrchestrator,
  id: string,
  statuses: readonly string[],
): Promise<Run> {
  return new Promise((resolve) => {
    const unsubscribe = orchestrator.subscribe((run) => {
      const item = run.items.find((i) => i.id === id)
      if (item && statuses.includes(item.status)) {
        unsubscribe()
        resolve(run)
      }
    })
  })
}

describe('QueueOrchestrator', () => {
  it('installs a queued item to completion', async () => {
    const orchestrator = makeOrchestrator()
    orchestrator.start([{ id: 'chrome', drive: 'C:' }], 'C:')

    const run = await waitForStatus(orchestrator, 'chrome', ['done', 'failed'])
    expect(run.items[0]?.status).toBe('done')
  })

  it('surfaces the failure message the installer reported', async () => {
    const orchestrator = makeOrchestrator(
      fakePackageInstaller({
        install: async (): Promise<InstallOutcome> => ({
          kind: 'failed',
          code: '0x1',
          message: 'O winget encerrou com 0x1.',
        }),
      }),
    )
    orchestrator.start([{ id: 'chrome', drive: 'C:' }], 'C:')

    const run = await waitForStatus(orchestrator, 'chrome', ['done', 'failed'])
    expect(run.items[0]?.status).toBe('failed')
    expect(run.items[0]?.error).toContain('0x1')
  })

  it('retries on another disk when the installer refuses the chosen one', async () => {
    const seen: (string | undefined)[] = []
    const orchestrator = makeOrchestrator(
      fakePackageInstaller({
        install: async (spec): Promise<InstallOutcome> => {
          seen.push(spec.destination)
          return seen.length === 1
            ? { kind: 'drive-refused', code: '0x2', message: 'recusou o disco' }
            : { kind: 'ok', needsReboot: false }
        },
      }),
    )
    orchestrator.start([{ id: 'chrome', drive: 'D:' }], 'D:')

    const run = await waitForStatus(orchestrator, 'chrome', ['done', 'failed'])
    expect(run.items[0]?.status).toBe('done')
    expect(run.items[0]?.driveIgnored).toBe(true)
    expect(seen[0]).toBeDefined()
    expect(seen[1]).toBeUndefined()
  })

  it('cancels a queued item before it starts', () => {
    // PARALLEL_LIMIT is 3, so with a never-resolving install the 4th item
    // stays genuinely queued instead of being dispatched synchronously.
    const orchestrator = makeOrchestrator(fakePackageInstaller({ install: () => new Promise(() => {}) }))
    orchestrator.start(
      [
        { id: 'chrome', drive: 'C:' },
        { id: 'firefox', drive: 'C:' },
        { id: 'brave', drive: 'C:' },
        { id: 'operagx', drive: 'C:' },
      ],
      'C:',
    )
    orchestrator.cancelItem('operagx')

    const state = orchestrator.currentState()
    expect(state?.items.find((i) => i.id === 'operagx')?.status).toBe('canceled')
  })

  it('rejects retrying an item that has not finished', () => {
    const orchestrator = makeOrchestrator(fakePackageInstaller({ install: () => new Promise(() => {}) }))
    orchestrator.start([{ id: 'chrome', drive: 'C:' }], 'C:')

    orchestrator.retry('chrome')

    const state = orchestrator.currentState()
    expect(state?.items[0]?.status).toBe('downloading')
  })
})
