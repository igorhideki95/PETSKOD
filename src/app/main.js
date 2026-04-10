const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const { exec } = require('child_process');
const path = require('path');

// ── Error Boundaries ──────────────────────────────────────────────────────────
process.on('uncaughtException', (error) => {
  console.error('[PETSKOD Fatal Erro]', error);
});
process.on('unhandledRejection', (reason) => {
  console.error('[PETSKOD Unhandled Rejection]', reason);
});

let mainWindow;
let tray;
let isVisible = true;
let store;

// ── Janela principal ──────────────────────────────────────────────────────────

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const defaultBounds = { width: 250, height: 350, x: width - 280, y: height - 380 };
  const bounds = store.get('windowBounds') || defaultBounds;

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x >= 0 ? bounds.x : defaultBounds.x,
    y: bounds.y >= 0 ? bounds.y : defaultBounds.y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true);
  mainWindow.loadFile(path.join(__dirname, '../../index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer Line ${line}]: ${message}`);
  });

  // Save bounds when window is moved
  mainWindow.on('moved', saveBounds);

  mainWindow.on('closed', () => { mainWindow = null; });
}

function saveBounds() {
  if (mainWindow && store) {
    const [x, y] = mainWindow.getPosition();
    const [width, height] = mainWindow.getSize();
    store.set('windowBounds', { x, y, width, height });
  }
}

// ── Tray (bandeja do sistema) ─────────────────────────────────────────────────

function createTray() {
  const iconPath = path.join(__dirname, '../../assets/icons/petskod.png');
  let icon;

  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) throw new Error('Ícone vazio');
  } catch {
    // Fallback: círculo roxo 1x1 escalado
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('PETSKOD — Seu companheiro 3D');
  rebuildTrayMenu();

  tray.on('click', () => {
    toggleVisibility();
  });
}

function rebuildTrayMenu() {
  if (!tray) return;

  const menu = Menu.buildFromTemplate([
    {
      label: isVisible ? '🙈 Ocultar companheiro' : '👁️ Mostrar companheiro',
      click: toggleVisibility,
    },
    { type: 'separator' },
    {
      label: '🔊 Testar fala',
      click: () => {
        if (mainWindow) mainWindow.webContents.send('trigger-speech-test');
      },
    },
    {
      label: '😴 Dormindo',
      click: () => {
        if (mainWindow) mainWindow.webContents.send('force-state', 'sleeping');
      },
    },
    {
      label: '😊 Feliz',
      click: () => {
        if (mainWindow) mainWindow.webContents.send('force-state', 'happy');
      },
    },
    { type: 'separator' },
    {
      label: '❌ Fechar PETSKOD',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(menu);
}

function toggleVisibility() {
  if (!mainWindow) return;
  isVisible ? mainWindow.hide() : mainWindow.show();
  isVisible = !isVisible;
  rebuildTrayMenu();
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────

// Mover janela via drag
ipcMain.on('window-move', (event, { deltaX, deltaY }) => {
  if (!mainWindow) return;
  const [x, y] = mainWindow.getPosition();
  mainWindow.setPosition(x + deltaX, y + deltaY);
});

// Fechar app
ipcMain.on('app-quit', () => app.quit());

// Obter estado inicial persistido
ipcMain.handle('get-last-state', () => {
  return store ? store.get('lastState') : 'idle';
});

// App data para progression e stats
ipcMain.handle('get-app-data', () => {
  return store ? store.get('appData') : null;
});

ipcMain.on('save-app-data', (event, data) => {
  if (store) store.set('appData', data);
});

// TTS via PowerShell (Windows SAPI) — usa arquivo .ps1 temporário para evitar escape de aspas
ipcMain.on('tts-speak', (event, rawText) => {
  const text = String(rawText)
    .replace(/[^\w\sáàãâéèêíìîóòõôúùûçÁÀÃÂÉÈÊÍÌÎÓÒÕÔÚÙÛÇ!?,.:;]/g, ' ')
    .replace(/[\r\n]/g, ' ')
    .trim()
    .substring(0, 200);

  if (!text) return;

  const os = require('os');
  const fsSync = require('fs');
  const tmpFile = path.join(os.tmpdir(), `petskod_tts_${Date.now()}.ps1`);

  const psScript = [
    'Add-Type -AssemblyName System.Speech',
    '$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    `$synth.Speak(@'`,
    text,
    `'@)`,
  ].join('\n');

  try {
    fsSync.writeFileSync(tmpFile, psScript, 'utf8');
    exec(`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpFile}"`,
      { timeout: 12000 },
      (err) => {
        try { fsSync.unlinkSync(tmpFile); } catch { /* ok */ }
        if (err && !err.killed) {
          console.warn('[TTS] Aviso:', err.message?.split('\n')[0]);
        }
      }
    );
  } catch (writeErr) {
    console.error('[TTS] Erro ao escrever script:', writeErr.message);
  }
});

// Notificação de mudança de estado (para atualizar o tray tooltip)
ipcMain.on('state-change', (event, state) => {
  if (store) store.set('lastState', state);
  if (!tray) return;
  const stateEmojis = {
    idle: '😊',
    happy: '🎉',
    bored: '😐',
    sleeping: '😴',
    reacting: '⭐',
  };
  tray.setToolTip(`PETSKOD — ${stateEmojis[state] || '🐾'} ${state}`);
});

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Gera ícone se não existir
  try {
    require('../../scripts/generate-icon.js');
  } catch { /* silencioso */ }

  // Inicializa Persistência
  const Store = require('../storage/persistence.js');
  store = new Store({
    configName: 'petskod-preferences',
    defaults: { windowBounds: null, lastState: 'idle' }
  });

  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  // No macOS, manter o app rodando mesmo sem janelas é o padrão
  // No Windows/Linux, sair
  if (process.platform !== 'darwin') tray?.destroy();
});

app.on('before-quit', () => {
  tray?.destroy();
});
