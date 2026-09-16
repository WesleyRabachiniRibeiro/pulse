import { describe, expect, it, vi } from 'vitest'
import type { Drive } from '@pulse/domain'
import type { DriveLister } from '../../ports/drive-lister'
import { DriveCache } from './DriveCache'

function drive(letter: string): Drive {
  return {
    letter,
    label: '',
    media: 'Desconhecido',
    freeBytes: 10,
    totalBytes: 100,
    system: letter === 'C:',
  }
}

describe('DriveCache', () => {
  it('resolves with the fast list and later reports the enriched one', async () => {
    const fast = [drive('C:')]
    const enriched = [{ ...drive('C:'), media: 'SSD' as const }]

    let deliverEnriched: (() => void) | undefined
    const lister: DriveLister = {
      listDrives: (onEnriched) =>
        new Promise((resolve) => {
          deliverEnriched = () => onEnriched?.(enriched)
          resolve(fast)
        }),
    }

    const cache = new DriveCache(lister)
    const onEnrichedSpy = vi.fn()

    const result = await cache.get(true, onEnrichedSpy)
    expect(result).toBe(fast)
    expect(onEnrichedSpy).not.toHaveBeenCalled()

    deliverEnriched?.()
    expect(onEnrichedSpy).toHaveBeenCalledWith(enriched)
  })

  it('reuses a cached value within the reuse window instead of asking again', async () => {
    const list = vi.fn(async () => [drive('C:')])
    const lister: DriveLister = { listDrives: list }
    const cache = new DriveCache(lister)

    await cache.get(false)
    await cache.get(false)

    expect(list).toHaveBeenCalledTimes(1)
  })

  it('does not race two concurrent calls into two PowerShell invocations', async () => {
    let resolveFirst: ((drives: Drive[]) => void) | undefined
    const list = vi.fn(
      () =>
        new Promise<Drive[]>((resolve) => {
          resolveFirst = resolve
        }),
    )
    const lister: DriveLister = { listDrives: list }
    const cache = new DriveCache(lister)

    const first = cache.get(true)
    const second = cache.get(true)

    resolveFirst?.([drive('C:')])
    await Promise.all([first, second])

    expect(list).toHaveBeenCalledTimes(1)
  })
})
