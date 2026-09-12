import { describe, expect, it } from 'vitest'
import type { Item, Request } from '@pulse/domain'
import { requestChanged } from './installation'

function item(settings: Item['settings'], drive = 'C:'): Item {
  return { id: 'vscode', drive, status: 'done', percent: 100, detail: '', ...(settings ? { settings } : {}) }
}

function request(settings: Request['settings'], drive = 'C:'): Request {
  return { id: 'vscode', drive, ...(settings ? { settings } : {}) }
}

describe('requestChanged', () => {
  it('o mesmo pedido não conta como mudança', () => {
    const settings = { steps: { vscodeExtensions: ['a', 'b'] } }
    expect(requestChanged(request(settings), item(settings))).toBe(false)
  })

  it('a ordem da lista não é mudança, o conteúdo é', () => {
    expect(
      requestChanged(
        request({ steps: { vscodeExtensions: ['b', 'a'] } }),
        item({ steps: { vscodeExtensions: ['a', 'b'] } }),
      ),
    ).toBe(false)
    expect(
      requestChanged(
        request({ steps: { vscodeExtensions: ['a'] } }),
        item({ steps: { vscodeExtensions: ['a', 'b'] } }),
      ),
    ).toBe(true)
  })

  it('trocar o disco é mudança', () => {
    expect(requestChanged(request(undefined, 'D:'), item(undefined, 'C:'))).toBe(true)
  })

  it('mexer em um campo de dentro do git é mudança', () => {
    const before = { steps: { gitConfig: { name: 'W', email: '', branch: 'main' } } }
    const after = { steps: { gitConfig: { name: 'W', email: 'w@x.com', branch: 'main' } } }
    expect(requestChanged(request(after), item(before))).toBe(true)
  })

  it('ligar e desligar a inicialização são pedidos diferentes', () => {
    expect(requestChanged(request({ autostart: true }), item({ autostart: false }))).toBe(true)
    expect(requestChanged(request({ autostart: true }), item({ autostart: true }))).toBe(false)
  })

  it('pedir sem ajuste em cima de um item que tinha ajuste é mudança', () => {
    expect(requestChanged(request(undefined), item({ steps: { vscodeExtensions: ['a'] } }))).toBe(true)
  })
})
