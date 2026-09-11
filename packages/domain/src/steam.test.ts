import { describe, expect, it } from 'vitest'
import { isRealGame } from './steam'

describe('isRealGame', () => {
  it('rejects known non-game entries', () => {
    expect(isRealGame('Microsoft Visual C++ 2015 Redistributable')).toBe(false)
    expect(isRealGame('Proton 8.0')).toBe(false)
    expect(isRealGame('Steamworks Common Redistributables')).toBe(false)
  })

  it('accepts everything else', () => {
    expect(isRealGame('Counter-Strike 2')).toBe(true)
  })
})
