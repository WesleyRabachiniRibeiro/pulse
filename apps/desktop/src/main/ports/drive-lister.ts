import type { Drive } from '@pulse/domain'

export interface DriveLister {
  listDrives(onEnriched?: (drives: Drive[]) => void): Promise<Drive[]>
}
