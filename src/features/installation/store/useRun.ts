import { useEffect } from 'react'
import { create } from 'zustand'
import type { Run } from '@shared/domain/installation'
import { bridge } from '@/shared/lib/bridge'

interface RunStore {
  run: Run | null
  set: (run: Run | null) => void
}

export const useRunStore = create<RunStore>((set) => ({
  run: null,
  set: (run) => set({ run }),
}))

export function useWatchInstallation(): void {
  useEffect(() => {
    const set = useRunStore.getState().set
    const unsubscribe = bridge.on('installation:event', set)
    void bridge.invoke('installation:state', undefined).then(set)
    return unsubscribe
  }, [])
}

export function useRun(): Run | null {
  return useRunStore((s) => s.run)
}
