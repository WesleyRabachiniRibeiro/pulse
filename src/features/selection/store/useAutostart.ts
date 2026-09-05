import { useEffect } from 'react'
import { create } from 'zustand'
import { bridge } from '@/shared/lib/bridge'

export type AutostartState = 'on' | 'off'

interface AutostartStore {
  states: Readonly<Record<string, AutostartState>>
  loaded: boolean
  set: (states: Record<string, AutostartState>) => void
}

export const useAutostartStore = create<AutostartStore>((set) => ({
  states: {},
  loaded: false,
  set: (states) => set({ states, loaded: true }),
}))

export async function reloadAutostart(): Promise<void> {
  try {
    const list = await bridge.invoke('catalog:autostart', undefined)
    useAutostartStore.getState().set(Object.fromEntries(list.map((i) => [i.id, i.state])))
  } catch {
    useAutostartStore.getState().set({})
  }
}

export function useWatchAutostart(trigger: unknown): void {
  useEffect(() => {
    void reloadAutostart()
  }, [trigger])
}

export function useAutostart(): Readonly<Record<string, AutostartState>> {
  return useAutostartStore((s) => s.states)
}
