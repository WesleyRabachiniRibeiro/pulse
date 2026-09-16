import {
  hasPin,
  pinIsValid,
  withBlocked,
  type Parental,
} from '@pulse/domain'
import type { ParentalView, PinResult } from '@pulse/ipc-contract'
import type { ParentalStore } from '../../ports/parental-store'
import type { PinSealer } from '../../ports/pin-sealer'

export class ParentalService {
  constructor(
    private readonly store: ParentalStore,
    private readonly sealer: PinSealer,
  ) {}

  async view(): Promise<ParentalView> {
    return this.viewOf(await this.store.read())
  }

  async turnOn(pin: string): Promise<PinResult> {
    if (!pinIsValid(pin)) return { ok: false }

    const parental = await this.store.read()

    if (hasPin(parental) && !this.confirms(parental, pin)) return { ok: false }

    const next: Parental = {
      ...parental,
      on: true,
      secret: hasPin(parental) ? parental.secret : this.sealer.seal(pin),
    }
    return this.save(next)
  }

  async turnOff(pin: string): Promise<PinResult> {
    const parental = await this.store.read()
    if (!this.confirms(parental, pin)) return { ok: false }

    return this.save({ ...parental, on: false })
  }

  async change(current: string, next: string): Promise<PinResult> {
    if (!pinIsValid(next)) return { ok: false }

    const parental = await this.store.read()
    if (!this.confirms(parental, current)) return { ok: false }

    return this.save({ ...parental, secret: this.sealer.seal(next) })
  }

  async check(pin: string): Promise<boolean> {
    return this.confirms(await this.store.read(), pin)
  }

  async setBlocked(ids: readonly string[]): Promise<ParentalView> {
    const parental = await this.store.read()
    const next = withBlocked(parental, ids)
    await this.store.write(next)
    return this.viewOf(next)
  }

  async read(): Promise<Parental> {
    return this.store.read()
  }

  private confirms(parental: Parental, pin: string): boolean {
    const secret = parental.secret
    if (!secret) return false
    return this.sealer.matches(secret, pin)
  }

  private async save(parental: Parental): Promise<PinResult> {
    await this.store.write(parental)
    return { ok: true, view: this.viewOf(parental) }
  }

  private viewOf(parental: Parental): ParentalView {
    return {
      on: parental.on,
      hasPin: hasPin(parental),
      blocked: [...parental.blocked],
    }
  }
}
