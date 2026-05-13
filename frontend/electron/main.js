/**
 * WashControl — Electron main process
 * Запускает Python backend и открывает окно приложения
 */

const { app, BrowserWindow, Tray, Menu, shell, ipcMain, dialog } = require('electron')
const path   = require('path')
const { spawn, execSync } = require('child_process')
const fs     = require('fs')

const isDev  = process.env.NODE_ENV === 'development' || !app.isPackaged
const API_PORT = 8765
const API_URL  = `http://127.0.0.1:${API_PORT}`

let mainWindow = null
let tray       = null
let backendProcess = null

// ── Путь к ресурсам ──────────────────────────────────────────────────────────
function getResourcePath(...parts) {
  if (isDev) {
    return path.join(__dirname, '..', '..', ...parts)
  }
  return path.join(process.resourcesPath, ...parts)
}

// ── Запуск Python backend ────────────────────────────────────────────────────
function startBackend() {
  const backendDir = getResourcePath('backend')
  const rootDir    = getResourcePath()

  // Ищем python: сначала встроенный, потом системный
  let pythonExe = 'python'
  const embeddedPython = path.join(getResourcePath(), 'python', 'python.exe')
  if (fs.existsSync(embeddedPython)) {
    pythonExe = embeddedPython
  }

  console.log('[Backend] Запуск Python:', pythonExe)
  console.log('[Backend] Рабочая папка:', rootDir)

  backendProcess = spawn(pythonExe, ['-m', 'backend.main'], {
    cwd: rootDir,
    env: {
      ...process.env,
      PYTHONPATH: rootDir,
      WASHCONTROL_HOST: '127.0.0.1',
      WASHCONTROL_PORT: String(API_PORT),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  backendProcess.stdout.on('data', (data) => {
    console.log('[Python]', data.toString().trim())
  })
  backendProcess.stderr.on('data', (data) => {
    console.error('[Python ERR]', data.toString().trim())
  })
  backendProcess.on('exit', (code) => {
    console.log(`[Backend] Процесс завершён с кодом ${code}`)
  })
}

// ── Ожидание готовности API ───────────────────────────────────────────────────
async function waitForApi(maxAttempts = 30) {
  const http = require('http')
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 1000))
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`${API_URL}/health`, (res) => {
          if (res.statusCode === 200) resolve()
          else reject()
        })
        req.on('error', reject)
        req.setTimeout(1000, () => { req.destroy(); reject() })
      })
      console.log('[API] Бэкенд готов ✓')
      return true
    } catch {
      console.log(`[API] Жду... (${i + 1}/${maxAttempts})`)
    }
  }
  return false
}

// ── Главное окно ──────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:          1280,
    height:         820,
    minWidth:       1024,
    minHeight:      640,
    title:          'WashControl',
    backgroundColor: '#0f172a',
    frame:          true,
    show:           false,
    webPreferences: {
      nodeIntegration:     false,
      contextIsolation:    true,
      preload:             path.join(__dirname, 'preload.js'),
    },
  })

  // Убираем стандартное меню
  mainWindow.setMenuBarVisibility(false)

  // Загружаем приложение
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  // Свернуть в трей вместо закрытия
  mainWindow.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })
}

// ── Системный трей ────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, '..', 'public', 'icon.png')
  try {
    tray = new Tray(fs.existsSync(iconPath) ? iconPath : path.join(__dirname, '..', 'public', 'vite.svg'))
    const menu = Menu.buildFromTemplate([
      {
        label: 'Открыть WashControl',
        click: () => { mainWindow.show(); mainWindow.focus() }
      },
      { type: 'separator' },
      {
        label: 'Выход',
        click: () => {
          app.isQuiting = true
          app.quit()
        }
      }
    ])
    tray.setToolTip('WashControl — Автомойка')
    tray.setContextMenu(menu)
    tray.on('double-click', () => { mainWindow.show(); mainWindow.focus() })
  } catch (e) {
    console.warn('[Tray] Не удалось создать иконку трея:', e.message)
  }
}

// ── IPC обработчики ───────────────────────────────────────────────────────────
ipcMain.handle('get-api-url', () => API_URL)

ipcMain.handle('open-data-folder', () => {
  const dataPath = getResourcePath('data')
  shell.openPath(dataPath)
})

ipcMain.handle('show-message', async (_, opts) => {
  return dialog.showMessageBox(mainWindow, opts)
})

// ── Жизненный цикл ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  console.log('[App] WashControl запускается...')

  // Запускаем backend
  startBackend()

  // Показываем сплэш (окно загрузки)
  const splashWin = new BrowserWindow({
    width: 420, height: 280,
    frame: false, alwaysOnTop: true,
    backgroundColor: '#0f172a',
    webPreferences: { nodeIntegration: false }
  })
  splashWin.loadFile(path.join(__dirname, 'splash.html'))

  // Ждём API
  const ready = await waitForApi(40)

  splashWin.close()

  if (!ready) {
    dialog.showErrorBox(
      'WashControl — Ошибка запуска',
      'Не удалось запустить Python backend.\n\nУбедитесь что Python установлен и зависимости подготовлены.'
    )
    app.quit()
    return
  }

  createWindow()
  createTray()
})

app.on('window-all-closed', () => {
  // Не выходим — работаем в трее
})

app.on('activate', () => {
  if (mainWindow) mainWindow.show()
})

app.on('before-quit', () => {
  app.isQuiting = true
  if (backendProcess) {
    backendProcess.kill('SIGTERM')
  }
})
