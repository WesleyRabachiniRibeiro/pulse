import { useEffect } from 'react'
import { create } from 'zustand'
import { bridge } from '@/shared/lib/bridge'

interface OpenableStore {
  canOpen: ReadonlySet<string>
  opening: ReadonlySet<string>
  set: (ids: readonly string[]) => void
  mark: (id: string, busy: boolean) => void
}

const useStore = create<OpenableStore>((set) => ({
  canOpen: new Set<string>(),
  opening: new Set<string>(),
  set: (ids) => set({ canOpen: new Set(ids) }),
  mark: (id, busy) =>
    set((old) => {
      const opening = new Set(old.opening)
      if (busy) opening.add(id)
      else opening.delete(id)
      return { opening }
    }),
}))

export function useWatchOpenable(ids: readonly string[], when: unknown): void {
  const key = [...ids].sort().join(',')

  useEffect(() => {
    if (!key) return

    let alive = true
    void bridge
      .invoke('installation:openable', { ids: key.split(',') })
      .then((found) => {
        if (alive) useStore.getState().set(found)
      })
      .catch(() => undefined)

    return () => {
      alive = false
    }
  }, [key, when])
}

export function useCanOpen(id: string): boolean {
  return useStore((s) => s.canOpen.has(id))
}

export function useOpening(id: string): boolean {
  return useStore((s) => s.opening.has(id))
}

export async function openProgram(id: string): Promise<void> {
  useStore.getState().mark(id, true)
  const ok = await bridge.invoke('installation:open', { id }).catch(() => false)
  useStore.getState().mark(id, false)

  if (!ok) {
    useStore.getState().set([...useStore.getState().canOpen].filter((one) => one !== id))
  }
}
