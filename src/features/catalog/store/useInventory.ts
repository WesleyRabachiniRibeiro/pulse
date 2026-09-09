import { useEffect } from 'react'
import { create } from 'zustand'
import { EMPTY_INVENTORY, type Inventory } from '@shared/domain/inventory'
import { bridge } from '@/shared/lib/bridge'

interface InventoryStore {
  inventory: Inventory
  loaded: boolean
  busy: boolean
  set: (inventory: Inventory) => void
  markBusy: (busy: boolean) => void
}

export const useInventoryStore = create<InventoryStore>((set) => ({
  inventory: EMPTY_INVENTORY,
  loaded: false,
  busy: false,
  set: (inventory) => set({ inventory, loaded: true, busy: false }),
  markBusy: (busy) => set({ busy }),
}))

export async function reloadInventory(fresh = false): Promise<void> {
  useInventoryStore.getState().markBusy(true)

  try {
    const inventory = await bridge.invoke('catalog:inventory', { fresh })
    useInventoryStore.getState().set(inventory)
  } catch {
    useInventoryStore.getState().markBusy(false)
  }
}

export function useWatchInventory(trigger: unknown, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    void reloadInventory()
  }, [trigger, enabled])
}

export function useInventory(): Inventory {
  return useInventoryStore((s) => s.inventory)
}

export function useInventoryLoaded(): boolean {
  return useInventoryStore((s) => s.loaded)
}

export function useInventoryBusy(): boolean {
  return useInventoryStore((s) => s.busy)
}

export function useUpdateCount(): number {
  return useInventoryStore((s) => s.inventory.upgrades.length)
}
