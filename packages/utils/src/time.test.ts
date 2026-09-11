import { describe, expect, it } from 'vitest'
import { secondsBetween, secondsSince } from './time'

describe('secondsSince', () => {
  it('floors the whole seconds elapsed since an ISO start', () => {
    const start = '2024-01-01T00:00:00.000Z'
    const end = Date.parse('2024-01-01T00:00:05.900Z')
    expect(secondsSince(start, end)).toBe(5)
  })

  it('never goes negative when the end precedes the start', () => {
    const start = '2024-01-01T00:00:05.000Z'
    const end = Date.parse('2024-01-01T00:00:00.000Z')
    expect(secondsSince(start, end)).toBe(0)
  })
})

describe('secondsBetween', () => {
  it('rounds the seconds between two ISO timestamps', () => {
    expect(secondsBetween('2024-01-01T00:00:00.000Z', '2024-01-01T00:00:05.600Z')).toBe(6)
  })

  it('never goes negative when the end precedes the start', () => {
    expect(secondsBetween('2024-01-01T00:00:05.000Z', '2024-01-01T00:00:00.000Z')).toBe(0)
  })
})
