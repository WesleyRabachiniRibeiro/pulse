export interface SteamGameRequester {
  isSignedIn(): Promise<boolean>
  hasManifest(appid: string): Promise<boolean>
  isInstallDialogOpen(): Promise<boolean>
}
