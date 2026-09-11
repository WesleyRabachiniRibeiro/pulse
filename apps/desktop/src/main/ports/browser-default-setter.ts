import type { Program } from '@pulse/domain'

export type DefaultBrowserOutcome = 'yes' | 'asked' | 'failed'
export type OpenBrowserResult = 'opened' | 'already-running' | 'failed'

export interface OpenBrowserOutcome {
  result: OpenBrowserResult
  address: string | null
}

export interface BrowserDefaultSetter {
  makeDefault(program: Program): Promise<DefaultBrowserOutcome>
  openOnce(program: Program): Promise<OpenBrowserOutcome>
}
