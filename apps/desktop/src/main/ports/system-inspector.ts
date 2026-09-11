import type { SystemFacts } from '@pulse/domain'

export interface SystemInspector {
  getSystemFacts(): Promise<SystemFacts>
  hasInternet(): Promise<boolean>
}
