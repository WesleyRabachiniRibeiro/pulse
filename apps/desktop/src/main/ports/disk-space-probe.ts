import type { Drive } from '@pulse/domain'

export interface DiskSpaceProbe {
  listDrives(): Promise<Drive[]>
}
