import type { z } from 'zod'
import type { SettingsOption } from '@pulse/catalog-data'

export interface StepDescriptor<T> {
  id: string
  title: string
  description: string
  schema: z.ZodType<T>
  options?: readonly SettingsOption[]
  optionsFor?: (programId: string) => readonly SettingsOption[]
  searchPlaceholder?: string
  isEmpty: (value: T) => boolean
  summary: (value: T) => string[]
}

// O registro guarda descritores de tipos diferentes lado a lado, então o valor
// só volta a ter tipo quando passa pelo schema do próprio step.
export interface AnyStep {
  id: string
  title: string
  description: string
  schema: z.ZodType<unknown>
  options?: readonly SettingsOption[]
  optionsFor?: (programId: string) => readonly SettingsOption[]
  searchPlaceholder?: string
  isEmpty: (value: never) => boolean
  summary: (value: never) => string[]
}

export function anyStep<T>(step: StepDescriptor<T>): AnyStep {
  return step as unknown as AnyStep
}

export function isEmptyValue(step: AnyStep, value: unknown): boolean {
  return (step.isEmpty as (v: unknown) => boolean)(value)
}

export function summaryOf(step: AnyStep, value: unknown): string[] {
  return (step.summary as (v: unknown) => string[])(value)
}
