import { useEffect } from 'react'
import { create } from 'zustand'
import { bridge } from '@/shared/lib/bridge'

interface IconStore {
  icons: Readonly<Record<string, string | null>>
  set: (path: string, url: string | null) => void
}

const useStore = create<IconStore>((set) => ({
  icons: {},
  set: (path, url) => set((state) => ({ icons: { ...state.icons, [path]: url } })),
}))

// Cada caminho é perguntado uma vez só na vida da janela: a lista de
// instalados repete o mesmo .exe em várias linhas, e extrair ícone é caro.
const asked = new Set<string>()

export function useFileIcon(path: string | undefined): string | null {
  const url = useStore((state) => (path ? (state.icons[path] ?? null) : null))

  useEffect(() => {
    if (!path || asked.has(path)) return
    asked.add(path)

    void bridge
      .invoke('system:icon', { path })
      .then((found) => useStore.getState().set(path, found))
      .catch(() => useStore.getState().set(path, null))
  }, [path])

  return url
}
