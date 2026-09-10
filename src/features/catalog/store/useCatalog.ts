import { useEffect } from 'react'
import { create } from 'zustand'
import {
  getBundles,
  getCategories,
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
  programs: readonly Program[]
  categories: readonly Category[]
  bundles: readonly Bundle[]
  byId: ReadonlyMap<string, Program>
  phase: CatalogPhase
  source: CatalogSource
  adopt: (catalog: Catalog) => void
  settle: (state: CatalogState) => void
  looking: () => void
}

function readRegistry() {
  const programs = getPrograms()
  return {
    programs,
    categories: getCategories(),
    bundles: getBundles(),
    byId: new Map(programs.map((program) => [program.id, program])),
  }
}

export const useCatalogStore = create<CatalogStore>((set) => ({
  ...readRegistry(),
  phase: 'looking',
  source: 'none',
  adopt: (catalog) => {
    setCatalog(catalog)
    set(readRegistry())
  },
  settle: (state) =>
    set({
      phase: state.programs > 0 ? 'ready' : 'failed',
      source: state.source,
    }),
  looking: () => set({ phase: 'looking' }),
}))

async function ask(): Promise<void> {
  const state = await bridge.invoke('catalog:state').catch(() => null)
  if (state) useCatalogStore.getState().settle(state)
}

export async function retryCatalog(): Promise<void> {
  useCatalogStore.getState().looking()

  const state = await bridge.invoke('catalog:retry').catch(() => null)
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
      .invoke('catalog:list')
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
  return useCatalogStore((s) => s.programs)
}

export function useCategories(): readonly Category[] {
  return useCatalogStore((s) => s.categories)
}

export function useBundles(): readonly Bundle[] {
  return useCatalogStore((s) => s.bundles)
}

export function useProgram(id: string | null): Program | undefined {
  return useCatalogStore((s) => (id ? s.byId.get(id) : undefined))
}
