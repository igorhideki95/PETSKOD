const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petskodAPI', {
  // Movimento da janela
  moveWindow: (deltaX, deltaY) => ipcRenderer.send('window-move', { deltaX, deltaY }),

  // Controle de colisão pass-through
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),

  // Fechar app
  quitApp: () => ipcRenderer.send('app-quit'),

  // TTS — faz o personagem falar
  speak: (text) => ipcRenderer.send('tts-speak', text),

  // Notifica o main sobre mudança de estado (atualiza tray)
  notifyStateChange: (state) => ipcRenderer.send('state-change', state),

  // Obter estado inicial
  getLastState: () => ipcRenderer.invoke('get-last-state'),

  // Sistema de evolução/memória
  getAppData: () => ipcRenderer.invoke('get-app-data'),
  saveAppData: (data) => ipcRenderer.send('save-app-data', data),

  // Scan de animações extras e modelos
  listAnimations: () => ipcRenderer.invoke('list-animations'),
  listModels: () => ipcRenderer.invoke('list-models'),

  // Logging remoto
  logError: (errInfo) => ipcRenderer.send('log-error', errInfo),

  // Escuta comandos do main → renderer
  onSpeechTest: (callback) => ipcRenderer.on('trigger-speech-test', callback),
  onForceState: (callback) => ipcRenderer.on('force-state', (event, state) => callback(state)),
  onContextMenuAction: (callback) => ipcRenderer.on('context-menu-action', (event, action) => callback(action)),
});
