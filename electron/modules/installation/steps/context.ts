import type { Program } from '@shared/domain/catalog'
import type { Item, LogLevel } from '@shared/domain/installation'
import type { Settings } from '@shared/domain/settings'

export type StepResult = Partial<NonNullable<Item['result']>>

export interface StepOutput {
  code: number
  text: string
}

export interface StepContext {
  program: Program
  drive: string
  settings: Settings
  say: (detail: string, percent?: number) => void
  waitFor: (detail: string) => void
  note: (text: string, level?: LogLevel) => void
  progress: (percent: number) => void
  merge: (partial: StepResult) => void
  runWinget: (packageId: string, destination?: string) => Promise<StepOutput>
}

export type StepRunner = (value: never, ctx: StepContext) => Promise<StepResult>

export function runnerFor<T>(
  apply: (value: T, ctx: StepContext) => Promise<StepResult>,
): StepRunner {
  return apply as unknown as StepRunner
}
