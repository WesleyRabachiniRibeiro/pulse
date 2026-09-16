export interface PackageRepository {
  isInstalled(id: string): Promise<boolean>
  quietUninstallCommands(id: string): Promise<string[]>
  forgetCache(): void
}
