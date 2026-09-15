import { NodePowerShellRunner } from './infra/powershell/NodePowerShellRunner'
import { WindowsProcessRunner } from './infra/process/WindowsProcessRunner'
import { WingetPackageInstaller } from './infra/winget/WingetPackageInstaller'
import { WindowsToolchain } from './infra/toolchain/WindowsToolchain'
import { WindowsAutostartRegistry } from './infra/autostart/WindowsAutostartRegistry'
import { ElectronClipboardWriter } from './infra/electron/ElectronClipboardWriter'
import { ElectronIconReader } from './infra/electron/ElectronIconReader'
import { InMemoryQueueRepository } from './infra/queue/InMemoryQueueRepository'
import { QueueOrchestrator } from './application/queue/QueueOrchestrator'
import { registerInstallation } from './ipc/installation'

import { WindowsSystemInspector } from './infra/system/WindowsSystemInspector'
import { WindowsDiskSpaceProbe } from './infra/system/WindowsDiskSpaceProbe'
import { ElectronWindowsSettings } from './infra/system/ElectronWindowsSettings'
import { WindowsPowerController } from './infra/system/WindowsPowerController'
import { WingetPackageRepository } from './infra/catalog/WingetPackageRepository'
import { WindowsAutostartReader } from './infra/catalog/WindowsAutostartReader'
import { WindowsStartupEntries } from './infra/catalog/WindowsStartupEntries'
import { WindowsRegistryReader } from './infra/catalog/WindowsRegistryReader'
import { JsonCatalogCache } from './infra/catalog/JsonCatalogCache'
import { JsonCatalogExtras } from './infra/catalog/JsonCatalogExtras'
import { LiveCatalog } from './application/catalog/LiveCatalog'
import { SteamAdapter } from './infra/steam/SteamAdapter'
import { BrowserDefaultSetterAdapter } from './infra/browsers/BrowserDefaultSetterAdapter'
import { JsonPreferencesStore } from './infra/preferences/JsonPreferencesStore'
import { JsonEditorSettingsStore } from './infra/editor/JsonEditorSettingsStore'
import { NodePinSealer } from './infra/parental/NodePinSealer'
import { PreferencesParentalStore } from './infra/parental/PreferencesParentalStore'
import { RegistryWindowsTweaks } from './infra/windows/RegistryWindowsTweaks'
import { WindowsDesktopShortcut } from './infra/windows/WindowsDesktopShortcut'
import { ElectronFileDialog } from './infra/dialogs/ElectronFileDialog'
import { NodeRemoteFetch } from './infra/net/NodeRemoteFetch'
import { JsonHistoryStore } from './infra/history/JsonHistoryStore'
import { ElectronUpdateChecker } from './infra/updates/ElectronUpdateChecker'
import { ElectronNotificationPresenter, nameAppForWindows } from './infra/electron/ElectronNotificationPresenter'

import { RunSystemVerification } from './application/preflight/RunSystemVerification'
import { CatalogService } from './application/catalog/CatalogService'
import { ReadGitConfig } from './application/git/ReadGitConfig'
import { PreferencesService } from './application/preferences/PreferencesService'
import { ParentalService } from './application/parental/ParentalService'
import { ProfileService } from './application/profile/ProfileService'
import { HistoryService } from './application/history/HistoryService'
import { SteamService } from './application/steam/SteamService'
import { SystemService } from './application/system/SystemService'
import { UpdateService } from './application/updates/UpdateService'

import { registerPreflight } from './ipc/preflight'
import { registerCatalog } from './ipc/catalog'
import { registerSteam } from './ipc/steam'
import { registerPreferences } from './ipc/preferences'
import { registerParental } from './ipc/parental'
import { registerProfile } from './ipc/profile'
import { registerHistory } from './ipc/history'
import { registerSystem } from './ipc/system'
import { registerUpdates } from './ipc/updates'

export interface MainComponents {
  processRunner: WindowsProcessRunner
  queueOrchestrator: QueueOrchestrator
}

// Onde o catálogo publicado mora. Trocar isto troca o que o app oferece, sem
// recompilar nem republicar o instalador.
const CATALOG_URL =
  'https://raw.githubusercontent.com/WesleyRabachiniRibeiro/pulse/main/catalog.json'

export function composeMain(): MainComponents {
  nameAppForWindows()

  const catalog = new LiveCatalog()

  const powershellRunner = new NodePowerShellRunner()

  const processRunner = new WindowsProcessRunner(powershellRunner)
  const toolchain = new WindowsToolchain(powershellRunner, processRunner)
  const autostartRegistry = new WindowsAutostartRegistry(powershellRunner)
  const clipboardWriter = new ElectronClipboardWriter()
  const queueRepository = new InMemoryQueueRepository()

  const packageRepository = new WingetPackageRepository(catalog, powershellRunner, processRunner)
  const diskSpaceProbe = new WindowsDiskSpaceProbe(powershellRunner)
  const steamAdapter = new SteamAdapter(powershellRunner)
  const browserDefaultSetter = new BrowserDefaultSetterAdapter(powershellRunner, processRunner)

  const queueOrchestrator = new QueueOrchestrator(
    catalog,
    processRunner,
    new WingetPackageInstaller(processRunner),
    packageRepository,
    diskSpaceProbe,
    steamAdapter,
    browserDefaultSetter,
    autostartRegistry,
    new WindowsDesktopShortcut(powershellRunner),
    queueRepository,
    clipboardWriter,
    new JsonEditorSettingsStore(),
    toolchain,
  )

  const preferencesStore = new JsonPreferencesStore()
  const preferencesService = new PreferencesService(preferencesStore)

  registerInstallation(queueOrchestrator, preferencesService)

  const preflightService = new RunSystemVerification(
    new WindowsSystemInspector(powershellRunner),
    diskSpaceProbe,
  )
  registerPreflight(preflightService)

  const catalogService = new CatalogService(
    catalog,
    packageRepository,
    new WindowsAutostartReader(catalog, powershellRunner),
    processRunner,
    new WindowsStartupEntries(catalog, powershellRunner),
    new WindowsRegistryReader(powershellRunner),
    new JsonCatalogCache(),
    new NodeRemoteFetch(),
    CATALOG_URL,
    new JsonCatalogExtras(),
  )
  registerCatalog(catalogService, catalog)
  void catalogService.load()

  registerSteam(new SteamService(steamAdapter))


  registerParental(
    new ParentalService(new PreferencesParentalStore(preferencesStore), new NodePinSealer()),
  )
  const readGitConfig = new ReadGitConfig(toolchain)
  registerPreferences(preferencesService, readGitConfig)

  registerProfile(new ProfileService(catalog, new ElectronFileDialog(), new NodeRemoteFetch()))

  const systemService = new SystemService(
    new WindowsPowerController(processRunner),
    new RegistryWindowsTweaks(processRunner, powershellRunner),
    new ElectronWindowsSettings(),
    new ElectronIconReader(),
  )
  registerSystem(systemService)

  const updateService = new UpdateService(new ElectronUpdateChecker(), () => {
    const run = queueOrchestrator.currentState()
    return run !== null && run.finishedAt === null
  })
  registerUpdates(updateService)

  const historyService = new HistoryService(new JsonHistoryStore())
  registerHistory(historyService)
  queueOrchestrator.subscribe((run) => void historyService.onRunChanged(run))

  const notificationPresenter = new ElectronNotificationPresenter(catalog)
  queueOrchestrator.subscribe((run) => notificationPresenter.present(run))
  queueOrchestrator.subscribe(() => updateService.onQueueChanged())

  return { processRunner, queueOrchestrator }
}
