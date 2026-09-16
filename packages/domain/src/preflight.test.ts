import { describe, expect, it } from 'vitest'
import { checkDrive, worstStatus, type Drive } from './preflight'

const GB = 1024 ** 3

function drive(overrides: Partial<Drive>): Drive {
  return {
    letter: 'C:',
    label: '',
    media: 'SSD',
    freeBytes: 100 * GB,
    totalBytes: 500 * GB,
    system: true,
    ...overrides,
  }
}

describe('checkDrive', () => {
  it('is ok when the chosen drive has plenty of free space', () => {
    expect(checkDrive(drive({ freeBytes: 30 * GB })).status).toBe('ok')
  })

  it('warns when the chosen drive is low but above the minimum', () => {
    expect(checkDrive(drive({ freeBytes: 10 * GB })).status).toBe('warning')
  })

  it('blocks when the chosen drive is below the minimum', () => {
    expect(checkDrive(drive({ freeBytes: 2 * GB })).status).toBe('blocker')
  })

  it('also accounts for the system drive, since installers always spill temp files there', () => {
    const chosen = drive({ letter: 'D:', system: false, freeBytes: 200 * GB })
    const system = drive({ letter: 'C:', system: true, freeBytes: 2 * GB })
    expect(checkDrive(chosen, system).status).toBe('blocker')
  })

  it('does not double-check system space when the chosen drive is the system drive', () => {
    const chosen = drive({ letter: 'C:', system: true, freeBytes: 30 * GB })
    expect(checkDrive(chosen, chosen).status).toBe('ok')
  })
})

describe('worstStatus', () => {
  it('escalates to the worst status among checks', () => {
    expect(worstStatus([{ id: 'drive', status: 'ok', title: '', detail: '' }])).toBe('ok')
    expect(
      worstStatus([
        { id: 'drive', status: 'ok', title: '', detail: '' },
        { id: 'admin', status: 'warning', title: '', detail: '' },
      ]),
    ).toBe('warning')
    expect(
      worstStatus([
        { id: 'drive', status: 'blocker', title: '', detail: '' },
        { id: 'admin', status: 'warning', title: '', detail: '' },
      ]),
    ).toBe('blocker')
  })
})
