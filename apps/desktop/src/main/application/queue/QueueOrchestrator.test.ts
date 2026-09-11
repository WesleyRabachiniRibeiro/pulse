import { describe, expect, it } from 'vitest'
import type { Run } from '@pulse/domain'
import { QueueOrchestrator } from './QueueOrchestrator'
import { InMemoryQueueRepository } from '../../infra/queue/InMemoryQueueRepository'
import type { ProcessRunner, SpawnResult } from '../../ports/process-runner'
import type { PackageRepository } from '../../ports/package-repository'
import type { DiskSpaceProbe } from '../../ports/disk-space-probe'
import type { SteamGameRequester } from '../../ports/steam-game-requester'
import type { BrowserDefaultSetter } from '../../ports/browser-default-setter'
import type { AutostartRegistry } from '../../ports/autostart-registry'
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
    locateVsCode: async () => null,
    locateGit: async () => null,
    forgetPathCache: () => {},
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

function fakeClipboard(): ClipboardWriter {
  return { writeText: () => {} }
}

function makeOrchestrator(processRunner: ProcessRunner = fakeProcessRunner()): QueueOrchestrator {
  return new QueueOrchestrator(
    processRunner,
    fakePackageRepository(),
    fakeDiskSpaceProbe(),
    fakeSteamGameRequester(),
    fakeBrowserDefaultSetter(),
    fakeAutostartRegistry(),
    new InMemoryQueueRepository(),
    fakeClipboard(),
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

  it('marks a failed winget run with a message derived from the exit code', async () => {
    const orchestrator = makeOrchestrator(
      fakeProcessRunner({
        runWinget: async (): Promise<SpawnResult> => ({ code: 1, text: 'algo deu errado' }),
      }),
    )
    orchestrator.start([{ id: 'chrome', drive: 'C:' }], 'C:')

    const run = await waitForStatus(orchestrator, 'chrome', ['done', 'failed'])
    expect(run.items[0]?.status).toBe('failed')
    expect(run.items[0]?.error).toContain('0x1')
  })

  it('cancels a queued item before it starts', () => {
    // PARALLEL_LIMIT is 3, so with a never-resolving runWinget the 4th item
    // stays genuinely queued instead of being dispatched synchronously.
    const orchestrator = makeOrchestrator(fakeProcessRunner({ runWinget: () => new Promise(() => {}) }))
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
    const orchestrator = makeOrchestrator(fakeProcessRunner({ runWinget: () => new Promise(() => {}) }))
    orchestrator.start([{ id: 'chrome', drive: 'C:' }], 'C:')

    orchestrator.retry('chrome')

    const state = orchestrator.currentState()
    expect(state?.items[0]?.status).toBe('downloading')
  })
})
