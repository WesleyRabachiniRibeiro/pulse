export interface PowerController {
  restart(): Promise<void>
  cancelRestart(): Promise<void>
}
