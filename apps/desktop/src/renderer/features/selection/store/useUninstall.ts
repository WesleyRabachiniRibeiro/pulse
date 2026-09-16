import { create } from 'zustand'
import { bridge } from '@/shared/lib/bridge'
import { onUninstalled } from './useInstalled'

const FALLBACK = 'Não foi possível desinstalar.'

interface UninstallStore {
  running: ReadonlySet<string>
  done: ReadonlySet<string>
  errors: Readonly<Record<string, string>>
  begin: (id: string) => void
  succeed: (id: string) => void
  fail: (id: string, message: string) => void
  forget: (id: string) => void
}

const useUninstallStore = create<UninstallStore>((set) => ({
  running: new Set<string>(),
  done: new Set<string>(),
  errors: {},

  begin: (id) =>
    set((state) => {
      const errors = { ...state.errors }
      delete errors[id]
      return { running: new Set([...state.running, id]), errors }
    }),

  succeed: (id) =>
    set((state) => ({
      running: new Set([...state.running].filter((x) => x !== id)),
      done: new Set([...state.done, id]),
    })),

  fail: (id, message) =>
    set((state) => ({
      running: new Set([...state.running].filter((x) => x !== id)),
      errors: { ...state.errors, [id]: message },
    })),

  forget: (id) =>
    set((state) => {
      const errors = { ...state.errors }
      delete errors[id]
      return { errors }
    }),
}))

export async function uninstallProgram(id: string): Promise<void> {
  const store = useUninstallStore.getState()
  if (store.running.has(id)) return
  store.begin(id)

  try {
    const result = await bridge.invoke('installation:uninstall', { id })

    if (result.verified) {
      useUninstallStore.getState().succeed(id)
      onUninstalled(id)
      return
    }

    useUninstallStore.getState().fail(id, result.error ?? FALLBACK)
  } catch (e) {
    useUninstallStore.getState().fail(id, e instanceof Error ? e.message : FALLBACK)
  }
}

export function forgetUninstallError(id: string): void {
  useUninstallStore.getState().forget(id)
}

export function useUninstalling(id: string): boolean {
  return useUninstallStore((s) => s.running.has(id))
}

export function useUninstalled(id: string): boolean {
  return useUninstallStore((s) => s.done.has(id))
}

export function useUninstallError(id: string): string | null {
  return useUninstallStore((s) => s.errors[id] ?? null)
}
