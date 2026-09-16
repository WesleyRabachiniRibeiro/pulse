import { useEffect } from 'react'
import { create } from 'zustand'
import type { TweakState } from '@pulse/domain'
import { bridge } from '@/shared/lib/bridge'

interface TweaksStore {
  states: readonly TweakState[]
  loaded: boolean
  busy: ReadonlySet<string>
  set: (states: readonly TweakState[]) => void
  mark: (id: string, working: boolean) => void
}

const useStore = create<TweaksStore>((set) => ({
  states: [],
  loaded: false,
  busy: new Set(),
  set: (states) => set({ states, loaded: true }),
  mark: (id, working) =>
    set((old) => {
      const busy = new Set(old.busy)
      if (working) busy.add(id)
      else busy.delete(id)
      return { busy }
    }),
}))

export function useWatchTweaks(): void {
  useEffect(() => {
    let alive = true
    void bridge
      .invoke('system:tweaks', undefined)
      .then((found) => {
        if (alive) useStore.getState().set(found)
      })
      .catch(() => {
        if (alive) useStore.getState().set([])
      })
    return () => {
      alive = false
    }
  }, [])
}

export function useTweakOn(id: string): boolean {
  return useStore((s) => s.states.find((one) => one.id === id)?.on === true)
}

export function useTweakBusy(id: string): boolean {
  return useStore((s) => s.busy.has(id))
}

export function useTweaksLoaded(): boolean {
  return useStore((s) => s.loaded)
}

export async function setTweak(id: string, on: boolean): Promise<void> {
  useStore.getState().mark(id, true)
  const found = await bridge.invoke('system:setTweak', { id, on }).catch(() => null)
  if (found) useStore.getState().set(found)
  useStore.getState().mark(id, false)
}
