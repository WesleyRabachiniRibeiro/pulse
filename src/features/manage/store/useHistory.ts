import { useEffect } from 'react'
import { create } from 'zustand'
import type { RunRecord } from '@shared/domain/history'
import { bridge } from '@/shared/lib/bridge'

interface HistoryStore {
  runs: RunRecord[]
  loaded: boolean
  set: (runs: RunRecord[]) => void
}

const useHistoryStore = create<HistoryStore>((set) => ({
  runs: [],
  loaded: false,
  set: (runs) => set({ runs, loaded: true }),
}))

export function useWatchHistory(trigger: unknown): void {
  useEffect(() => {
    let alive = true

    void bridge
      .invoke('history:read')
      .then((runs) => {
        if (alive) useHistoryStore.getState().set(runs)
      })
      .catch(() => {
        if (alive) useHistoryStore.getState().set([])
      })

    return () => {
      alive = false
    }
  }, [trigger])
}

export function useHistory(): RunRecord[] {
  return useHistoryStore((s) => s.runs)
}

export function useHistoryLoaded(): boolean {
  return useHistoryStore((s) => s.loaded)
}
