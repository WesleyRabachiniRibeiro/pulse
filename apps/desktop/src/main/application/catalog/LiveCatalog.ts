import {
  CATALOG_VERSION,
  catalogOf,
  SEED_CATALOG,
  type Catalog,
  type Category,
  type CatalogPayload,
  type Program,
} from '@pulse/domain'

// Implementa Catalog lendo de dentro, então quem recebeu este objeto continua
// enxergando o catálogo atual sem saber que ele troca. Sem isso, todo serviço
// que guardou o valor no construtor ficaria com a semente para sempre.
export class LiveCatalog implements Catalog {
  private inner: Catalog = SEED_CATALOG

  get categories(): Catalog['categories'] {
    return this.inner.categories
  }

  get programs(): Catalog['programs'] {
    return this.inner.programs
  }

  get bundles(): Catalog['bundles'] {
    return this.inner.bundles
  }

  get byId(): Catalog['byId'] {
    return this.inner.byId
  }

  snapshot(): Catalog {
    return this.inner
  }

  payload(): CatalogPayload {
    return {
      pulse: CATALOG_VERSION,
      categories: [...this.inner.categories],
      programs: [...this.inner.programs] as CatalogPayload['programs'],
      bundles: this.inner.bundles.map((b) => ({ name: b.name, ids: [...b.ids] })),
    }
  }

  adopt(payload: CatalogPayload): void {
    this.inner = catalogOf(
      payload.programs as readonly Program[],
      payload.categories as readonly Category[],
      payload.bundles,
    )
  }
}
