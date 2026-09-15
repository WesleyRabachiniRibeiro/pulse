import type { ProcessRunner, SpawnResult } from '../../ports/process-runner'
import type {
  InstallFailureKind,
  InstallOutcome,
  InstallProgress,
  InstallSpec,
  PackageInstaller,
  UninstallOutcome,
} from '../../ports/package-installer'
import { readWingetProgress } from './WingetOutputParser'
import {
  alreadyInstalled,
  hex,
  installerBusy,
  needsAdmin,
  needsReboot,
  refusedDrive,
  wingetErrorMessage,
} from './WingetErrorClassifier'
import { adminFailure, REFUSED_BY_USER } from '../process/adminOutcome'
import { NO_UNELEVATED_SESSION, runnerFailure } from '../process/interactiveUserOutcome'
import { normalizeText } from '@pulse/domain'

const NOT_MANAGED_TEXT = ['nenhum pacote instalado', 'no installed package']

export class WingetPackageInstaller implements PackageInstaller {
  constructor(private readonly processRunner: ProcessRunner) {}

  async install(
    spec: InstallSpec,
    onProgress: (progress: InstallProgress) => void,
  ): Promise<InstallOutcome> {
    const output = await this.processRunner.runWinget(
      spec.itemId,
      installArgs(spec),
      (line) => onProgress(readWingetProgress(line)),
      spec.drive,
    )
    return this.classify(output, spec, false)
  }

  async installElevated(spec: InstallSpec): Promise<InstallOutcome> {
    const output = await this.processRunner.runElevated('winget', installArgs(spec))
    return this.classify(output, spec, true)
  }

  cancel(itemId?: string): void {
    this.processRunner.killWinget(itemId)
  }

  private classify(output: SpawnResult, spec: InstallSpec, elevated: boolean): InstallOutcome {
    const { code, text } = output

    if (code === 0) return { kind: 'ok', needsReboot: needsReboot(code, text) }
    if (alreadyInstalled(code, text)) return { kind: 'already-installed' }

    const kind = this.failureKind(code, text, Boolean(spec.destination))
    const fromRunner = elevated ? adminFailure(code, spec.name) : null

    return {
      kind,
      code: hex(code),
      message: fromRunner ?? wingetErrorMessage(code, text, spec.name),
    }
  }

  private failureKind(code: number, text: string, hasDestination: boolean): InstallFailureKind {
    if (hasDestination && refusedDrive(text)) return 'drive-refused'
    if (installerBusy(code, text)) return 'installer-busy'
    if (code === REFUSED_BY_USER) return 'refused-by-user'
    if (needsAdmin(code, text)) return 'needs-admin'
    return 'failed'
  }

  async uninstall(itemId: string, packageId: string, name: string): Promise<UninstallOutcome> {
    const args = [
      'uninstall',
      '--id',
      packageId,
      '--exact',
      '--silent',
      '--accept-source-agreements',
      '--disable-interactivity',
    ]

    const direct = (): Promise<SpawnResult> =>
      this.processRunner.runWinget(`uninstall:${itemId}`, args, () => {})

    // Elevado, o winget recusa desinstalar pacote de escopo de usuário. Como o
    // Pulse roda como administrador, a remoção sai pela sessão da pessoa.
    let output: SpawnResult = (await this.processRunner.isElevated())
      ? await this.processRunner.runAsInteractiveUser('winget', args)
      : await direct()

    // Quem desliga o UAC não tem sessão sem elevação, então a descida acima é
    // impossível nessa máquina. Tentar direto ao menos deixa o winget dizer o
    // que acontece, em vez de o Pulse recusar sozinho.
    if (output.code === NO_UNELEVATED_SESSION) output = await direct()

    const blocked = runnerFailure(output.code)
    if (blocked) return { kind: 'blocked', reason: blocked }

    if (output.code === 0) return { kind: 'ok' }

    const text = normalizeText(output.text)
    if (NOT_MANAGED_TEXT.some((needle) => text.includes(needle))) return { kind: 'not-managed' }

    return {
      kind: 'failed',
      code: hex(output.code),
      message: wingetErrorMessage(output.code, output.text, name),
    }
  }
}

function installArgs(spec: InstallSpec): string[] {
  const common = [
    'install',
    '--id',
    spec.packageId,
    '--exact',
    '--accept-package-agreements',
    '--accept-source-agreements',
  ]

  if (spec.scope) common.push('--scope', spec.scope)
  if (spec.locale) common.push('--locale', spec.locale)

  // Mostrar a janela do instalador é o oposto de desligar a interação: as duas
  // opções do winget não convivem no mesmo comando.
  common.push(spec.interactive ? '--interactive' : '--disable-interactivity')

  if (spec.fromStore) return [...common, '--source', 'msstore']
  if (spec.override) return [...common, '--override', spec.override]

  const base = spec.interactive ? common : [...common, '--silent']
  return spec.destination ? [...base, '--location', spec.destination] : base
}
