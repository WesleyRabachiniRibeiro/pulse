import type { UpdateState } from '@pulse/domain'

export interface UpdateChecker {
  subscribe(listener: (state: UpdateState) => void): () => void
  currentState(): UpdateState
  start(): void
  installNow(): void
  // Liga/desliga a instalação automática ao fechar o app e, se já houver uma
  // atualização pronta, reflete o bloqueio no estado publicado aos ouvintes.
  setBusy(busy: boolean): void
}
