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
  type Category,
  type Program,
} from '@shared/domain/catalog'
import { bridge } from '@/shared/lib/bridge'

interface CatalogStore {
  revision: number
  adopt: (catalog: Catalog) => void
}

export const useCatalogStore = create<CatalogStore>((set) => ({
  revision: 0,
  adopt: (catalog) => {
    setCatalog(catalog)
    set((state) => ({ revision: state.revision + 1 }))
  },
}))

export function useWatchCatalog(): void {
  useEffect(() => {
    let alive = true
    const stop = bridge.on('catalog:event', (catalog) => {
      useCatalogStore.getState().adopt(catalog)
    })

    void bridge
      .invoke('catalog:list', undefined)
      .then((catalog) => {
        if (alive) useCatalogStore.getState().adopt(catalog)
      })
      .catch(() => undefined)

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
