import type { Program } from '@pulse/domain'

export type AutostartResult = 'on' | 'off' | 'no-entry'

export interface AutostartRegistry {
  setAutostart(program: Program, on: boolean): Promise<AutostartResult>
}
