import { describe, expect, it } from 'vitest'
import { normalizeText } from './text'

describe('normalizeText', () => {
  it('strips accents and lowercases', () => {
    expect(normalizeText('Instalação')).toBe('instalacao')
  })

  it('is a no-op for plain ascii lowercase text', () => {
    expect(normalizeText('already lower')).toBe('already lower')
  })
})
