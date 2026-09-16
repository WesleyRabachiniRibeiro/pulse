import { useEffect } from 'react'
import { create } from 'zustand'
import { catalogOf, SEED_CATALOG, type Catalog, type CatalogState } from '@pulse/domain'
import type { Category, Program } from '@pulse/domain'
import { bridge } from '@/shared/lib/bridge'

const STARTING: CatalogState = { source: 'seed', checkedAt: null, loading: true }

interface CatalogStore {
  catalog: Catalog
  state: CatalogState
  set: (catalog: Catalog) => void
  setState: (state: CatalogState) => void
}

const useStore = create<CatalogStore>((set) => ({
  catalog: SEED_CATALOG,
  state: STARTING,
  set: (catalog) => set({ catalog }),
  setState: (state) => set({ state }),
}))

async function pull(): Promise<void> {
  const payload = await bridge.invoke('catalog:payload', undefined).catch(() => null)
  if (!payload) return

  useStore.getState().set(
    catalogOf(
      payload.programs as readonly Program[],
      payload.categories as readonly Category[],
      payload.bundles,
    ),
  )
}

export function useWatchCatalog(): void {
  useEffect(() => {
    const unsubscribe = bridge.on('catalog:event', (state) => {
      useStore.getState().setState(state)
      void pull()
    })

    void bridge
      .invoke('catalog:state', undefined)
      .then(useStore.getState().setState)
      .catch(() => undefined)
    void pull()

    return unsubscribe
  }, [])
}

export function useCatalog(): Catalog {
  return useStore((s) => s.catalog)
}

export function useCatalogState(): CatalogState {
  return useStore((s) => s.state)
}

export function currentCatalog(): Catalog {
  return useStore.getState().catalog
}

export function retryCatalog(): void {
  void bridge.invoke('catalog:retry', undefined).catch(() => undefined)
}
