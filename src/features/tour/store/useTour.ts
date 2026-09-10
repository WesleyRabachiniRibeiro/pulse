import type { Screen } from '@/shared/ui/StepRail/screens'
import { useEffect } from 'react'
import { create } from 'zustand'
import { savePreference, usePreferences, usePreferencesLoaded } from '@/features/preferences'

export type TourContext = 'grid' | 'settings'

interface TourStore {
  open: boolean
  step: number
  context: TourContext
  targetScreen: Screen | null
  openTour: () => void
  closeTour: () => void
  goTo: (step: number) => void
  setContext: (context: TourContext) => void
  askScreen: (screen: Screen | null) => void
}

export const useTourStore = create<TourStore>((set) => ({
  open: false,
  step: 0,
  context: 'grid',
  targetScreen: null,
  openTour: () => set({ open: true, step: 0, targetScreen: 'home' }),
  closeTour: () => {
    void savePreference({ tourSeen: true })
    set({ open: false, targetScreen: null })
  },
  goTo: (step) => set({ step }),
  setContext: (context) => set({ context }),
  askScreen: (targetScreen) => set({ targetScreen }),
}))

export function useOpenOnFirstRun(): void {
  const loaded = usePreferencesLoaded()
  const seen = usePreferences().tourSeen

  useEffect(() => {
    if (!loaded || seen) return
    const t = setTimeout(() => useTourStore.getState().openTour(), 600)
    return () => clearTimeout(t)
  }, [loaded, seen])
}

export function useTour() {
  return useTourStore()
}
