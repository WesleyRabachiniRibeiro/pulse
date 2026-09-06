import { useEffect } from 'react'
import { create } from 'zustand'
import { EMPTY_UPDATE, type UpdateState } from '@shared/domain/update'
import { bridge } from '@/shared/lib/bridge'

interface UpdateStore {
  state: UpdateState
  set: (state: UpdateState) => void
}

const useUpdateStore = create<UpdateStore>((set) => ({
  state: EMPTY_UPDATE,
  set: (state) => set({ state }),
}))

export function useWatchUpdate(): void {
  useEffect(() => {
    const set = useUpdateStore.getState().set
    const unsubscribe = bridge.on('update:event', set)
    void bridge.invoke('update:state', undefined).then(set).catch(() => undefined)
    return unsubscribe
  }, [])
}

export function useUpdate(): UpdateState {
  return useUpdateStore((s) => s.state)
}

export async function installUpdate(): Promise<void> {
  await bridge.invoke('update:install', undefined).catch(() => undefined)
}
