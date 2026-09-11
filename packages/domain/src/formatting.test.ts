import { describe, expect, it } from 'vitest'
import { formatMb, formatGb, formatBytes, clock } from './formatting'

describe('formatMb', () => {
  it('shows MB below 1024', () => {
    expect(formatMb(512)).toBe('512 MB')
  })

  it('switches to GB at 1024 or above', () => {
    expect(formatMb(2048)).toBe('2 GB')
  })
})

describe('formatGb', () => {
  it('always shows GB or TB, never MB', () => {
    expect(formatGb(1024 ** 2)).toContain('GB')
  })

  it('switches to TB at 1000 GB', () => {
    expect(formatGb(1000 * 1024 ** 3)).toContain('TB')
  })
})

describe('formatBytes', () => {
  it('drops to MB below 1 GB', () => {
    expect(formatBytes(500 * 1024 ** 2)).toBe('500 MB')
  })

  it('shows GB at 1 GB or above', () => {
    expect(formatBytes(2 * 1024 ** 3)).toBe('2 GB')
  })
})

describe('clock', () => {
  it('formats seconds as mm:ss', () => {
    expect(clock(65)).toBe('01:05')
    expect(clock(3661)).toBe('61:01')
  })
})
