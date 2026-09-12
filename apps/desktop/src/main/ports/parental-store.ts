import type { Parental } from '@pulse/domain'

export interface ParentalStore {
  read(): Promise<Parental>
  write(parental: Parental): Promise<void>
}
