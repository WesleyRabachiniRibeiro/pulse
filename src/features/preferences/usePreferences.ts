import { useEffect } from 'react'
import { create } from 'zustand'
import { defaultsOf, type Preferences } from '@shared/domain/preferences'
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

export async function savePreference(mudanca: Preferences): Promise<void> {
  const atual = usePreferencesStore.getState().prefs
  usePreferencesStore.getState().set({ ...atual, ...mudanca })
  try {
    const salvo = await bridge.invoke('prefs:write', mudanca)
    usePreferencesStore.getState().set(salvo)
  } catch {}
}

export function usePreferences(): Preferences {
  return usePreferencesStore((s) => s.prefs)
}

export function usePreferencesLoaded(): boolean {
  return usePreferencesStore((s) => s.loaded)
}

export function useDefaults(): ReturnType<typeof defaultsOf> {
  return usePreferencesStore((s) => defaultsOf(s.prefs))
}
