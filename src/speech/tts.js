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
      console.warn('[TTS] Interface de voz indisponível ou desativada no sistema.');
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
   * @param {Object} options { rate, pitch }
   */
  speak(text, options = null) {
    if (!this._enabled) return;

    this._queue.push({ text, options });
    if (!this._speaking) this._processQueue();
  }

  _processQueue() {
    if (this._queue.length === 0) {
      this._speaking = false;
      return;
    }

    this._speaking = true;
    const item = this._queue.shift();
    const { text, options } = item;

    if (window.petskodAPI?.speak) {
      if (options) {
        window.petskodAPI.speak({ text, ...options });
      } else {
        window.petskodAPI.speak(text);
      }
    }

    // Estima o tempo de fala (≈ 100ms por caractere, mínimo 1s)
    // Adicionamos um pequeno buffer para vírgulas e pontos
    const duration = Math.max(1000, text.length * 105);
    setTimeout(() => this._processQueue(), duration);
  }
}
