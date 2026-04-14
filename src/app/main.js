const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const logger = require('./logger');

// ── Error Boundaries ──────────────────────────────────────────────────────────
process.on('uncaughtException', (error) => {
  logger.error(error, 'Main Process (Uncaught)');
});
process.on('unhandledRejection', (reason) => {
  logger.error(new Error(String(reason)), 'Main Process (Rejection)');
});

let mainWindow;
let tray;
let isVisible = true;
let store;

// ── Janela principal ──────────────────────────────────────────────────────────

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const defaultBounds = { width: 500, height: 500, x: width - 520, y: height - 520 };
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
    // Tenta extrair a categoria entre colchetes, ex: [Character]
    const match = message.match(/^\[([^\]]+)\]/);
    const source = match ? match[1] : `Renderer:${line}`;
    const cleanMessage = match ? message.replace(match[0], '').trim() : message;
    
    // Nível de log mapeado do Chromium
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    logger.log(cleanMessage, levels[level] || 'INFO', source);
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

// Logging via IPC (do Renderer para o Main)
ipcMain.on('log-error', (event, { message, stack }) => {
  logger.error({ message, stack }, 'Processo de Renderização');
});

ipcMain.on('window-move', (event, { deltaX, deltaY }) => {
  if (!mainWindow) return;
  const [x, y] = mainWindow.getPosition();
  mainWindow.setPosition(x + deltaX, y + deltaY);
});

ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.setIgnoreMouseEvents(ignore, options);
});

ipcMain.on('app-quit', () => app.quit());

ipcMain.handle('get-last-state', () => {
  try {
    return store ? store.get('lastState') : 'idle';
  } catch (err) {
    logger.error(err, 'Main (get-last-state)');
    return 'idle';
  }
});

ipcMain.handle('get-app-data', () => {
  try {
    return store ? store.get('appData') : null;
  } catch (err) {
    logger.error(err, 'Main (get-app-data)');
    return null;
  }
});

ipcMain.handle('list-animations', async () => {
  const animPath = path.join(__dirname, '../../assets/models/animations');
  try {
    if (!fs.existsSync(animPath)) {
      fs.mkdirSync(animPath, { recursive: true });
      return [];
    }
    const files = fs.readdirSync(animPath);
    return files.filter(f => f.endsWith('.fbx') || f.endsWith('.glb'));
  } catch (err) {
    logger.error(err, 'Main (list-animations)');
    return [];
  }
});

ipcMain.on('save-app-data', (event, data) => {
  if (store) store.set('appData', data);
});

ipcMain.handle('list-models', async () => {
  const modelsPath = path.join(__dirname, '../../assets/models');
  try {
    if (!fs.existsSync(modelsPath)) return [];
    const files = fs.readdirSync(modelsPath); // CORREÇÃO: Usando 'fs' global
    return files.filter(f => 
      (f.startsWith('character') && (f.endsWith('.fbx') || f.endsWith('.glb')))
    );
  } catch (e) {
    logger.error(e, 'Main (list-models)');
    return [];
  }
});

ipcMain.on('tts-speak', (event, payload) => {
  const isObject = typeof payload === 'object' && payload !== null;
  const rawText = isObject ? payload.text : payload;
  const rate = isObject ? (payload.rate || 0) : 0;
  const pitch = isObject ? (payload.pitch || 'medium') : 'medium';

  const text = String(rawText || '')
    .replace(/[<>'"`;\\]/g, '') // Remove todos os caracteres potencialmente perigosos
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);

  if (!text || text.length < 1) {
    logger.warn('TTS rejeitou texto vazio ou muito curto', 'TTS');
    return;
  }

  const safeRate = typeof rate === 'number' && rate >= -10 && rate <= 10 ? rate : 0;
  const validPitches = ['low', 'medium', 'high', 'x-low', 'x-high'];
  const safePitch = validPitches.includes(String(pitch).toLowerCase()) ? pitch : 'medium';

  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='pt-BR'><prosody rate="${safeRate}" pitch="${safePitch}">${text}</prosody></speak>`;

  const psScriptPath = path.join(app.getPath('userData'), 'tts-script.ps1');

  try {
    const escapedText = text.replace(/'/g, "''").replace(/"/g, '`"');
    const scriptContent = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = ${safeRate}
switch ('${safePitch}') {
  'x-low' { $synth.Volume = 50; $synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female, [System.Speech.Synthesis.VoiceAge]::Child) }
  'low' { $synth.Volume = 70 }
  'high' { $synth.Volume = 100; $synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female, [System.Speech.Synthesis.VoiceAge]::Teen) }
  'x-high' { $synth.Volume = 100; $synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female, [System.Speech.Synthesis.VoiceAge]::Child) }
}
$ssml = @'
${ssml}
'@
try {
  $synth.SpeakSsml($ssml)
} catch {
  $synth.Speak('${escapedText}')
}
`;

    fs.writeFileSync(psScriptPath, scriptContent, 'utf8');

    const { spawn } = require('child_process');
    const child = spawn('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-File', psScriptPath
    ]);

    child.on('error', (err) => {
      logger.error(err, 'TTS (Spawn Error)');
    });

    child.on('close', (code) => {
      try { fs.unlinkSync(psScriptPath); } catch {}
    });

    const timer = setTimeout(() => {
      child.kill();
      try { fs.unlinkSync(psScriptPath); } catch {}
    }, 12000);

    child.on('exit', () => clearTimeout(timer));

  } catch (err) {
    logger.error(err, 'TTS (Main Handler)');
  }
});

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
  try {
    require('../../scripts/generate-icon.js');
  } catch { /* silencioso */ }

  const Store = require('../storage/persistence.js');
  store = new Store({
    configName: 'petskod-preferences',
    defaults: { windowBounds: null, lastState: 'idle' }
  });

  createWindow();
  createTray();
}).catch(err => {
  logger.error(err, 'App Ready Lifecycle');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') tray?.destroy();
});

app.on('before-quit', () => {
  tray?.destroy();
});
