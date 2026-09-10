import { beforeEach } from 'vitest'
import { setCatalog } from './shared/domain/catalog'
import { BUILTIN_CATALOG } from './shared/domain/catalog.seed'

setCatalog(BUILTIN_CATALOG)

beforeEach(() => {
  setCatalog(BUILTIN_CATALOG)
})
