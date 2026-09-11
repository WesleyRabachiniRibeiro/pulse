import { useCallback, useEffect, useState } from 'react'
import { elapsedSeconds } from '@pulse/utils'
import { bridge } from '@/shared/lib/bridge'
import { useRun } from '../store/useRun'

export function useInstallation() {
  const run = useRun()
  const running = run !== null && run.finishedAt === null

  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!run) return
    setElapsed(elapsedSeconds(run))
    if (run.finishedAt) return

    const t = setInterval(() => setElapsed(elapsedSeconds(run)), 1000)
    return () => clearInterval(t)
  }, [run])

  const cancel = useCallback(() => {
    void bridge.invoke('installation:cancel', undefined)
  }, [])

  const cancelItem = useCallback((id: string) => {
    void bridge.invoke('installation:cancelItem', { id })
  }, [])

  const retry = useCallback((id: string) => {
    void bridge.invoke('installation:retry', { id })
  }, [])

  const grant = useCallback((id: string) => {
    void bridge.invoke('installation:grant', { id })
  }, [])

  return { run, running, elapsed, cancel, cancelItem, retry, grant }
}
