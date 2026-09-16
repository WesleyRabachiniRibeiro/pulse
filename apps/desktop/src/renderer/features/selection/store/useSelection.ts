import { create } from 'zustand'
import { settingsAreEmpty, type Profile, type Settings } from '@pulse/domain'

interface SelectionStore {
  selected: ReadonlySet<string>
  drives: Readonly<Record<string, string>>
  settings: Readonly<Record<string, Settings>>
  toggle: (id: string) => void
  applyBundle: (ids: readonly string[]) => void
  setMany: (ids: readonly string[], on: boolean) => void
  setDrive: (id: string, drive: string | null) => void
  setSettings: (id: string, settings: Settings) => void
  clear: () => void
}

export const useSelection = create<SelectionStore>((set) => ({
  selected: new Set<string>(),
  drives: {},
  settings: {},

  toggle: (id) =>
    set((state) => {
      const next = new Set(state.selected)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selected: next }
    }),

  applyBundle: (ids) => set({ selected: new Set(ids) }),

  setMany: (ids, on) =>
    set((state) => {
      const selected = new Set(state.selected)
      for (const id of ids) {
        if (on) selected.add(id)
        else selected.delete(id)
      }
      return { selected }
    }),

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

  clear: () => set({ selected: new Set<string>(), drives: {}, settings: {} }),
}))

export function selectionAsProfile(): Profile {
  const { selected, drives, settings } = useSelection.getState()
  return {
    selected: [...selected],
    drives: { ...drives },
    settings: { ...settings },
  }
}

export function applyProfile(profile: Profile): void {
  useSelection.setState({
    selected: new Set(profile.selected),
    drives: { ...profile.drives },
    settings: { ...profile.settings },
  })
}
