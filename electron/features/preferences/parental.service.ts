import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import {
  EMPTY_PARENTAL,
  pinIsValid,
  withBlocked,
  type Parental,
} from '@shared/domain/parental'
import { readPreferences, writePreferences } from './preferences.service'

const KEY_BYTES = 32

function seal(digits: string): string {
  const salt = randomBytes(16).toString('hex')
  const key = scryptSync(digits, salt, KEY_BYTES).toString('hex')
  return `${salt}:${key}`
}

function matches(secret: string, digits: string): boolean {
  const [salt, key] = secret.split(':')
  if (!salt || !key) return false

  const mine = scryptSync(digits, salt, KEY_BYTES)
  const theirs = Buffer.from(key, 'hex')
  if (mine.length !== theirs.length) return false

  return timingSafeEqual(mine, theirs)
}

export async function readParental(): Promise<Parental> {
  const prefs = await readPreferences()
  return prefs.parental ?? EMPTY_PARENTAL
}

export interface ParentalView {
  on: boolean
  hasPin: boolean
  blocked: string[]
}

export async function viewParental(): Promise<ParentalView> {
  const parental = await readParental()
  return {
    on: parental.on,
    hasPin: Boolean(parental.secret),
    blocked: [...parental.blocked],
  }
}

async function save(parental: Parental): Promise<ParentalView> {
  await writePreferences({ parental })
  return viewParental()
}

export async function checkPin(digits: string): Promise<boolean> {
  const parental = await readParental()
  if (!parental.secret) return false
  return matches(parental.secret, digits)
}

export interface PinResult {
  ok: boolean
  view?: ParentalView
}

export async function turnOn(digits: string): Promise<PinResult> {
  if (!pinIsValid(digits)) return { ok: false }

  const parental = await readParental()
  const secret = parental.secret ?? seal(digits)

  if (parental.secret && !matches(parental.secret, digits)) return { ok: false }

  return { ok: true, view: await save({ ...parental, on: true, secret }) }
}

export async function turnOff(digits: string): Promise<PinResult> {
  if (!(await checkPin(digits))) return { ok: false }

  const parental = await readParental()
  return { ok: true, view: await save({ ...parental, on: false }) }
}

export async function changePin(current: string, next: string): Promise<PinResult> {
  if (!pinIsValid(next)) return { ok: false }
  if (!(await checkPin(current))) return { ok: false }

  const parental = await readParental()
  return { ok: true, view: await save({ ...parental, secret: seal(next) }) }
}

export async function setBlocked(ids: readonly string[]): Promise<ParentalView> {
  const parental = await readParental()
  return save(withBlocked(parental, ids))
}

const granted = new Set<string>()

export async function allowOnce(digits: string, id: string): Promise<boolean> {
  if (!(await checkPin(digits))) return false
  granted.add(id)
  return true
}

export function isGranted(id: string): boolean {
  return granted.has(id)
}

export function forgetGrants(): void {
  granted.clear()
}
