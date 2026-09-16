import { describe, expect, it } from 'vitest'
import type { Drive, SystemFacts } from '@pulse/domain'
import type { SystemInspector } from '../../ports/system-inspector'
import type { DriveLister } from '../../ports/drive-lister'
import { RunSystemVerification } from './RunSystemVerification'

function drive(overrides: Partial<Drive> = {}): Drive {
  return {
    letter: 'C:',
    label: '',
    media: 'SSD',
    freeBytes: 100 * 1024 ** 3,
    totalBytes: 500 * 1024 ** 3,
    system: true,
    ...overrides,
  }
}

function goodFacts(overrides: Partial<SystemFacts> = {}): SystemFacts {
  return {
    product: 'Windows 11 Pro',
    version: '23H2',
    build: 22631,
    revision: 1,
    admin: true,
    winget: '1.8.0',
    hypervisor: true,
    virtFirmware: true,
    ...overrides,
  }
}

function fakeInspector(facts: SystemFacts, online = true): SystemInspector {
  return {
    getSystemFacts: async () => facts,
    hasInternet: async () => online,
  }
}

function fakeLister(drives: readonly Drive[]): DriveLister {
  return { listDrives: async () => [...drives] }
}

describe('RunSystemVerification', () => {
  it('produces an overall ok result when every check passes', async () => {
    const service = new RunSystemVerification(fakeInspector(goodFacts()), fakeLister([drive()]))
    const result = await service.run()
    expect(result.overall).toBe('ok')
    expect(result.checks).toHaveLength(6)
    expect(result.chosenDrive).toBe('C:')
  })

  it('reflects a blocking check (old Windows build) in the overall status', async () => {
    const service = new RunSystemVerification(
      fakeInspector(goodFacts({ build: 10240 })),
      fakeLister([drive()]),
    )
    const result = await service.run()
    expect(result.overall).toBe('blocker')
  })

  it('picks the requested drive when it exists', async () => {
    const drives = [drive(), drive({ letter: 'D:', system: false })]
    const service = new RunSystemVerification(fakeInspector(goodFacts()), fakeLister(drives))
    const result = await service.run({ drive: 'D:' })
    expect(result.chosenDrive).toBe('D:')
  })

  it('discards a superseded run and only publishes for the latest token', async () => {
    const resolvers: ((facts: SystemFacts) => void)[] = []
    const slowInspector: SystemInspector = {
      getSystemFacts: () =>
        new Promise((resolve) => {
          resolvers.push(resolve)
        }),
      hasInternet: async () => true,
    }

    const service = new RunSystemVerification(slowInspector, fakeLister([drive()]))

    const events: number[] = []
    service.subscribe((partial) => events.push(partial.token))

    const first = service.run()
    const second = service.run()

    for (const resolve of resolvers) resolve(goodFacts())
    await Promise.all([first, second])

    expect(events.every((token) => token === 2)).toBe(true)
  })
})
