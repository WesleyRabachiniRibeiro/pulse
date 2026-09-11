import type { Item, LogLevel, Program } from '@pulse/domain'
import type { ProcessRunner } from '../../../ports/process-runner'
import type { PackageInstaller } from '../../../ports/package-installer'
import type { AutostartRegistry } from '../../../ports/autostart-registry'
import type { SteamGameRequester } from '../../../ports/steam-game-requester'

export type StepResult = Partial<NonNullable<Item['result']>>

export interface StepPorts {
  processRunner: ProcessRunner
  packageInstaller: PackageInstaller
  autostartRegistry: AutostartRegistry
  steamGameRequester: SteamGameRequester
}

export interface StepContext {
  itemId: string
  program: Program
  drive: string
  ports: StepPorts

  // O runner não toca no Item: ele conta o que está fazendo e o orquestrador
  // decide como isso vira estado e evento.
  say(detail: string): void
  waitFor(detail: string): void
  progress(percent: number): void
  note(text: string, level?: LogLevel): void
  canceled(): boolean
}

export type StepRunner = (value: never, ctx: StepContext) => Promise<StepResult>

export function runnerFor<T>(
  apply: (value: T, ctx: StepContext) => Promise<StepResult>,
): StepRunner {
  return apply as unknown as StepRunner
}

export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
