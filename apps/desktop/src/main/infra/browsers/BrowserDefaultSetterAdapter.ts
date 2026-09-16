import { browserFileName, browserImportRoute, type Program } from '@pulse/domain'
import { entryMatchesProgram } from '@pulse/utils'
import type { PowerShellRunner } from '../../ports/powershell-runner'
import type { ProcessRunner } from '../../ports/process-runner'
import type {
  BrowserDefaultSetter,
  DefaultBrowserOutcome,
  OpenBrowserOutcome,
} from '../../ports/browser-default-setter'

const SCRIPT_TIMEOUT_MS = 25_000
const AFTER_LAUNCH_WAIT_MS = 4_000

interface RegisteredBrowser {
  key: string
  exe: string
  progId: string
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function executable(command: string): string | null {
  const quoted = /^"([^"]+)"/.exec(command)
  if (quoted?.[1]) return quoted[1]
  const bare = command.trim().split(' ')[0]
  return bare || null
}

export class BrowserDefaultSetterAdapter implements BrowserDefaultSetter {
  constructor(
    private readonly powershell: PowerShellRunner,
    private readonly processRunner: ProcessRunner,
  ) {}

  async makeDefault(program: Program): Promise<DefaultBrowserOutcome> {
    const browser = await this.findBrowser(program)
    const exe = browser ? executable(browser.exe) : null
    if (!browser || !exe) return 'failed'

    const isFirefox = /firefox/i.test(exe)
    await this.launch(exe, [isFirefox ? '-setDefaultBrowser' : '--make-default-browser'])

    await wait(AFTER_LAUNCH_WAIT_MS)

    const now = await this.currentDefault()
    if (!now) return 'asked'
    return now.toLowerCase() === browser.progId.toLowerCase() ? 'yes' : 'asked'
  }

  async openOnce(program: Program): Promise<OpenBrowserOutcome> {
    const browser = await this.findBrowser(program)
    const exe = browser ? executable(browser.exe) : null
    if (!exe) return { result: 'failed', address: null }

    const route = browserImportRoute(exe)

    if (route?.wizardArg) {
      const running = await this.isRunning(exe)
      await this.launch(exe, running ? [] : [route.wizardArg])
      return { result: running ? 'already-running' : 'opened', address: null }
    }

    await this.launch(exe, [])
    return { result: 'opened', address: route?.address ?? null }
  }

  private launch(exe: string, args: readonly string[]): Promise<void> {
    return this.processRunner.launchDetached(exe, args)
  }

  private async findBrowser(program: Program): Promise<RegisteredBrowser | null> {
    const all = await this.registered()
    return all.find((b) => b?.key && entryMatchesProgram(b.key, b.exe ?? '', program)) ?? null
  }

  private async registered(): Promise<RegisteredBrowser[]> {
    const list = await this.powershell
      .runJson<RegisteredBrowser[]>('Get-RegisteredBrowsers.ps1', undefined, SCRIPT_TIMEOUT_MS)
      .catch((): RegisteredBrowser[] => [])
    return Array.isArray(list) ? list : [list]
  }

  private async currentDefault(): Promise<string> {
    const { progId } = await this.powershell
      .runJson<{ progId: string | null }>('Get-DefaultBrowser.ps1', undefined, SCRIPT_TIMEOUT_MS)
      .catch(() => ({ progId: null }))
    return progId ?? ''
  }

  private async isRunning(exe: string): Promise<boolean> {
    const { running } = await this.powershell
      .runJson<{ running: boolean }>(
        'Test-ProcessRunning.ps1',
        { name: browserFileName(exe) },
        SCRIPT_TIMEOUT_MS,
      )
      .catch(() => ({ running: false }))
    return running
  }
}
