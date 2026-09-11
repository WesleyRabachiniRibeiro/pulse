import type { Drive } from '@pulse/domain'

// Resolve com a leitura rápida (sem tipo de mídia) e, quando informado,
// chama onEnriched mais tarde com a mesma lista já com SSD/HDD resolvido —
// o script de disco emite as duas respostas na mesma execução.
export interface DriveLister {
  listDrives(onEnriched?: (drives: Drive[]) => void): Promise<Drive[]>
}
