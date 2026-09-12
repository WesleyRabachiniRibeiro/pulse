import { create } from 'zustand'
import { SEED_CATALOG, type Catalog } from '@pulse/domain'

interface CatalogStore {
  catalog: Catalog
  set: (catalog: Catalog) => void
}

// Hoje começa e fica na semente versionada. Quando a origem remota entrar, é
// esta função que passa a ser chamada, e nenhuma tela muda por causa disso.
const useStore = create<CatalogStore>((set) => ({
  catalog: SEED_CATALOG,
  set: (catalog) => set({ catalog }),
}))

export function useCatalog(): Catalog {
  return useStore((s) => s.catalog)
}

export function currentCatalog(): Catalog {
  return useStore.getState().catalog
}

export function setCatalog(catalog: Catalog): void {
  useStore.getState().set(catalog)
}
