import { NodePowerShellRunner } from './infra/powershell/NodePowerShellRunner'
import { WindowsProcessRunner } from './infra/process/WindowsProcessRunner'
import { WingetPackageInstaller } from './infra/winget/WingetPackageInstaller'
import { WindowsAutostartRegistry } from './infra/autostart/WindowsAutostartRegistry'
import { ElectronClipboardWriter } from './infra/electron/ElectronClipboardWriter'
import { InMemoryQueueRepository } from './infra/queue/InMemoryQueueRepository'
import { QueueOrchestrator } from './application/queue/QueueOrchestrator'
import { registerInstallation } from './ipc/installation'

import { WindowsSystemInspector } from './infra/system/WindowsSystemInspector'
import { WindowsDiskSpaceProbe } from './infra/system/WindowsDiskSpaceProbe'
import { WindowsPowerController } from './infra/system/WindowsPowerController'
import { WingetPackageRepository } from './infra/catalog/WingetPackageRepository'
import { WindowsAutostartReader } from './infra/catalog/WindowsAutostartReader'
import { SteamAdapter } from './infra/steam/SteamAdapter'
import { BrowserDefaultSetterAdapter } from './infra/browsers/BrowserDefaultSetterAdapter'
import { JsonPreferencesStore } from './infra/preferences/JsonPreferencesStore'
import { ElectronUpdateChecker } from './infra/updates/ElectronUpdateChecker'
import { ElectronNotificationPresenter, nameAppForWindows } from './infra/electron/ElectronNotificationPresenter'

import { RunSystemVerification } from './application/preflight/RunSystemVerification'
import { CatalogService } from './application/catalog/CatalogService'
import { ReadGitConfig } from './application/git/ReadGitConfig'
import { PreferencesService } from './application/preferences/PreferencesService'
import { SteamService } from './application/steam/SteamService'
import { SystemService } from './application/system/SystemService'
import { UpdateService } from './application/updates/UpdateService'

import { registerPreflight } from './ipc/preflight'
import { registerCatalog } from './ipc/catalog'
import { registerSteam } from './ipc/steam'
import { registerPreferences } from './ipc/preferences'
import { registerSystem } from './ipc/system'
import { registerUpdates } from './ipc/updates'

export interface MainComponents {
  processRunner: WindowsProcessRunner
  queueOrchestrator: QueueOrchestrator
}

export function composeMain(): MainComponents {
  nameAppForWindows()

  const powershellRunner = new NodePowerShellRunner()
  const processRunner = new WindowsProcessRunner(powershellRunner)
  const autostartRegistry = new WindowsAutostartRegistry(powershellRunner)
  const clipboardWriter = new ElectronClipboardWriter()
  const queueRepository = new InMemoryQueueRepository()

  const packageRepository = new WingetPackageRepository(powershellRunner)
  const diskSpaceProbe = new WindowsDiskSpaceProbe(powershellRunner)
  const steamAdapter = new SteamAdapter(powershellRunner)
  const browserDefaultSetter = new BrowserDefaultSetterAdapter(powershellRunner, processRunner)

  const queueOrchestrator = new QueueOrchestrator(
    processRunner,
    new WingetPackageInstaller(processRunner),
    packageRepository,
    diskSpaceProbe,
    steamAdapter,
    browserDefaultSetter,
    autostartRegistry,
    queueRepository,
    clipboardWriter,
  )

  registerInstallation(queueOrchestrator)

  const preflightService = new RunSystemVerification(
    new WindowsSystemInspector(powershellRunner),
    diskSpaceProbe,
  )
  registerPreflight(preflightService)

  const catalogService = new CatalogService(
    packageRepository,
    new WindowsAutostartReader(powershellRunner),
    processRunner,
  )
  registerCatalog(catalogService)

  registerSteam(new SteamService(steamAdapter))

  const preferencesService = new PreferencesService(new JsonPreferencesStore())
  const readGitConfig = new ReadGitConfig(processRunner)
  registerPreferences(preferencesService, readGitConfig)

  const systemService = new SystemService(new WindowsPowerController(processRunner))
  registerSystem(systemService)

  const updateService = new UpdateService(new ElectronUpdateChecker(), () => {
    const run = queueOrchestrator.currentState()
    return run !== null && run.finishedAt === null
  })
  registerUpdates(updateService)

  const notificationPresenter = new ElectronNotificationPresenter()
  queueOrchestrator.subscribe((run) => notificationPresenter.present(run))
  queueOrchestrator.subscribe(() => updateService.onQueueChanged())

  return { processRunner, queueOrchestrator }
}
