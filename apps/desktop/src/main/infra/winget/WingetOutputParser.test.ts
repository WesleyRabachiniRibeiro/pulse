import { describe, expect, it } from 'vitest'
import { readWingetProgress } from './WingetOutputParser'

describe('readWingetProgress', () => {
  it('reads a byte progress line in English', () => {
    expect(readWingetProgress('  12.3 MB / 45.6 MB')).toEqual({ percent: 27 })
  })

  it('reads a byte progress line with comma decimals', () => {
    expect(readWingetProgress('  1,5 MB / 3,0 MB')).toEqual({ percent: 50 })
  })

  it('detects the downloading phase in Portuguese and English', () => {
    expect(readWingetProgress('Baixando https://example.com/x.msi').phase).toBe('downloading')
    expect(readWingetProgress('Downloading https://example.com/x.msi').phase).toBe('downloading')
  })

  it('detects the installing phase in Portuguese and English', () => {
    expect(readWingetProgress('Instalando...').phase).toBe('installing')
    expect(readWingetProgress('Installing...').phase).toBe('installing')
  })

  it('returns an empty object for unrelated lines', () => {
    expect(readWingetProgress('Encontrado Google Chrome [Google.Chrome]')).toEqual({})
  })
})
