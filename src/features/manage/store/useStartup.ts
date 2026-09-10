import { useEffect } from 'react'
import { create } from 'zustand'
import type { StartupEntry } from '@shared/domain/windows'
import { bridge } from '@/shared/lib/bridge'

interface StartupStore {
  entries: readonly StartupEntry[]
  loaded: boolean
  busy: ReadonlySet<string>
  set: (entries: readonly StartupEntry[]) => void
  markBusy: (name: string, busy: boolean) => void
}

export const useStartupStore = create<StartupStore>((set) => ({
  entries: [],
  loaded: false,
  busy: new Set<string>(),

  set: (entries) => set({ entries, loaded: true }),

  markBusy: (name, busy) =>
    set((state) => {
      const next = new Set(state.busy)
      if (busy) next.add(name)
      else next.delete(name)
      return { busy: next }
    }),
}))

export function useWatchStartup(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    let alive = true

    void bridge
      .invoke('catalog:startup')
      .then((entries) => {
        if (alive) useStartupStore.getState().set(entries)
      })
      .catch(() => undefined)

    return () => {
      alive = false
    }
  }, [enabled])
}

export async function setStartup(name: string, on: boolean): Promise<void> {
  useStartupStore.getState().markBusy(name, true)

  try {
    const entries = await bridge.invoke('catalog:setStartup', { name, on })
    useStartupStore.getState().set(entries)
  } catch {} finally {
    useStartupStore.getState().markBusy(name, false)
  }
}

export function useStartup(): readonly StartupEntry[] {
  return useStartupStore((s) => s.entries)
}

export function useStartupLoaded(): boolean {
  return useStartupStore((s) => s.loaded)
}

export function useStartupBusy(name: string): boolean {
  return useStartupStore((s) => s.busy.has(name))
}
