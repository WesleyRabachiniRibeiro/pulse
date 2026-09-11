export interface PowerShellRunner {
  runJson<T>(scriptName: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<T>

  runNdjson<T>(
    scriptName: string,
    params: Record<string, unknown> | undefined,
    onEvent: (event: T) => void,
    timeoutMs?: number,
  ): { promise: Promise<{ code: number }>; kill(): void }
}
