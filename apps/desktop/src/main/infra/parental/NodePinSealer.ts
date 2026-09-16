import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { PinSealer } from '../../ports/pin-sealer'

const KEY_BYTES = 32
const SALT_BYTES = 16

export class NodePinSealer implements PinSealer {
  seal(digits: string): string {
    const salt = randomBytes(SALT_BYTES).toString('hex')
    const key = scryptSync(digits, salt, KEY_BYTES).toString('hex')
    return `${salt}:${key}`
  }

  matches(secret: string, digits: string): boolean {
    const [salt, key] = secret.split(':')
    if (!salt || !key) return false

    const mine = scryptSync(digits, salt, KEY_BYTES)
    const theirs = Buffer.from(key, 'hex')
    if (mine.length !== theirs.length) return false

    return timingSafeEqual(mine, theirs)
  }
}
