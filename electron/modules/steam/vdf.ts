import { readFile } from 'node:fs/promises'

const APPINFO_V28 = 0x07564428
const APPINFO_V29 = 0x07564429
const PACKAGEINFO_V28 = 0x06565528

export interface KnownApp {
  name: string
  type: string
}

function readStringTable(b: Buffer, offset: number): string[] {
  const table: string[] = []
  let p = offset
  const total = b.readUInt32LE(p)
  p += 4
  for (let i = 0; i < total; i++) {
    const end = b.indexOf(0, p)
    if (end < 0) break
    table.push(b.toString('utf8', p, end))
    p = end + 1
  }
  return table
}

function readCommon(b: Buffer, start: number, end: number, table: string[] | null): KnownApp | null {
  let p = start
  const stack: string[] = []
  let name: string | undefined
  let type: string | undefined

  const nextKey = (): string => {
    if (table) {
      const index = b.readUInt32LE(p)
      p += 4
      return table[index] ?? ''
    }
    const zero = b.indexOf(0, p)
    const key = b.toString('utf8', p, zero)
    p = zero + 1
    return key
  }

  while (p < end && p < b.length) {
    const nodeType = b[p++]

    if (nodeType === 0x08) {
      if (stack.length === 0) break
      stack.pop()
      continue
    }

    const key = nextKey()

    if (nodeType === 0x00) {
      stack.push(key)
    } else if (nodeType === 0x01) {
      const zero = b.indexOf(0, p)
      const value = b.toString('utf8', p, zero)
      p = zero + 1
      if (stack[stack.length - 1] === 'common') {
        if (key === 'name') name = value
        if (key === 'type') type = value.toLowerCase()
      }
      if (name && type) break
    } else if (nodeType === 0x02) {
      p += 4
    } else if (nodeType === 0x07) {
      p += 8
    } else {
      break
    }
  }

  return name ? { name, type: type ?? 'unknown' } : null
}

export async function readKnownApps(path: string): Promise<Map<string, KnownApp>> {
  const b = await readFile(path)
  const apps = new Map<string, KnownApp>()
  if (b.length < 16) return apps

  const magic = b.readUInt32LE(0)
  if (magic !== APPINFO_V28 && magic !== APPINFO_V29) return apps

  let p = 8
  let table: string[] | null = null

  if (magic === APPINFO_V29) {
    const offset = Number(b.readBigInt64LE(p))
    p += 8
    if (offset > 0 && offset < b.length) table = readStringTable(b, offset)
  }

  const header = 44 + (magic === APPINFO_V29 ? 20 : 0)

  while (p + 8 <= b.length) {
    const appid = b.readUInt32LE(p)
    if (appid === 0) break
    const size = b.readUInt32LE(p + 4)
    const end = p + 8 + size
    if (size <= header || end > b.length) break

    const info = readCommon(b, p + 8 + header, end, table)
    if (info) apps.set(String(appid), info)
    p = end
  }

  return apps
}

function readPackage(b: Buffer, start: number, target: Set<string>): number {
  let p = start
  const stack: string[] = []

  while (p < b.length) {
    const nodeType = b[p++]

    if (nodeType === 0x08) {
      if (stack.length === 0) return p
      stack.pop()
      continue
    }

    const zero = b.indexOf(0, p)
    if (zero < 0) return -1
    const key = b.toString('utf8', p, zero)
    p = zero + 1

    if (nodeType === 0x00) {
      stack.push(key)
    } else if (nodeType === 0x01) {
      const valueEnd = b.indexOf(0, p)
      if (valueEnd < 0) return -1
      p = valueEnd + 1
    } else if (nodeType === 0x02) {
      const value = b.readUInt32LE(p)
      p += 4
      if (stack[stack.length - 1] === 'appids') target.add(String(value))
    } else if (nodeType === 0x07) {
      p += 8
    } else {
      return -1
    }
  }

  return -1
}

export async function readLicenses(path: string): Promise<Set<string>> {
  const b = await readFile(path)
  const appids = new Set<string>()
  if (b.length < 16) return appids

  const magic = b.readUInt32LE(0)
  let p = 8

  while (p + 4 <= b.length) {
    const packageid = b.readUInt32LE(p)
    if (packageid === 0xffffffff) break

    p += 4 + 20 + 4
    if (magic === PACKAGEINFO_V28) p += 8

    const next = readPackage(b, p, appids)
    if (next < 0) break
    p = next
  }

  return appids
}
