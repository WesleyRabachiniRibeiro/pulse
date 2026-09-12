import type { TweakState } from '@pulse/domain'

export interface WindowsTweaks {
  read(): Promise<readonly TweakState[]>
  write(id: string, on: boolean): Promise<readonly TweakState[]>
}
