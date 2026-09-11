import type { Run } from '@pulse/domain'

export interface NotificationPresenter {
  present(run: Run): void
}
