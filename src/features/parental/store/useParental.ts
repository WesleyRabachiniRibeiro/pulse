import { useEffect } from 'react'
import { create } from 'zustand'
import { bridge } from '@/shared/lib/bridge'

export interface ParentalView {
  on: boolean
  hasPin: boolean
  blocked: string[]
}

const EMPTY: ParentalView = { on: false, hasPin: false, blocked: [] }

interface ParentalStore {
  view: ParentalView
  loaded: boolean
  set: (view: ParentalView) => void
}

const useStore = create<ParentalStore>((set) => ({
  view: EMPTY,
  loaded: false,
  set: (view) => set({ view, loaded: true }),
}))

export async function reloadParental(): Promise<void> {
  const view = await bridge.invoke('parental:read').catch(() => EMPTY)
  useStore.getState().set(view)
}

export function useLoadParental(): void {
  useEffect(() => {
    void reloadParental()
  }, [])
}

export function useParental(): ParentalView {
  return useStore((s) => s.view)
}

export function applyParental(view: ParentalView): void {
  useStore.getState().set(view)
}

export function useLockedNow(): boolean {
  return useStore((s) => s.view.on && s.view.hasPin)
}

export function useIsBlocked(id: string): boolean {
  return useStore((s) => s.view.on && s.view.hasPin && s.view.blocked.includes(id))
}
