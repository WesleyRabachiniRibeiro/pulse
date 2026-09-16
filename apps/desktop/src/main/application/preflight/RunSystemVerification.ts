import {
  CHECK_ORDER,
  checkAdmin,
  checkDrive,
  checkInternet,
  checkVirtualization,
  checkWindows,
  checkWinget,
  worstStatus,
  type Check,
  type Drive,
  type Preflight,
  type PreflightPartial,
  type SystemFacts,
} from '@pulse/domain'
import type { SystemInspector } from '../../ports/system-inspector'
import type { DriveLister } from '../../ports/drive-lister'
import { DriveCache } from './DriveCache'

type PartialListener = (partial: PreflightPartial) => void

function pickDrive(drives: readonly Drive[], wanted?: string): Drive | undefined {
  return drives.find((d) => d.letter === wanted) ?? drives.find((d) => d.system) ?? drives[0]
}

export class RunSystemVerification {
  private readonly listeners = new Set<PartialListener>()
  private readonly driveCache: DriveCache
  private token = 0

  constructor(
    private readonly systemInspector: SystemInspector,
    driveLister: DriveLister,
  ) {
    this.driveCache = new DriveCache(driveLister)
  }

  subscribe(listener: PartialListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  warm(): void {
    this.driveCache.warm()
  }

  drives(fresh: boolean): Promise<Drive[]> {
    return this.driveCache.get(fresh, (drives) => this.publish({ drives }))
  }

  async run(input: { drive?: string } = {}): Promise<Preflight> {
    const mine = ++this.token
    const arrived = new Map<Check['id'], Check>()

    const publish = (...found: Check[]): void => {
      if (mine !== this.token) return
      for (const c of found) arrived.set(c.id, c)
      const checks = CHECK_ORDER.map((id) => arrived.get(id)).filter((c): c is Check => Boolean(c))
      this.publish({ checks })
    }

    const ready = this.driveCache.peek()
    if (ready) {
      const early = pickDrive(ready, input.drive)
      if (early) publish(checkDrive(early, ready.find((x) => x.system)))
    }

    const systemStep = this.systemInspector.getSystemFacts().then((f: SystemFacts) => {
      publish(checkWindows(f), checkAdmin(f), checkWinget(f), checkVirtualization(f))
      return f
    })

    const internetStep = this.systemInspector.hasInternet().then((o) => {
      publish(checkInternet(o))
      return o
    })

    const drivesStep = this.driveCache.get(false, (drives) => this.publish({ drives })).then((d) => {
      const early = pickDrive(d, input.drive)
      if (early) publish(checkDrive(early, d.find((x) => x.system)))
      return d
    })

    const [facts, online, drives] = await Promise.all([systemStep, internetStep, drivesStep])

    const chosen = pickDrive(drives, input.drive)
    if (!chosen) {
      throw new Error('Nenhum disco fixo encontrado neste computador.')
    }

    const checks: Check[] = [
      checkWindows(facts),
      checkAdmin(facts),
      checkWinget(facts),
      checkInternet(online),
      checkDrive(chosen, drives.find((d) => d.system)),
      checkVirtualization(facts),
    ]

    return {
      checks,
      overall: worstStatus(checks),
      drives,
      chosenDrive: chosen.letter,
      ranAt: new Date().toISOString(),
    }
  }

  private publish(payload: Omit<PreflightPartial, 'token'>): void {
    const event = { token: this.token, ...payload }
    for (const listener of this.listeners) listener(event)
  }
}
