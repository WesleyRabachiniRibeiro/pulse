import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// O renderer entrou aqui por causa do teste de cobertura dos ícones: o que ele
// checa não é componente, é que todo programa do catálogo tenha desenho e cor.
// Roda em 'node' porque nada disso precisa de DOM.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src/renderer', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/main/**/*.test.ts', 'src/renderer/**/*.test.ts'],
  },
})
