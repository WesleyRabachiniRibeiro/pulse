import type { UpdateState } from '@pulse/domain'

export interface UpdateChecker {
  subscribe(listener: (state: UpdateState) => void): () => void
  currentState(): UpdateState
  start(): void
  installNow(): void

  setBusy(busy: boolean): void
}
