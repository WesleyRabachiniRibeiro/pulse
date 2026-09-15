import { useEffect } from 'react'
import { create } from 'zustand'
import type { InstalledNode, Program, StartupEntry, Upgrade } from '@pulse/domain'
import { bridge } from '@/shared/lib/bridge'

interface InventoryStore {
  installed: readonly InstalledNode[]
  hidden: number
  upgrades: readonly Upgrade[]
  startup: readonly StartupEntry[]
  mine: ReadonlySet<string>
  loaded: boolean
  busy: boolean
  set: (patch: Partial<InventoryStore>) => void
}

const useStore = create<InventoryStore>((set) => ({
  installed: [],
  hidden: 0,
  upgrades: [],
  startup: [],
  mine: new Set<string>(),
  loaded: false,
  busy: false,
  set: (patch) => set(patch),
}))

// As quatro leituras saem juntas porque a tela mostra a contagem das quatro
// abas de uma vez; adiar as outras deixaria três contadores em branco.
export async function reloadInventory(): Promise<void> {
  if (useStore.getState().busy) return
  useStore.getState().set({ busy: true })

  const [tree, upgrades, startup, mine] = await Promise.all([
    bridge.invoke('catalog:tree', undefined).catch(() => ({ nodes: [], hidden: 0 })),
    bridge.invoke('catalog:upgrades', undefined).catch((): readonly Upgrade[] => []),
    bridge.invoke('catalog:startup', undefined).catch((): readonly StartupEntry[] => []),
    bridge.invoke('catalog:mine', undefined).catch((): readonly Program[] => []),
  ])

  useStore.getState().set({
    installed: tree.nodes,
    hidden: tree.hidden,
    upgrades,
    startup,
    mine: new Set(mine.map((one) => one.id)),
    loaded: true,
    busy: false,
  })
}

export function useWatchInventory(): void {
  useEffect(() => {
    if (!useStore.getState().loaded) void reloadInventory()
  }, [])
}

export function useInstalled(): readonly InstalledNode[] {
  return useStore((s) => s.installed)
}

export function useHiddenCount(): number {
  return useStore((s) => s.hidden)
}

export function useUpgrades(): readonly Upgrade[] {
  return useStore((s) => s.upgrades)
}

export function useStartup(): readonly StartupEntry[] {
  return useStore((s) => s.startup)
}

export function useMine(): ReadonlySet<string> {
  return useStore((s) => s.mine)
}

export function useInventoryLoaded(): boolean {
  return useStore((s) => s.loaded)
}

export function useInventoryBusy(): boolean {
  return useStore((s) => s.busy)
}

export function setStartupEntries(entries: readonly StartupEntry[]): void {
  useStore.getState().set({ startup: entries })
}

export async function dropFromCatalog(id: string): Promise<void> {
  const mine = await bridge.invoke('catalog:remove', { id }).catch(() => null)
  if (!mine) return
  useStore.getState().set({ mine: new Set(mine.map((one) => one.id)) })
  void reloadInventory()
}
