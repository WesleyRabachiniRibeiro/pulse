import type { Upgrade } from '@pulse/domain'

export interface CatalogPackageReader {
  listInstalled(fresh?: boolean): Promise<string[]>

  listUpgrades(): Promise<readonly Upgrade[]>
}
