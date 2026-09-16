import { useEffect, useState } from 'react'
import type { RunRecord } from '@pulse/domain'
import { bridge } from '@/shared/lib/bridge'

export interface HistoryState {
  records: readonly RunRecord[] | null
  clear: () => void
}

export function useHistory(): HistoryState {
  const [records, setRecords] = useState<readonly RunRecord[] | null>(null)

  useEffect(() => {
    let alive = true
    void bridge
      .invoke('history:read', undefined)
      .then((found) => {
        if (alive) setRecords(found)
      })
      .catch(() => {
        if (alive) setRecords([])
      })
    return () => {
      alive = false
    }
  }, [])

  return {
    records,
    clear: () => {
      void bridge
        .invoke('history:clear', undefined)
        .then(setRecords)
        .catch(() => undefined)
    },
  }
}
