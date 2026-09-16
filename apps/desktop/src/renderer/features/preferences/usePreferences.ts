import { useEffect } from 'react'
import { create } from 'zustand'
import { EMPTY_DEFAULTS, type Defaults, type Preferences } from '@pulse/domain'
import { bridge } from '@/shared/lib/bridge'

interface PreferencesStore {
  prefs: Preferences
  loaded: boolean
  set: (prefs: Preferences) => void
}

export const usePreferencesStore = create<PreferencesStore>((set) => ({
  prefs: {},
  loaded: false,
  set: (prefs) => set({ prefs, loaded: true }),
}))

export function useLoadPreferences(): void {
  useEffect(() => {
    let alive = true
    void bridge
      .invoke('prefs:read', undefined)
      .then((prefs) => {
        if (alive) usePreferencesStore.getState().set(prefs)
      })
      .catch(() => {
        if (alive) usePreferencesStore.getState().set({})
      })
    return () => {
      alive = false
    }
  }, [])
}

export async function savePreference(change: Preferences): Promise<void> {
  const current = usePreferencesStore.getState().prefs
  usePreferencesStore.getState().set({ ...current, ...change })
  try {
    const saved = await bridge.invoke('prefs:write', change)
    usePreferencesStore.getState().set(saved)
  } catch {
  }
}

export function usePreferences(): Preferences {
  return usePreferencesStore((s) => s.prefs)
}

export function useDefaults(): Defaults {
  return usePreferencesStore((s) => s.prefs.defaults ?? EMPTY_DEFAULTS)
}

export function usePreferencesLoaded(): boolean {
  return usePreferencesStore((s) => s.loaded)
}
