import { app, BrowserWindow, nativeImage, shell } from 'electron'
import { APP_ICON } from './icon'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerPreflight } from '../features/preflight'
import { registerInstallation } from '../features/installation'
import { registerCatalog } from '../features/catalog'
import { registerSystem } from '../features/system'
import { registerSteam } from '../features/steam'
import { registerPreferences } from '../features/preferences'
import { registerParental } from '../features/parental'
import { registerProfile } from '../features/profile'
import { registerGit } from '../features/git'
import { registerWindows } from '../features/windows'
import { holdWindow, registerWindow } from '../features/window'
import { registerUpdates } from '../features/updates'
import { nameForWindows } from '../features/alerts'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

function createWindow(): void {
  const window = new BrowserWindow({
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

  holdWindow(window)

  window.once('ready-to-show', () => window.show())

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

void app.whenReady().then(() => {
  nameForWindows()
  registerWindow()
  registerPreflight()
  registerInstallation()
  registerCatalog()
  registerSystem()
  registerWindows()
  registerSteam()
  registerPreferences()
  registerParental()
  registerProfile()
  registerGit()
  registerUpdates()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
