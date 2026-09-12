import { useEffect } from 'react'
import { create } from 'zustand'
import type { ParentalView } from '@pulse/ipc-contract'
import { bridge } from '@/shared/lib/bridge'

const EMPTY: ParentalView = { on: false, hasPin: false, blocked: [] }

interface ParentalStore {
  view: ParentalView
  set: (view: ParentalView) => void
}

const useStore = create<ParentalStore>((set) => ({
  view: EMPTY,
  set: (view) => set({ view }),
}))

export function useWatchParental(): void {
  useEffect(() => {
    void bridge
      .invoke('parental:read', undefined)
      .then(useStore.getState().set)
      .catch(() => undefined)
  }, [])
}

export function useParental(): ParentalView {
  return useStore((s) => s.view)
}

export function useIsBlocked(id: string): boolean {
  return useStore((s) => s.view.on && s.view.hasPin && s.view.blocked.includes(id))
}

// Só a resposta do main atualiza a tela. Um PIN recusado não mexe em nada,
// para a tela nunca mostrar um estado que o main não confirmou.
async function settle(result: Promise<{ ok: boolean; view?: ParentalView }>): Promise<boolean> {
  const { ok, view } = await result.catch(() => ({ ok: false, view: undefined }))
  if (view) useStore.getState().set(view)
  return ok
}

export function turnOnParental(pin: string): Promise<boolean> {
  return settle(bridge.invoke('parental:turnOn', { pin }))
}

export function turnOffParental(pin: string): Promise<boolean> {
  return settle(bridge.invoke('parental:turnOff', { pin }))
}

export function changeParentalPin(current: string, next: string): Promise<boolean> {
  return settle(bridge.invoke('parental:change', { current, next }))
}

export function checkParentalPin(pin: string): Promise<boolean> {
  return bridge.invoke('parental:check', { pin }).catch(() => false)
}

export async function setParentalBlocked(ids: readonly string[]): Promise<void> {
  const view = await bridge
    .invoke('parental:setBlocked', { ids: [...ids] })
    .catch(() => undefined)
  if (view) useStore.getState().set(view)
}
