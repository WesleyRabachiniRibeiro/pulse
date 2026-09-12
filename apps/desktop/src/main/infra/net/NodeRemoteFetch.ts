import type { RemoteFetch } from '../../ports/remote-fetch'

const TIMEOUT_MS = 8_000
const MAX_BYTES = 2 * 1024 * 1024

export class NodeRemoteFetch implements RemoteFetch {
  async text(url: string): Promise<string | null> {
    // Só http e https: um link colado pode ser file:// e apontar para qualquer
    // arquivo da máquina.
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return null
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null

    const stop = AbortSignal.timeout(TIMEOUT_MS)

    try {
      const response = await fetch(parsed, { signal: stop, redirect: 'follow' })
      if (!response.ok) return null

      const body = await response.text()
      return body.length > MAX_BYTES ? null : body
    } catch {
      return null
    }
  }
}
