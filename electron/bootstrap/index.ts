import { app, BrowserWindow, nativeImage, shell } from 'electron'
import { APP_ICON } from './icon'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerPreflight } from '@main/modules/preflight'
import { registerInstallation } from '@main/modules/installation'
import { registerCatalog } from '@main/modules/catalog'
import { registerSystem } from '@main/modules/system'
import { registerSteam } from '@main/modules/steam'
import { registerPreferences } from '@main/modules/preferences'
import { registerParental } from '@main/modules/parental'
import { registerProfile } from '@main/modules/profile'
import { registerGit } from '@main/modules/git'
import { registerWindows } from '@main/modules/windows'
import { holdWindow, registerWindow } from '@main/modules/window'
import { registerUpdates } from '@main/modules/updates'
import { nameForWindows } from '@main/modules/alerts'

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
