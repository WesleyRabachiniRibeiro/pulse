import { useEffect } from 'react'
import { create } from 'zustand'
import { savePreference, usePreferencesStore } from '@/features/preferences/usePreferences'

export type Context = 'grid' | 'settings'

interface TourStore {
  open: boolean
  step: number
  context: Context
  targetScreen: number | null
  openTour: () => void
  close: () => void
  go: (step: number) => void
  setContext: (context: Context) => void
  requestScreen: (screen: number | null) => void
}

export const useTourStore = create<TourStore>((set) => ({
  open: false,
  step: 0,
  context: 'grid',
  targetScreen: null,
  openTour: () => set({ open: true, step: 0, targetScreen: 0 }),
  close: () => {
    void savePreference({ tourSeen: true })
    set({ open: false, targetScreen: null })
  },
  go: (step) => set({ step }),
  setContext: (context) => set({ context }),
  requestScreen: (targetScreen) => set({ targetScreen }),
}))

export function useOpenOnFirstVisit(): void {
  const loaded = usePreferencesStore((s) => s.loaded)
  const alreadySeen = usePreferencesStore((s) => s.prefs.tourSeen)

  useEffect(() => {
    if (!loaded || alreadySeen) return
    const t = setTimeout(() => useTourStore.getState().openTour(), 600)
    return () => clearTimeout(t)
  }, [loaded, alreadySeen])
}

export function useTour() {
  return useTourStore()
}
