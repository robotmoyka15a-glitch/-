/**
 * WashControl — Electron main process
 * Запускает Python backend и открывает окно приложения
 */

const { app, BrowserWindow, Tray, Menu, shell, ipcMain, dialog } = require('electron')
const path   = require('path')
const { spawn } = require('child_process')
const fs     = require('fs')
const http   = require('http')

const isDev  = process.env.NODE_ENV === 'development' || !app.isPackaged
const API_PORT = 8765
const API_URL  = `http://127.0.0.1:${API_PORT}`

let mainWindow     = null
let tray           = null
let backendProcess = null
let splashWin      = null

// ── Авторестарт backend ───────────────────────────────────────────────────────
let backendRestartCount = 0
const MAX_RESTARTS = 3

// ── Путь к данным (хранение настроек окна) ───────────────────────────────────
const userDataPath = app.getPath('userData')
const windowStatePath = path.join(userDataPath, 'window-state.json')

function loadWindowState() {
  try {
    if (fs.existsSync(windowStatePath)) {
      return JSON.parse(fs.readFileSync(windowStatePath, 'utf8'))
    }
  } catch (e) {
    console.warn('[WindowState] Не удалось загрузить:', e.message)
  }
  return { width: 1400, height: 900, x: undefined, y: undefined }
}

function saveWindowState(win) {
  try {
    if (!win || win.isDestroyed()) return
    const bounds = win.getBounds()
    fs.writeFileSync(windowStatePath, JSON.stringify(bounds), 'utf8')
  } catch (e) {
    console.warn('[WindowState] Не удалось сохранить:', e.message)
  }
}

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

  // ── Авторестарт при падении ───────────────────────────────────────────────
  backendProcess.on('exit', (code) => {
    console.log(`[Backend] Процесс завершён с кодом ${code}`)
    if (!app.isQuiting && backendRestartCount < MAX_RESTARTS) {
      backendRestartCount++
      console.log(`[Backend] Перезапуск #${backendRestartCount} через 2 сек...`)
      setTimeout(startBackend, 2000)
    } else if (!app.isQuiting && backendRestartCount >= MAX_RESTARTS) {
      console.error('[Backend] Превышен лимит перезапусков, останавливаемся')
      if (mainWindow) {
        dialog.showErrorBox(
          'WashControl — Критическая ошибка',
          `Backend упал ${MAX_RESTARTS} раз подряд и больше не перезапускается.\n\nПроверьте логи и перезапустите приложение вручную.`
        )
      }
    }
  })
}

// ── Ожидание готовности API ───────────────────────────────────────────────────
async function waitForApi(maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 1000))

    // Обновляем текст сплэш-экрана каждую секунду
    if (splashWin && !splashWin.isDestroyed()) {
      const elapsed = i + 1
      const dots = '.'.repeat((elapsed % 3) + 1)
      splashWin.webContents.executeJavaScript(
        `updateProgress(${elapsed}, ${maxAttempts}, '${dots}')`
      ).catch(() => {})
    }

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

// ── Запрос статуса /health ────────────────────────────────────────────────────
async function fetchHealthStatus() {
  return new Promise((resolve) => {
    try {
      const req = http.get(`${API_URL}/health`, (res) => {
        let body = ''
        res.on('data', d => { body += d })
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const json = JSON.parse(body)
              resolve({ ok: true, status: json.status || 'ok', body })
            } catch {
              resolve({ ok: true, status: 'ok', body })
            }
          } else {
            resolve({ ok: false, status: `HTTP ${res.statusCode}`, body })
          }
        })
      })
      req.on('error', (e) => resolve({ ok: false, status: 'недоступен', error: e.message }))
      req.setTimeout(2000, () => { req.destroy(); resolve({ ok: false, status: 'таймаут' }) })
    } catch (e) {
      resolve({ ok: false, status: 'ошибка', error: e.message })
    }
  })
}

// ── Главное окно ──────────────────────────────────────────────────────────────
function createWindow() {
  const state = loadWindowState()

  mainWindow = new BrowserWindow({
    width:           state.width  || 1400,
    height:          state.height || 900,
    x:               state.x,
    y:               state.y,
    minWidth:        1100,
    minHeight:       700,
    title:           'WashControl',
    backgroundColor: '#0f172a',
    frame:           true,
    show:            false,
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      preload:          path.join(__dirname, 'preload.js'),
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

  // ── Сохранение размера/позиции при изменении ──────────────────────────────
  const saveBoundsDebounced = debounce(() => saveWindowState(mainWindow), 500)
  mainWindow.on('resize', saveBoundsDebounced)
  mainWindow.on('move',   saveBoundsDebounced)

  // Свернуть в трей вместо закрытия
  mainWindow.on('close', (e) => {
    if (!app.isQuiting) {
      saveWindowState(mainWindow)
      e.preventDefault()
      mainWindow.hide()
    }
  })
}

// ── Debounce ──────────────────────────────────────────────────────────────────
function debounce(fn, delay) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

// ── Системный трей ────────────────────────────────────────────────────────────
function createTray() {
  const iconCandidates = [
    path.join(__dirname, '..', 'public', 'icon.png'),
    path.join(__dirname, '..', 'public', 'vite.svg'),
    path.join(__dirname, '..', 'public', 'favicon.ico'),
  ]
  const iconPath = iconCandidates.find(p => fs.existsSync(p)) || iconCandidates[0]

  try {
    tray = new Tray(iconPath)
    rebuildTrayMenu()
    tray.setToolTip('WashControl — Автомойка')
    tray.on('double-click', () => { mainWindow.show(); mainWindow.focus() })
  } catch (e) {
    console.warn('[Tray] Не удалось создать иконку трея:', e.message)
  }
}

function rebuildTrayMenu(apiStatus) {
  if (!tray) return
  const statusLabel = apiStatus
    ? `Статус API: ${apiStatus}`
    : 'Статус API: проверяю...'

  const menu = Menu.buildFromTemplate([
    {
      label: 'Открыть WashControl',
      click: () => { mainWindow.show(); mainWindow.focus() }
    },
    { type: 'separator' },
    {
      label: statusLabel,
      enabled: false,
    },
    {
      label: 'Проверить статус API',
      click: async () => {
        const health = await fetchHealthStatus()
        const msg = health.ok
          ? `✅ API работает нормально\nСтатус: ${health.status}`
          : `❌ API недоступен\nСтатус: ${health.status}${health.error ? '\n' + health.error : ''}`
        dialog.showMessageBox(mainWindow, {
          type: health.ok ? 'info' : 'error',
          title: 'Статус API — WashControl',
          message: msg,
          buttons: ['OK'],
        })
        rebuildTrayMenu(health.ok ? `✅ ${health.status}` : `❌ ${health.status}`)
      }
    },
    { type: 'separator' },
    {
      label: 'Перезапустить сервер',
      click: async () => {
        const { response } = await dialog.showMessageBox(mainWindow, {
          type: 'question',
          title: 'Перезапуск сервера',
          message: 'Перезапустить Python backend?',
          buttons: ['Перезапустить', 'Отмена'],
          defaultId: 0,
        })
        if (response === 0) {
          backendRestartCount = 0 // сбросить счётчик
          if (backendProcess) backendProcess.kill('SIGTERM')
          await new Promise(r => setTimeout(r, 1500))
          startBackend()
          rebuildTrayMenu('🔄 перезапуск...')
        }
      }
    },
    {
      label: 'Открыть папку данных',
      click: () => {
        const dataPath = getResourcePath('data')
        shell.openPath(dataPath)
      }
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
  tray.setContextMenu(menu)
}

// Периодически обновляем статус API в меню трея (каждые 30 сек)
function startTrayStatusUpdater() {
  const update = async () => {
    if (!tray) return
    const health = await fetchHealthStatus()
    rebuildTrayMenu(health.ok ? `✅ ${health.status}` : `❌ ${health.status}`)
  }
  update()
  setInterval(update, 30_000)
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

// Перезапуск backend (например, при смене Telegram-токена)
ipcMain.handle('restart-backend', async () => {
  console.log('[IPC] Запрос на перезапуск backend...')
  backendRestartCount = 0 // сбросить счётчик авторестарта
  if (backendProcess) {
    backendProcess.kill('SIGTERM')
  }
  await new Promise(r => setTimeout(r, 1500))
  startBackend()
  rebuildTrayMenu('🔄 перезапуск...')
  return { ok: true }
})

// ── Жизненный цикл ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  console.log('[App] WashControl запускается...')

  // Запускаем backend
  startBackend()

  // Показываем сплэш-экран
  splashWin = new BrowserWindow({
    width: 460, height: 300,
    frame: false, alwaysOnTop: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: false,  // нужно для executeJavaScript
    }
  })
  splashWin.loadFile(path.join(__dirname, 'splash.html'))

  // Ждём API (максимум 60 секунд)
  const ready = await waitForApi(60)

  if (splashWin && !splashWin.isDestroyed()) {
    splashWin.close()
    splashWin = null
  }

  if (!ready) {
    dialog.showErrorBox(
      'WashControl — Ошибка запуска',
      'Не удалось запустить Python backend за 60 секунд.\n\nУбедитесь что Python установлен и зависимости подготовлены.'
    )
    app.quit()
    return
  }

  createWindow()
  createTray()
  startTrayStatusUpdater()
})

app.on('window-all-closed', () => {
  // Не выходим — работаем в трее
})

app.on('activate', () => {
  if (mainWindow) mainWindow.show()
})

app.on('before-quit', () => {
  app.isQuiting = true
  if (mainWindow && !mainWindow.isDestroyed()) {
    saveWindowState(mainWindow)
  }
  if (backendProcess) {
    backendProcess.kill('SIGTERM')
  }
})
