import { useEffect } from 'react'
import { create } from 'zustand'
import { bridge } from '@/shared/lib/bridge'

interface OpenStore {
  openable: ReadonlySet<string>
  loaded: boolean
  busy: ReadonlySet<string>
  missing: ReadonlySet<string>
  set: (ids: readonly string[]) => void
  markBusy: (id: string, busy: boolean) => void
  markMissing: (id: string) => void
}

export const useOpenStore = create<OpenStore>((set) => ({
  openable: new Set<string>(),
  loaded: false,
  busy: new Set<string>(),
  missing: new Set<string>(),

  set: (ids) => set({ openable: new Set(ids), loaded: true }),

  markBusy: (id, busy) =>
    set((state) => {
      const next = new Set(state.busy)
      if (busy) next.add(id)
      else next.delete(id)
      return { busy: next }
    }),

  markMissing: (id) => set((state) => ({ missing: new Set([...state.missing, id]) })),
}))

export function reloadOpenable(): void {
  void bridge
    .invoke('installation:openable', undefined)
    .then((ids) => useOpenStore.getState().set(ids))
    .catch(() => undefined)
}

export function useWatchOpenable(trigger: unknown): void {
  useEffect(() => {
    reloadOpenable()
  }, [trigger])
}

export async function openProgram(id: string): Promise<void> {
  const store = useOpenStore.getState()
  store.markBusy(id, true)

  try {
    const result = await bridge.invoke('installation:open', { id })
    if (result !== 'opened') useOpenStore.getState().markMissing(id)
  } catch {
    useOpenStore.getState().markMissing(id)
  } finally {
    useOpenStore.getState().markBusy(id, false)
  }
}

export function useCanOpen(id: string): boolean {
  return useOpenStore((s) => s.openable.has(id) && !s.missing.has(id))
}

export function useOpening(id: string): boolean {
  return useOpenStore((s) => s.busy.has(id))
}
