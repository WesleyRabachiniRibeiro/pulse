export interface FoundPackage {
  winget: string
  name: string
  version: string
}

export interface PackageFinder {
  search(name: string): Promise<FoundPackage | null>
}
