import { describe, expect, it, vi } from 'vitest'
import { EMPTY_UPDATE, type UpdateState } from '@pulse/domain'
import type { UpdateChecker } from '../../ports/update-checker'
import { UpdateService } from './UpdateService'

function fakeChecker(initial: UpdateState = EMPTY_UPDATE): UpdateChecker & { state: UpdateState } {
  const listeners = new Set<(state: UpdateState) => void>()
  const checker = {
    state: initial,
    subscribe: (listener: (state: UpdateState) => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    currentState: () => checker.state,
    start: vi.fn(),
    installNow: vi.fn(),
    setBusy: vi.fn((busy: boolean) => {
      checker.state = { ...checker.state, blocked: busy }
      for (const listener of listeners) listener(checker.state)
    }),
  }
  return checker
}

describe('UpdateService.installNow', () => {
  it('does nothing when there is no update ready', () => {
    const checker = fakeChecker({ ...EMPTY_UPDATE, status: 'idle' })
    const service = new UpdateService(checker, () => false)
    service.installNow()
    expect(checker.installNow).not.toHaveBeenCalled()
  })

  it('installs right away when a ready update exists and the queue is idle', () => {
    const checker = fakeChecker({ ...EMPTY_UPDATE, status: 'ready' })
    const service = new UpdateService(checker, () => false)
    service.installNow()
    expect(checker.installNow).toHaveBeenCalledTimes(1)
  })

  it('holds the update instead of installing while the queue is busy', () => {
    const checker = fakeChecker({ ...EMPTY_UPDATE, status: 'ready' })
    const service = new UpdateService(checker, () => true)
    service.installNow()
    expect(checker.installNow).not.toHaveBeenCalled()
    expect(checker.setBusy).toHaveBeenCalledWith(true)
  })
})

describe('UpdateService.onQueueChanged', () => {
  it('re-evaluates the hold only when an update is ready', () => {
    const checker = fakeChecker({ ...EMPTY_UPDATE, status: 'downloading' })
    const service = new UpdateService(checker, () => true)
    service.onQueueChanged()
    expect(checker.setBusy).not.toHaveBeenCalled()
  })

  it('recomputes busy state once the update becomes ready', () => {
    const checker = fakeChecker({ ...EMPTY_UPDATE, status: 'ready' })
    let busy = true
    const service = new UpdateService(checker, () => busy)
    service.onQueueChanged()
    expect(checker.setBusy).toHaveBeenCalledWith(true)

    busy = false
    service.onQueueChanged()
    expect(checker.setBusy).toHaveBeenCalledWith(false)
  })
})
