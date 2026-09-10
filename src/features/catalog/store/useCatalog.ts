import { useEffect } from 'react'
import { create } from 'zustand'
import {
  getBundles,
  getCategories,
  getProgram,
  getPrograms,
  setCatalog,
  type Bundle,
  type Catalog,
  type CatalogSource,
  type CatalogState,
  type Category,
  type Program,
} from '@shared/domain/catalog'
import { bridge } from '@/shared/lib/bridge'

export type CatalogPhase = 'looking' | 'ready' | 'failed'

interface CatalogStore {
  revision: number
  phase: CatalogPhase
  source: CatalogSource
  adopt: (catalog: Catalog) => void
  settle: (state: CatalogState) => void
  looking: () => void
}

export const useCatalogStore = create<CatalogStore>((set) => ({
  revision: 0,
  phase: 'looking',
  source: 'none',
  adopt: (catalog) => {
    setCatalog(catalog)
    set((state) => ({ revision: state.revision + 1 }))
  },
  settle: (state) =>
    set({
      phase: state.programs > 0 ? 'ready' : 'failed',
      source: state.source,
    }),
  looking: () => set({ phase: 'looking' }),
}))

async function ask(): Promise<void> {
  const state = await bridge.invoke('catalog:state', undefined).catch(() => null)
  if (state) useCatalogStore.getState().settle(state)
}

export async function retryCatalog(): Promise<void> {
  useCatalogStore.getState().looking()

  const state = await bridge.invoke('catalog:retry', undefined).catch(() => null)
  if (state) useCatalogStore.getState().settle(state)
  else useCatalogStore.getState().settle({ source: 'none', checkedAt: null, programs: 0 })
}

export function useCatalogPhase(): CatalogPhase {
  return useCatalogStore((s) => s.phase)
}

export function useWatchCatalog(): void {
  useEffect(() => {
    let alive = true
    const stop = bridge.on('catalog:event', (catalog) => {
      useCatalogStore.getState().adopt(catalog)
      void ask()
    })

    void bridge
      .invoke('catalog:list', undefined)
      .then((catalog) => {
        if (alive) useCatalogStore.getState().adopt(catalog)
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) void ask()
      })

    return () => {
      alive = false
      stop()
    }
  }, [])
}

export function usePrograms(): readonly Program[] {
  return useCatalogStore(() => getPrograms())
}

export function useCategories(): readonly Category[] {
  return useCatalogStore(() => getCategories())
}

export function useBundles(): readonly Bundle[] {
  return useCatalogStore(() => getBundles())
}

export function useProgram(id: string | null): Program | undefined {
  return useCatalogStore(() => (id ? getProgram(id) : undefined))
}
