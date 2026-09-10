import { beforeEach } from 'vitest'
import { setCatalog } from './shared/domain/catalog'
import { BUILTIN_CATALOG } from './shared/domain/catalog.seed'

// O app carrega o catálogo publicado ao abrir. Nos testes não há rede, então a
// semente entra no lugar: antes de importar cada arquivo, porque há teste que
// consulta o catálogo já na montagem, e de novo antes de cada caso.
setCatalog(BUILTIN_CATALOG)

beforeEach(() => {
  setCatalog(BUILTIN_CATALOG)
})
