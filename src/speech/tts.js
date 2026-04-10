// speech/tts.js
// Wrapper de Text-to-Speech no lado do renderer
// Delega para o processo principal via IPC (que usa PowerShell SAPI no Windows)

export class TTSEngine {
  constructor() {
    this._enabled = true;
    this._queue = [];
    this._speaking = false;
    this._checkAPI();
  }

  _checkAPI() {
    if (!window.petskodAPI?.speak) {
      console.warn('[TTS] API de fala não disponível. Verifique o preload.js');
      this._enabled = false;
    }
  }

  /** Habilita ou desabilita o TTS */
  setEnabled(enabled) {
    this._enabled = enabled;
    if (!enabled) this._queue = [];
  }

  /**
   * Coloca uma frase na fila de fala
   * @param {string} text
   */
  speak(text) {
    if (!this._enabled) return;

    this._queue.push(text);
    if (!this._speaking) this._processQueue();
  }

  _processQueue() {
    if (this._queue.length === 0) {
      this._speaking = false;
      return;
    }

    this._speaking = true;
    const text = this._queue.shift();

    if (window.petskodAPI?.speak) {
      window.petskodAPI.speak(text);
    }

    // Estima o tempo de fala (≈ 80ms por caractere, mínimo 800ms)
    const duration = Math.max(800, text.length * 80);
    setTimeout(() => this._processQueue(), duration);
  }
}
