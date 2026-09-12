import { describe, expect, it } from 'vitest'
import { NodePinSealer } from './NodePinSealer'

const sealer = new NodePinSealer()

describe('NodePinSealer', () => {
  it('o PIN não aparece no que é guardado', () => {
    expect(sealer.seal('1234')).not.toContain('1234')
  })

  it('o mesmo PIN sela diferente a cada vez, por causa do sal', () => {
    expect(sealer.seal('1234')).not.toBe(sealer.seal('1234'))
  })

  it('confere o PIN certo e recusa o errado', () => {
    const secret = sealer.seal('1234')
    expect(sealer.matches(secret, '1234')).toBe(true)
    expect(sealer.matches(secret, '1235')).toBe(false)
    expect(sealer.matches(secret, '')).toBe(false)
  })

  it('segredo corrompido devolve falso em vez de estourar', () => {
    for (const bad of ['', 'sem-dois-pontos', ':', 'sal:', ':chave', 'sal:naohex']) {
      expect(() => sealer.matches(bad, '1234'), bad).not.toThrow()
      expect(sealer.matches(bad, '1234'), bad).toBe(false)
    }
  })
})
