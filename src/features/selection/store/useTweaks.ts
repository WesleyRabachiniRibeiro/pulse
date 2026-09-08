import { useEffect } from 'react'
import { create } from 'zustand'
import type { TweakState } from '@shared/domain/windows'
import { bridge } from '@/shared/lib/bridge'

interface TweaksStore {
  states: Readonly<Record<string, boolean>>
  loaded: boolean
  busy: ReadonlySet<string>
  set: (states: readonly TweakState[]) => void
  markBusy: (id: string, busy: boolean) => void
}

export const useTweaksStore = create<TweaksStore>((set) => ({
  states: {},
  loaded: false,
  busy: new Set<string>(),

  set: (states) =>
    set({ states: Object.fromEntries(states.map((s) => [s.id, s.on])), loaded: true }),

  markBusy: (id, busy) =>
    set((state) => {
      const next = new Set(state.busy)
      if (busy) next.add(id)
      else next.delete(id)
      return { busy: next }
    }),
}))

export function useWatchTweaks(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    let alive = true

    void bridge
      .invoke('windows:tweaks', undefined)
      .then((states) => {
        if (alive) useTweaksStore.getState().set(states)
      })
      .catch(() => undefined)

    return () => {
      alive = false
    }
  }, [enabled])
}

export async function setTweak(id: string, on: boolean): Promise<void> {
  const store = useTweaksStore.getState()
  store.markBusy(id, true)

  try {
    const states = await bridge.invoke('windows:setTweak', { id, on })
    useTweaksStore.getState().set(states)
  } catch {
    /* empty */
  } finally {
    useTweaksStore.getState().markBusy(id, false)
  }
}

export function useTweaks(): Readonly<Record<string, boolean>> {
  return useTweaksStore((s) => s.states)
}

export function useTweaksLoaded(): boolean {
  return useTweaksStore((s) => s.loaded)
}

export function useTweakBusy(id: string): boolean {
  return useTweaksStore((s) => s.busy.has(id))
}
