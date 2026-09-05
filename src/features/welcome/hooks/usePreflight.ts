import { useCallback, useEffect, useRef, useState } from 'react'
import { withOtherDrive, type Drive, type Preflight } from '@shared/domain/preflight'
import { bridge } from '@/shared/lib/bridge'

type State =
  | { phase: 'drives' }
  | { phase: 'choosing'; drives: Drive[] }
  | { phase: 'checking'; drives: Drive[]; chosen: string }
  | { phase: 'ready'; data: Preflight }
  | { phase: 'error'; message: string }

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : 'Falha ao verificar o sistema.'
}

export function usePreflight(initialDrive?: string) {
  const [state, setState] = useState<State>({ phase: 'drives' })

  const initial = useRef(initialDrive)

  const generation = useRef(0)

  const check = useCallback(async (drives: Drive[], letter: string) => {
    const mine = ++generation.current
    setState({ phase: 'checking', drives, chosen: letter })
    try {
      const data = await bridge.invoke('preflight:run', { drive: letter })
      if (generation.current === mine) setState({ phase: 'ready', data })
    } catch (e) {
      if (generation.current === mine) setState({ phase: 'error', message: messageOf(e) })
    }
  }, [])

  const loadDrives = useCallback(async () => {
    const mine = ++generation.current
    const current = () => generation.current === mine

    setState({ phase: 'drives' })
    try {
      const drives = await bridge.invoke('preflight:drives', undefined)
      if (!current()) return

      if (drives.length === 0) {
        setState({ phase: 'error', message: 'Nenhum disco fixo encontrado neste computador.' })
        return
      }
      const decided =
        drives.length === 1 ? drives[0] : drives.find((d) => d.letter === initial.current)

      if (decided) {
        await check(drives, decided.letter)
        return
      }
      setState({ phase: 'choosing', drives })
    } catch (e) {
      if (current()) setState({ phase: 'error', message: messageOf(e) })
    }
  }, [check])

  useEffect(() => {
    void loadDrives()
  }, [loadDrives])

  const chooseDrive = useCallback(
    (letter: string) => {
      setState((current) => {
        if (current.phase === 'ready') {
          const d = current.data.drives.find((x) => x.letter === letter)
          return d ? { phase: 'ready', data: withOtherDrive(current.data, d) } : current
        }
        if (current.phase === 'choosing') {
          void check(current.drives, letter)
        }
        return current
      })
    },
    [check],
  )

  return { state, chooseDrive, reload: loadDrives }
}
