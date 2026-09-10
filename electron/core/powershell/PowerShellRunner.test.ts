import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PowerShellError as Failure } from './PowerShellError'

interface FakeChild extends EventEmitter {
  stdout: EventEmitter
  stderr: EventEmitter
  kill: () => void
}

const spawned: { exe: string; args: string[] }[] = []
let child: FakeChild
let killed = false

function makeChild(): FakeChild {
  const emitter = new EventEmitter() as FakeChild
  emitter.stdout = new EventEmitter()
  emitter.stderr = new EventEmitter()
  emitter.kill = (): void => {
    killed = true
  }
  return emitter
}

vi.mock('node:child_process', () => ({
  spawn: (exe: string, args: string[]) => {
    spawned.push({ exe, args })
    return child
  },
}))

const { json, run, stream, text, textOr } = await import('./PowerShellRunner')
const { PowerShellError } = await import('./PowerShellError')

function say(chunk: string): void {
  child.stdout.emit('data', Buffer.from(chunk, 'utf8'))
}

function close(code = 0): void {
  child.emit('close', code)
}

beforeEach(() => {
  spawned.length = 0
  killed = false
  child = makeChild()
  vi.useRealTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('PowerShellRunner', () => {
  it('chama o powershell sem perfil e com o script codificado', async () => {
    const promise = text('Write-Output 1')
    say('1\r\n')
    close()
    await promise

    const call = spawned[0]
    expect(call?.exe).toBe('powershell.exe')
    expect(call?.args.slice(0, 5)).toEqual([
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-EncodedCommand',
    ])

    const decoded = Buffer.from(call?.args[5] ?? '', 'base64').toString('utf16le')
    expect(decoded).toBe('Write-Output 1')
  })

  it('devolve a saída sem espaço em branco nas pontas', async () => {
    const promise = text('qualquer')
    say('  resposta \r\n')
    close()
    await expect(promise).resolves.toBe('resposta')
  })

  it('entrega código de saída e stderr sem lançar em run', async () => {
    const promise = run('qualquer')
    child.stderr.emit('data', Buffer.from('deu ruim', 'utf8'))
    close(3)
    await expect(promise).resolves.toEqual({ stdout: '', stderr: 'deu ruim', code: 3 })
  })

  it('lança quando o código de saída não é zero', async () => {
    const promise = text('qualquer')
    close(1)
    await expect(promise).rejects.toBeInstanceOf(PowerShellError)
    await promise.catch((error: Failure) => {
      expect(error.failure).toBe('exit')
      expect(error.code).toBe(1)
    })
  })

  it('interpreta JSON', async () => {
    const promise = json<{ nome: string }>('qualquer')
    say('{"nome":"pulse"}')
    close()
    await expect(promise).resolves.toEqual({ nome: 'pulse' })
  })

  it('lança parse quando a saída não é JSON', async () => {
    const promise = json('qualquer')
    say('isso não é json')
    close()
    await promise.catch((error: Failure) => {
      expect(error.failure).toBe('parse')
    })
  })

  it('entrega o padrão quando o script falha', async () => {
    const promise = textOr('nada', 'qualquer')
    close(9)
    await expect(promise).resolves.toBe('nada')
  })

  it('quebra a saída em linhas conforme elas chegam', async () => {
    const lines: string[] = []
    const promise = stream('qualquer', { onLine: (line) => lines.push(line) })

    say('primeira\nsegu')
    expect(lines).toEqual(['primeira'])

    say('nda\nterceira sem quebra')
    expect(lines).toEqual(['primeira', 'segunda'])

    close()
    await promise
    expect(lines).toEqual(['primeira', 'segunda', 'terceira sem quebra'])
  })

  it('mata o processo e lança quando passa do tempo', async () => {
    vi.useFakeTimers()
    const promise = text('qualquer', { timeoutMs: 1000 })
    vi.advanceTimersByTime(1001)

    await promise.catch((error: Failure) => {
      expect(error.failure).toBe('timeout')
    })
    expect(killed).toBe(true)
  })

  it('mata o processo quando a saída passa do limite', async () => {
    const promise = text('qualquer', { maxBuffer: 8 })
    say('mais do que oito bytes')

    await promise.catch((error: Failure) => {
      expect(error.failure).toBe('overflow')
    })
    expect(killed).toBe(true)
  })

  it('cancela pelo signal', async () => {
    const controller = new AbortController()
    const promise = text('qualquer', { signal: controller.signal })
    controller.abort()

    await promise.catch((error: Failure) => {
      expect(error.failure).toBe('canceled')
    })
    expect(killed).toBe(true)
  })

  it('nem chega a esperar quando o signal já veio abortado', async () => {
    const promise = text('qualquer', { signal: AbortSignal.abort() })
    await promise.catch((error: Failure) => {
      expect(error.failure).toBe('canceled')
    })
  })
})
