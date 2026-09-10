import type { Screen } from '@/shared/ui/StepRail/screens'
import { useEffect } from 'react'
import { create } from 'zustand'
import { savePreference, usePreferences, usePreferencesLoaded } from '@/features/preferences'

export type Contexto = 'grade' | 'ajustes'

interface TourStore {
  aberto: boolean
  passo: number
  contexto: Contexto
  telaAlvo: Screen | null
  abrir: () => void
  fechar: () => void
  ir: (passo: number) => void
  definirContexto: (contexto: Contexto) => void
  pedirTela: (tela: Screen | null) => void
}

export const useTourStore = create<TourStore>((set) => ({
  aberto: false,
  passo: 0,
  contexto: 'grade',
  telaAlvo: null,
  abrir: () => set({ aberto: true, passo: 0, telaAlvo: 'home' }),
  fechar: () => {
    void savePreference({ tourSeen: true })
    set({ aberto: false, telaAlvo: null })
  },
  ir: (passo) => set({ passo }),
  definirContexto: (contexto) => set({ contexto }),
  pedirTela: (telaAlvo) => set({ telaAlvo }),
}))

export function useAbrirNaPrimeiraVez(): void {
  const carregado = usePreferencesLoaded()
  const jaViu = usePreferences().tourSeen

  useEffect(() => {
    if (!carregado || jaViu) return
    const t = setTimeout(() => useTourStore.getState().abrir(), 600)
    return () => clearTimeout(t)
  }, [carregado, jaViu])
}

export function useTour() {
  return useTourStore()
}
