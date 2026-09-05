import { useEffect } from 'react'
import { create } from 'zustand'
import { bridge } from '@/shared/lib/bridge'

interface InstalledStore {
  raw: ReadonlySet<string>
  removed: ReadonlySet<string>
  loaded: boolean
  failed: boolean
  set: (ids: readonly string[]) => void
  markRemoved: (id: string) => void
  markFailed: () => void
}

export const useInstalledStore = create<InstalledStore>((set) => ({
  raw: new Set<string>(),
  removed: new Set<string>(),
  loaded: false,
  failed: false,

  set: (ids) =>
    set((state) => {
      const raw = new Set(ids)
      const removed = new Set([...state.removed].filter((id) => raw.has(id)))
      return { raw, removed, loaded: true, failed: false }
    }),

  markRemoved: (id) => set((state) => ({ removed: new Set([...state.removed, id]) })),

  markFailed: () => set({ loaded: true, failed: true }),
}))

export async function reloadInstalled(): Promise<void> {
  try {
    const ids = await bridge.invoke('catalog:installed', undefined)
    useInstalledStore.getState().set(ids)
  } catch {
    useInstalledStore.getState().markFailed()
  }
}

export function onUninstalled(id: string): void {
  useInstalledStore.getState().markRemoved(id)
  void reloadInstalled()
  setTimeout(() => void reloadInstalled(), 6000)
}

export function useWatchInstalled(trigger: unknown): void {
  useEffect(() => {
    void reloadInstalled()
  }, [trigger])
}

export function useInstalled(): ReadonlySet<string> {
  const raw = useInstalledStore((s) => s.raw)
  const removed = useInstalledStore((s) => s.removed)
  if (removed.size === 0) return raw
  return new Set([...raw].filter((id) => !removed.has(id)))
}

export function useInstalledLoaded(): boolean {
  return useInstalledStore((s) => s.loaded)
}

export function useInstalledFailed(): boolean {
  return useInstalledStore((s) => s.failed)
}
