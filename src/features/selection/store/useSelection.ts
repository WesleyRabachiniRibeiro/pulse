import { useEffect } from 'react'
import { create } from 'zustand'
import { settingsAreEmpty, type Settings } from '@shared/domain/settings'
import { EMPTY_PROFILE, type Profile } from '@shared/domain/profile'
import { bridge } from '@/shared/lib/bridge'

interface SelectionStore {
  selected: ReadonlySet<string>
  drives: Readonly<Record<string, string>>
  settings: Readonly<Record<string, Settings>>
  loaded: boolean
  toggle: (id: string) => void
  applyBundle: (ids: readonly string[]) => void
  setDrive: (id: string, drive: string | null) => void
  setSettings: (id: string, settings: Settings) => void
  hydrate: (profile: Profile) => void
  clear: () => void
}

export const useSelection = create<SelectionStore>((set) => ({
  selected: new Set<string>(),
  drives: {},
  settings: {},
  loaded: false,

  toggle: (id) =>
    set((state) => {
      const next = new Set(state.selected)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selected: next }
    }),

  applyBundle: (ids) => set({ selected: new Set(ids) }),

  setDrive: (id, drive) =>
    set((state) => {
      const drives = { ...state.drives }
      if (drive) drives[id] = drive
      else delete drives[id]
      return { drives }
    }),

  setSettings: (id, settings) =>
    set((state) => {
      const next = { ...state.settings }
      if (settingsAreEmpty(settings)) delete next[id]
      else next[id] = settings
      return { settings: next }
    }),

  hydrate: (profile) =>
    set({
      selected: new Set(profile.selected),
      drives: { ...profile.drives },
      settings: { ...profile.settings },
      loaded: true,
    }),

  clear: () => set({ selected: new Set<string>(), drives: {}, settings: {} }),
}))

const SAVE_DELAY_MS = 400

let pendingSave: ReturnType<typeof setTimeout> | null = null
let hydrating = false

function snapshot(): Profile {
  const { selected, drives, settings } = useSelection.getState()
  return { selected: [...selected], drives: { ...drives }, settings: { ...settings } }
}

function scheduleSave(): void {
  if (pendingSave) clearTimeout(pendingSave)
  pendingSave = setTimeout(() => {
    pendingSave = null
    void bridge.invoke('profile:write', snapshot()).catch(() => undefined)
  }, SAVE_DELAY_MS)
}

useSelection.subscribe((state, previous) => {
  if (!state.loaded || hydrating) return
  const untouched =
    state.selected === previous.selected &&
    state.drives === previous.drives &&
    state.settings === previous.settings
  if (untouched) return
  scheduleSave()
})

function hydrate(profile: Profile): void {
  hydrating = true
  useSelection.getState().hydrate(profile)
  hydrating = false
}

export function useLoadSelection(): void {
  useEffect(() => {
    let alive = true

    bridge
      .invoke('profile:read', undefined)
      .then((profile) => {
        if (alive) hydrate(profile)
      })
      .catch(() => {
        if (alive) hydrate(EMPTY_PROFILE)
      })

    return () => {
      alive = false
    }
  }, [])
}

export function useSelectionLoaded(): boolean {
  return useSelection((state) => state.loaded)
}
