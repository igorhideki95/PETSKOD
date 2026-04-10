const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petskodAPI', {
  // Movimento da janela
  moveWindow: (deltaX, deltaY) => ipcRenderer.send('window-move', { deltaX, deltaY }),

  // Fechar app
  quitApp: () => ipcRenderer.send('app-quit'),

  // TTS — faz o personagem falar
  speak: (text) => ipcRenderer.send('tts-speak', text),

  // Notifica o main sobre mudança de estado (atualiza tray)
  notifyStateChange: (state) => ipcRenderer.send('state-change', state),

  // Escuta comandos do main → renderer
  onSpeechTest: (callback) => ipcRenderer.on('trigger-speech-test', callback),
  onForceState: (callback) => ipcRenderer.on('force-state', (event, state) => callback(state)),
});
