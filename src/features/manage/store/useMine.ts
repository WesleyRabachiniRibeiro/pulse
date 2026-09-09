import { useEffect } from 'react'
import { create } from 'zustand'
import { bridge } from '@/shared/lib/bridge'

interface MineStore {
  ids: ReadonlySet<string>
  set: (ids: readonly string[]) => void
}

const useMineStore = create<MineStore>((set) => ({
  ids: new Set<string>(),
  set: (ids) => set({ ids: new Set(ids) }),
}))

export async function reloadMine(): Promise<void> {
  const ids = await bridge.invoke('catalog:mine', undefined).catch((): string[] => [])
  useMineStore.getState().set(ids)
}

export function useWatchMine(trigger: unknown): void {
  useEffect(() => {
    void reloadMine()
  }, [trigger])
}

export function useMine(): ReadonlySet<string> {
  return useMineStore((s) => s.ids)
}
