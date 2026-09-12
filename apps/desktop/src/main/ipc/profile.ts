import { register } from './register'
import type { ProfileService } from '../application/profile/ProfileService'

export function registerProfile(service: ProfileService): void {
  register('profile:export', (input) => service.export(input.format, input.profile, input.drive))
  register('profile:import', (input) => service.import(input.mode, input.current))
  register('profile:importLink', (input) =>
    service.importLink(input.url, input.mode, input.current),
  )
}
