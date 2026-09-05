import { create } from 'zustand'
import { settingsAreEmpty, type Settings } from '@shared/domain/settings'

interface SelectionStore {
  selected: ReadonlySet<string>
  drives: Readonly<Record<string, string>>
  settings: Readonly<Record<string, Settings>>
  toggle: (id: string) => void
  applyBundle: (ids: readonly string[]) => void
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
