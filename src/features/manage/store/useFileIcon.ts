import { useEffect } from 'react'
import { create } from 'zustand'
import { bridge } from '@/shared/lib/bridge'

interface IconStore {
  icons: Readonly<Record<string, string | null>>
  set: (path: string, url: string | null) => void
}

const useIconStore = create<IconStore>((set) => ({
  icons: {},
  set: (path, url) => set((state) => ({ icons: { ...state.icons, [path]: url } })),
}))

const asked = new Set<string>()

/**
 * O ícone que o programa registrou no Windows, pedido uma vez por caminho. O
 * processo principal guarda o resultado, então voltar à tela não lê disco de
 * novo.
 */
export function useFileIcon(path: string | undefined): string | null {
  const url = useIconStore((state) => (path ? (state.icons[path] ?? null) : null))

  useEffect(() => {
    if (!path || asked.has(path)) return
    asked.add(path)

    void bridge
      .invoke('system:icon', { path })
      .then((found) => useIconStore.getState().set(path, found))
      .catch(() => useIconStore.getState().set(path, null))
  }, [path])

  return url
}
