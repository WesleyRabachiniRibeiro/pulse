import { useEffect } from 'react'
import { create } from 'zustand'
import { savePreference, usePreferencesStore } from '@/features/preferences/usePreferences'

export type Contexto = 'grade' | 'ajustes'

interface TourStore {
  aberto: boolean
  passo: number
  contexto: Contexto
  telaAlvo: number | null
  abrir: () => void
  fechar: () => void
  ir: (passo: number) => void
  definirContexto: (contexto: Contexto) => void
  pedirTela: (tela: number | null) => void
}

export const useTourStore = create<TourStore>((set) => ({
  aberto: false,
  passo: 0,
  contexto: 'grade',
  telaAlvo: null,
  abrir: () => set({ aberto: true, passo: 0, telaAlvo: 0 }),
  fechar: () => {
    void savePreference({ tourSeen: true })
    set({ aberto: false, telaAlvo: null })
  },
  ir: (passo) => set({ passo }),
  definirContexto: (contexto) => set({ contexto }),
  pedirTela: (telaAlvo) => set({ telaAlvo }),
}))

export function useAbrirNaPrimeiraVez(): void {
  const carregado = usePreferencesStore((s) => s.loaded)
  const jaViu = usePreferencesStore((s) => s.prefs.tourSeen)

  useEffect(() => {
    if (!carregado || jaViu) return
    const t = setTimeout(() => useTourStore.getState().abrir(), 600)
    return () => clearTimeout(t)
  }, [carregado, jaViu])
}

export function useTour() {
  return useTourStore()
}
