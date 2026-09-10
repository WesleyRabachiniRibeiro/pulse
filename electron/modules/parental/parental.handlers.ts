import { register } from '@main/core/ipc/register'
import {
  allowOnce,
  changePin,
  checkPin,
  setBlocked,
  turnOff,
  turnOn,
  viewParental,
} from './parental.service'

export function registerParental(): void {
  register('parental:read', () => viewParental())
  register('parental:turnOn', (input) => turnOn(input.pin))
  register('parental:turnOff', (input) => turnOff(input.pin))
  register('parental:change', (input) => changePin(input.current, input.next))
  register('parental:check', (input) => checkPin(input.pin))
  register('parental:allowOnce', (input) => allowOnce(input.pin, input.id))
  register('parental:setBlocked', (input) => setBlocked(input.ids))
}
