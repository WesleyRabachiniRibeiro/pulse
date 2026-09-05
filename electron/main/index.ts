import { app, BrowserWindow, nativeImage, shell } from 'electron'
import { APP_ICON } from './icon'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from '../ipc/register'
import { registerPreflight } from '../features/preflight'
import { registerInstallation } from '../features/installation'
import { registerCatalog } from '../features/catalog'
import { registerSystem } from '../features/system'
import { registerSteam } from '../features/steam'
import { registerPreferences } from '../features/preferences'
import { nameForWindows } from '../features/alerts'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

let window: BrowserWindow | null = null

function createWindow(): void {
  window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1040,
    minHeight: 700,
    show: false,
    frame: false,
    icon: nativeImage.createFromDataURL(APP_ICON),
    backgroundColor: '#0C0A16',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: false,
    },
  })

  window.once('ready-to-show', () => window?.show())

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void window.loadURL(devUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerWindow(): void {
  register('window:minimize', () => {
    window?.minimize()
  })

  register('window:toggleMaximize', () => {
    if (!window) return false
    if (window.isMaximized()) {
      window.unmaximize()
      return false
    }
    window.maximize()
    return true
  })

  register('window:close', () => {
    window?.close()
  })
}

void app.whenReady().then(() => {
  nameForWindows()
  registerWindow()
  registerPreflight()
  registerInstallation()
  registerCatalog()
  registerSystem()
  registerSteam()
  registerPreferences()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
