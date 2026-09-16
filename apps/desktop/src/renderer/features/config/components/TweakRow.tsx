import { ConfigRow } from '@/shared/ui/ConfigRow/ConfigRow'
import { setTweak, useTweakBusy, useTweakOn, useTweaksLoaded } from '../store/useTweaks'

interface Props {
  id: string
  name: string
  hint: string
}

export function TweakRow({ id, name, hint }: Props) {
  const on = useTweakOn(id)
  const busy = useTweakBusy(id)
  const loaded = useTweaksLoaded()

  return (
    <ConfigRow
      name={name}
      hint={busy ? 'aplicando…' : hint}
      choices={[
        { id: 'true', label: 'LIGADO' },
        { id: 'false', label: 'DESLIGADO' },
      ]}
      chosen={String(on)}
      busy={!loaded || busy}
      exceptions={[]}
      onPick={(picked) => void setTweak(id, picked === 'true')}
    />
  )
}
