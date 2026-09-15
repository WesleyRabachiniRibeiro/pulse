import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Rollup } from 'vite'

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

// O zod publica dois `@__PURE__` logo depois de um comentário, e o Rollup não
// consegue ligar a anotação ao que vem a seguir. Ele mesmo resolve — descarta o
// comentário e segue —, mas avisa três vezes por build, uma por compilação.
// Conferido: a 4.6.5 tem os mesmos comentários nas mesmas posições, então subir
// de versão não cala nada, e o `@__PURE__` chega intacto ao bundle.
//
// O filtro é estreito de propósito: só este código de aviso, e só vindo de
// node_modules. Aviso do nosso código, inclusive este mesmo, continua passando.
function quietVendorAnnotations(
  warning: Rollup.RollupLog,
  next: Rollup.LoggingFunction,
): void {
  const from = warning.id ?? warning.loc?.file ?? ''
  if (warning.code === 'INVALID_ANNOTATION' && from.includes('node_modules')) return
  next(warning)
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: WORKSPACE_PACKAGES })],
    build: {
      // O nome de saída vem do basename da entrada: o electron-vite sobrescreve
      // entryFileNames com '[name].mjs' depois do merge, então
      // build.lib.fileName é ignorado. Por isso a entrada precisa ser index.ts.
      lib: { entry: resolve(__dirname, 'src/main/index.ts') },
      rollupOptions: { onwarn: quietVendorAnnotations },
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
      rollupOptions: {
        output: { entryFileNames: 'index.cjs' },
        onwarn: quietVendorAnnotations,
      },
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
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html'),
        onwarn: quietVendorAnnotations,
      },
    },
  },
})
