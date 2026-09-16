import { withExtras } from '@pulse/utils'
import {
  CATALOG_VERSION,
  catalogOf,
  SEED_CATALOG,
  type Catalog,
  type Category,
  type CatalogPayload,
  type Program,
} from '@pulse/domain'

export class LiveCatalog implements Catalog {
  private base: Catalog = SEED_CATALOG
  private extras: readonly Program[] = []
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
    this.base = catalogOf(
      payload.programs as readonly Program[],
      payload.categories as readonly Category[],
      payload.bundles,
    )
    this.republish()
  }

  setExtras(extras: readonly Program[]): void {
    this.extras = extras
    this.republish()
  }

  hasPublished(id: string): boolean {
    return this.base.byId.has(id)
  }

  myPrograms(): readonly Program[] {
    return this.extras
  }

  private republish(): void {
    this.inner = withExtras(this.base, this.extras)
  }
}
