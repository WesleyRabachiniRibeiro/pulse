import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const { version } = JSON.parse(
  readFileSync(resolve(__dirname, 'package.json'), 'utf8'),
) as { version: string }

// @pulse/domain, @pulse/catalog-data, @pulse/ipc-contract e @pulse/utils são
// pacotes do workspace, não dependências de verdade — precisam ser
// empacotados junto (não externalizados), senão o Electron tenta carregar o
// TypeScript deles direto via resolução nativa de ESM do Node em runtime, que
// não infere extensão em import relativo e quebra com ERR_MODULE_NOT_FOUND.
const WORKSPACE_PACKAGES = [
  '@pulse/domain',
  '@pulse/catalog-data',
  '@pulse/ipc-contract',
  '@pulse/utils',
]

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: WORKSPACE_PACKAGES })],
    build: {
      // O nome de saída vem do basename da entrada: o electron-vite sobrescreve
      // entryFileNames com '[name].mjs' depois do merge, então
      // build.lib.fileName é ignorado. Por isso a entrada precisa ser index.ts.
      lib: { entry: resolve(__dirname, 'src/main/index.ts') },
    },
  },
  // O preload roda dentro do sandbox do Chromium, que só executa CommonJS: um
  // .mjs morre com "Cannot use import statement outside a module" e o
  // contextBridge nunca expõe a ponte. Daí o formato cjs. Pelo mesmo motivo o
  // zod precisa entrar no bundle — no sandbox não há require de node_modules.
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: [...WORKSPACE_PACKAGES, 'zod'] })],
    build: {
      lib: { entry: resolve(__dirname, 'src/preload/index.ts'), formats: ['cjs'] },
      rollupOptions: { output: { entryFileNames: 'index.cjs' } },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react()],
    define: { __APP_VERSION__: JSON.stringify(version) },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer'),
      },
    },
    build: {
      rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') },
    },
  },
})
