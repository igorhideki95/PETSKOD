// state/state.js
// Gerencia o estado global do personagem e timers de variação de idle

import { CharacterState } from '../character/character.js';

export class StateManager {
  constructor(character, statusLabel) {
    this.character = character;
    this.statusLabel = statusLabel;
    this._idleVariationTimer = null;
    this._statusTimeout = null;

    // Inicia o ciclo de variações de idle
    this._scheduleIdleVariation();
  }

  /**
   * Programa próxima variação de idle (ocorre ocasionalmente)
   */
  _scheduleIdleVariation() {
    // Intervalo entre 8s e 20s
    const delay = 8000 + Math.random() * 12000;

    this._idleVariationTimer = setTimeout(() => {
      if (this.character.state === CharacterState.IDLE) {
        this._doIdleVariation();
      }
      this._scheduleIdleVariation();
    }, delay);
  }

  /**
   * Executa uma variação aleatória de idle
   */
  _doIdleVariation() {
    const variations = [
      { msg: 'Olhando ao redor...', anim: 'idle_look' },
      { msg: 'Bocejando...', anim: 'yawn' },
      { msg: 'Acenando...', anim: 'wave' },
      { msg: 'Pensando...', anim: 'thinking' },
    ];

    const v = variations[Math.floor(Math.random() * variations.length)];
    this.showStatus(v.msg);

    // Tenta tocar a animação (pode não existir no modelo atual)
    if (this.character.animations[v.anim.toLowerCase()]) {
      this.character.state = CharacterState.IDLE_VARIATION;
      this.character.playAnimation(v.anim, false);

      setTimeout(() => {
        this.character.playAnimation('idle', true);
        this.character.state = CharacterState.IDLE;
      }, 2000);
    }
  }

  /**
   * Exibe uma mensagem de status temporária
   * @param {string} msg
   * @param {number} duration - ms
   */
  showStatus(msg, duration = 2500) {
    if (!this.statusLabel) return;

    this.statusLabel.textContent = msg;
    this.statusLabel.classList.add('visible');

    clearTimeout(this._statusTimeout);
    this._statusTimeout = setTimeout(() => {
      this.statusLabel.classList.remove('visible');
    }, duration);
  }

  destroy() {
    clearTimeout(this._idleVariationTimer);
    clearTimeout(this._statusTimeout);
  }
}
