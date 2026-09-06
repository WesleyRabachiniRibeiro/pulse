import { useEffect } from 'react'
import { create } from 'zustand'
import { withOtherDrive, type Check, type Drive, type Preflight } from '@shared/domain/preflight'
import { bridge } from '@/shared/lib/bridge'

export type PreflightState =
  | { phase: 'drives' }
  | { phase: 'choosing'; drives: Drive[] }
  | { phase: 'checking'; drives: Drive[]; chosen: string; parciais: Check[] }
  | { phase: 'ready'; data: Preflight }
  | { phase: 'error'; message: string }

interface PreflightStore {
  state: PreflightState
}

const usePreflightStore = create<PreflightStore>(() => ({ state: { phase: 'drives' } }))

let generation = 0
let started = false
let initialDrive: string | undefined

function put(state: PreflightState): void {
  usePreflightStore.setState({ state })
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : 'Falha ao verificar o sistema.'
}

async function check(drives: Drive[], letter: string): Promise<void> {
  const mine = ++generation
  put({ phase: 'checking', drives, chosen: letter, parciais: [] })
  try {
    const data = await bridge.invoke('preflight:run', { drive: letter })
    if (generation === mine) put({ phase: 'ready', data })
  } catch (e) {
    if (generation === mine) put({ phase: 'error', message: messageOf(e) })
  }
}

function wantedDrive(): string | undefined {
  const { state } = usePreflightStore.getState()
  if (state.phase === 'ready') return state.data.chosenDrive
  if (state.phase === 'checking') return state.chosen
  return initialDrive
}

export async function reloadPreflight(fresh = false): Promise<void> {
  const wanted = wantedDrive()
  const mine = ++generation
  const current = (): boolean => generation === mine

  put({ phase: 'drives' })
  try {
    const drives = await bridge.invoke('preflight:drives', { fresh })
    if (!current()) return

    if (drives.length === 0) {
      put({ phase: 'error', message: 'Nenhum disco fixo encontrado neste computador.' })
      return
    }
    const decided = drives.length === 1 ? drives[0] : drives.find((d) => d.letter === wanted)

    if (decided) {
      await check(drives, decided.letter)
      return
    }
    put({ phase: 'choosing', drives })
  } catch (e) {
    if (current()) put({ phase: 'error', message: messageOf(e) })
  }
}

export function startPreflight(saved?: string): void {
  if (started) return
  started = true
  initialDrive = saved
  void reloadPreflight()
}

export function chooseDrive(letter: string): void {
  const { state } = usePreflightStore.getState()

  if (state.phase === 'ready') {
    const d = state.data.drives.find((x) => x.letter === letter)
    if (d) put({ phase: 'ready', data: withOtherDrive(state.data, d) })
    return
  }
  if (state.phase === 'choosing') {
    void check(state.drives, letter)
  }
}

export function useWatchPreflight(): void {
  useEffect(() => {
    return bridge.on('preflight:event', (partial) => {
      const { state } = usePreflightStore.getState()

      if (state.phase === 'checking') {
        put({
          ...state,
          parciais: partial.checks ?? state.parciais,
          drives: partial.drives ?? state.drives,
        })
        return
      }
      if (state.phase === 'choosing' && partial.drives) {
        put({ ...state, drives: partial.drives })
      }
    })
  }, [])
}

export function usePreflightState(): PreflightState {
  return usePreflightStore((s) => s.state)
}

export function usePreflightBusy(): boolean {
  return usePreflightStore((s) => s.state.phase === 'drives' || s.state.phase === 'checking')
}

export function usePreflightSettled(): boolean {
  return usePreflightStore(
    (s) => s.state.phase === 'ready' || s.state.phase === 'error' || s.state.phase === 'choosing',
  )
}

export function usePreflightDrive(): string | null | undefined {
  return usePreflightStore((s) => {
    if (s.state.phase === 'ready') {
      return s.state.data.overall === 'blocker' ? null : s.state.data.chosenDrive
    }
    return s.state.phase === 'error' ? null : undefined
  })
}
