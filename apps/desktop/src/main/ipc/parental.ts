import { register } from './register'
import type { ParentalService } from '../application/parental/ParentalService'

export function registerParental(service: ParentalService): void {
  register('parental:read', () => service.view())
  register('parental:turnOn', (input) => service.turnOn(input.pin))
  register('parental:turnOff', (input) => service.turnOff(input.pin))
  register('parental:change', (input) => service.change(input.current, input.next))
  register('parental:check', (input) => service.check(input.pin))
  register('parental:setBlocked', (input) => service.setBlocked(input.ids))
}
