// behavior/behavior.js
// Máquina de estados do personagem: IDLE → BORED → SLEEPING, interação → HAPPY

import { randomPhrase } from './phrases.js';

export const BehaviorState = {
  IDLE: 'idle',
  HAPPY: 'happy',
  BORED: 'bored',
  SLEEPING: 'sleeping',
  REACTING: 'reacting',
};

// Tempos em ms para transições automáticas
const BORED_TIMEOUT = 30_000;    // 30s sem interação → entediado
const SLEEPING_TIMEOUT = 90_000; // 90s sem interação → dormindo
const HAPPY_DURATION = 5_000;    // 5s no estado feliz → volta ao idle
const SPEECH_INTERVAL_MIN = 15_000; // fala no mínimo a cada 15s
const SPEECH_INTERVAL_MAX = 40_000; // fala no máximo a cada 40s

export class BehaviorSystem {
  /**
   * @param {Object} callbacks
   * @param {function(string)} callbacks.onStateChange
   * @param {function(string)} callbacks.onSpeak
   * @param {function(string)} callbacks.onStatus
   */
  constructor(callbacks) {
    this._cb = callbacks;
    this._state = BehaviorState.IDLE;
    this._lastInteraction = Date.now();

    this._boredTimer = null;
    this._sleepTimer = null;
    this._happyTimer = null;
    this._speechTimer = null;

    this._start();
  }

  get state() { return this._state; }

  _start() {
    this._scheduleBoredTransition();
    this._scheduleSpeech();

    // Saudação inicial
    setTimeout(() => {
      this._speak('greeting');
      this._showStatus('Olá! 🐾');
    }, 1200);
  }

  // ── Transições de estado ────────────────────────────────────────────────────

  _scheduleBoredTransition() {
    clearTimeout(this._boredTimer);
    clearTimeout(this._sleepTimer);

    this._boredTimer = setTimeout(() => {
      if (this._state === BehaviorState.IDLE) {
        this._setState(BehaviorState.BORED);
        this._speak('bored');
        this._showStatus('Entediado...');
      }

      this._sleepTimer = setTimeout(() => {
        if (this._state === BehaviorState.BORED) {
          this._setState(BehaviorState.SLEEPING);
          this._speak('sleeping');
          this._showStatus('Zzz... 💤');
        }
      }, SLEEPING_TIMEOUT - BORED_TIMEOUT);

    }, BORED_TIMEOUT);
  }

  _setState(newState) {
    if (this._state === newState) return;
    const prev = this._state;
    this._state = newState;
    console.log(`[Behavior] ${prev} → ${newState}`);
    this._cb.onStateChange(newState);
  }

  // ── Interação ───────────────────────────────────────────────────────────────

  /** Chamado quando o usuário interage (clique, etc.) */
  interact() {
    const wasSleeping = this._state === BehaviorState.SLEEPING;

    clearTimeout(this._happyTimer);

    if (wasSleeping) {
      this._speak('wakeUp');
      this._showStatus('Acordei! 😮');
    } else {
      this._speak('reaction');
      this._showStatus('Ei! 👋');
    }

    this._setState(BehaviorState.HAPPY);
    this._lastInteraction = Date.now();
    this._scheduleBoredTransition(); // reseta os timers de tédio

    // Volta ao idle após HAPPY_DURATION
    this._happyTimer = setTimeout(() => {
      if (this._state === BehaviorState.HAPPY) {
        this._setState(BehaviorState.IDLE);
      }
    }, HAPPY_DURATION);
  }

  // ── Fala aleatória ──────────────────────────────────────────────────────────

  _scheduleSpeech() {
    const delay = SPEECH_INTERVAL_MIN + Math.random() * (SPEECH_INTERVAL_MAX - SPEECH_INTERVAL_MIN);
    this._speechTimer = setTimeout(() => {
      this._speakForCurrentState();
      this._scheduleSpeech();
    }, delay);
  }

  _speakForCurrentState() {
    const category = this._state === BehaviorState.REACTING ? 'reaction' : this._state;
    this._speak(category);

    // Mostra uma versão curta como status também
    const statusMap = {
      [BehaviorState.IDLE]: null,
      [BehaviorState.HAPPY]: 'Feliz! 😊',
      [BehaviorState.BORED]: 'Entediado...',
      [BehaviorState.SLEEPING]: 'Zzz... 💤',
    };
    const status = statusMap[this._state];
    if (status) this._showStatus(status);
  }

  _speak(category) {
    const phrase = randomPhrase(category);
    this._cb.onSpeak(phrase);
  }

  _showStatus(text, duration = 2500) {
    this._cb.onStatus(text, duration);
  }

  // ── Ciclo de vida ───────────────────────────────────────────────────────────

  destroy() {
    clearTimeout(this._boredTimer);
    clearTimeout(this._sleepTimer);
    clearTimeout(this._happyTimer);
    clearTimeout(this._speechTimer);
  }
}
