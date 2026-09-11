import type { Item } from '@pulse/domain'
import { describe, expect, it } from 'vitest'
import { canEnqueue, itemPercent, overallPercent, tally } from './installation'

function item(overrides: Partial<Item>): Item {
  return {
    id: 'chrome',
    status: 'queued',
    percent: 0,
    detail: '',
    drive: 'C:',
    ...overrides,
  }
}

describe('canEnqueue', () => {
  it('allows enqueueing when nothing exists yet', () => {
    expect(canEnqueue(undefined)).toBe(true)
  })

  it('blocks re-enqueueing while queued, active or waiting', () => {
    expect(canEnqueue(item({ status: 'queued' }))).toBe(false)
    expect(canEnqueue(item({ status: 'downloading' }))).toBe(false)
    expect(canEnqueue(item({ status: 'waiting' }))).toBe(false)
  })

  it('allows retrying failed or canceled items unconditionally', () => {
    expect(canEnqueue(item({ status: 'failed' }))).toBe(true)
    expect(canEnqueue(item({ status: 'canceled' }))).toBe(true)
  })

  it('only re-enqueues a done item when the new request differs', () => {
    const existing = item({ status: 'done', drive: 'C:' })
    expect(canEnqueue(existing, { id: 'chrome', drive: 'C:' })).toBe(false)
    expect(canEnqueue(existing, { id: 'chrome', drive: 'D:' })).toBe(true)
    expect(canEnqueue(existing)).toBe(false)
  })
})

describe('itemPercent', () => {
  it('maps download progress to the first 45%', () => {
    expect(itemPercent(item({ status: 'downloading', percent: 50 }))).toBe(23)
  })

  it('maps install progress to the 45-90% band', () => {
    expect(itemPercent(item({ status: 'installing', percent: 100 }))).toBe(90)
  })

  it('treats configuring/waiting as 90% and finished statuses as 100%', () => {
    expect(itemPercent(item({ status: 'configuring' }))).toBe(90)
    expect(itemPercent(item({ status: 'waiting' }))).toBe(90)
    expect(itemPercent(item({ status: 'done' }))).toBe(100)
    expect(itemPercent(item({ status: 'canceled' }))).toBe(100)
  })
})

describe('overallPercent', () => {
  it('weighs items by their catalog download size', () => {
    const items = [
      item({ id: 'chrome', status: 'done' }),
      item({ id: 'firefox', status: 'queued' }),
    ]
    expect(overallPercent(items)).toBeGreaterThan(0)
    expect(overallPercent(items)).toBeLessThan(100)
  })

  it('returns 0 for an empty queue', () => {
    expect(overallPercent([])).toBe(0)
  })
})

describe('tally', () => {
  it('counts items by terminal status', () => {
    const items = [
      item({ status: 'done' }),
      item({ status: 'failed' }),
      item({ status: 'canceled' }),
      item({ status: 'queued' }),
    ]
    expect(tally(items)).toEqual({ total: 4, done: 1, failed: 1, canceled: 1, remaining: 1 })
  })
})
