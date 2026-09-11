export interface CatalogPackageReader {
  listInstalled(fresh?: boolean): Promise<string[]>
}
