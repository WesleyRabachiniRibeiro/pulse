import type { ComponentType } from 'react'
import type { AnyStep } from '@shared/domain/steps'

export interface PanelProps<T> {
  step: AnyStep
  programId: string
  value: T | undefined
  onChange: (value: T | undefined) => void
}

export type AnyPanel = ComponentType<PanelProps<never>>

export function panelFor<T>(panel: ComponentType<PanelProps<T>>): AnyPanel {
  return panel as unknown as AnyPanel
}
