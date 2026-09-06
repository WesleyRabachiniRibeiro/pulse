import { useEffect } from 'react'
import { create } from 'zustand'
import type { Drive } from '@shared/domain/preflight'
import { bridge } from '@/shared/lib/bridge'

interface DrivesStore {
  drives: readonly Drive[]
  loaded: boolean
  set: (drives: readonly Drive[]) => void
}

export const useDrivesStore = create<DrivesStore>((set) => ({
  drives: [],
  loaded: false,
  set: (drives) => set({ drives, loaded: true }),
}))

export function useWatchDrives(): void {
  useEffect(() => {
    let alive = true
    void bridge
      .invoke('preflight:drives', {})
      .then((drives) => {
        if (alive) useDrivesStore.getState().set(drives)
      })
      .catch(() => {
      })
    return () => {
      alive = false
    }
  }, [])
}

export function useDrives(): readonly Drive[] {
  return useDrivesStore((s) => s.drives)
}
