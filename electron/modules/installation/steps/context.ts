import type { Program } from '@shared/domain/catalog'
import type { LogLevel } from '@shared/domain/installation'

export interface StepOutput {
  code: number
  text: string
}

export interface StepContext {
  program: Program
  drive: string
  say: (detail: string) => void
  waitFor: (detail: string) => void
  note: (text: string, level?: LogLevel) => void
  progress: (percent: number) => void
  runWinget: (packageId: string, destination?: string) => Promise<StepOutput>
}

export interface StepResult {
  [key: string]: unknown
}

export type StepRunner = (value: never, ctx: StepContext) => Promise<StepResult>

export function runnerFor<T>(
  apply: (value: T, ctx: StepContext) => Promise<StepResult>,
): StepRunner {
  return apply as unknown as StepRunner
}
