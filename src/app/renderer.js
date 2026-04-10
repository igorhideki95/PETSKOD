// app/renderer.js — Phase 2
// Bootstrap principal - integra BehaviorSystem + TTSEngine + visual states

import { SceneManager } from '../rendering/scene.js';
import { ModelLoader } from '../rendering/loader.js';
import { Character } from '../character/character.js';
import { InputManager } from '../input/input.js';
import { BehaviorSystem } from '../behavior/behavior.js';
import { TTSEngine } from '../speech/tts.js';

// ── Configuração ──────────────────────────────────────────────────────────────
const MODEL_PATH = './assets/models/character.glb';

// ── Status Label helper ───────────────────────────────────────────────────────
class StatusLabel {
  constructor(el) {
    this._el = el;
    this._timeout = null;
  }

  show(text, duration = 2500) {
    if (!this._el) return;
    this._el.textContent = text;
    this._el.classList.add('visible');
    clearTimeout(this._timeout);
    this._timeout = setTimeout(() => this._el.classList.remove('visible'), duration);
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function init() {
  const container = document.getElementById('app');
  const statusEl = document.getElementById('status-label');
  const btnClose = document.getElementById('btn-close');
  const speechBubble = document.getElementById('speech-bubble');
  const speechText = document.getElementById('speech-text');

  const statusLabel = new StatusLabel(statusEl);

  // 1. Cena Three.js
  const sceneManager = new SceneManager(container);

  // 2. Personagem
  const character = new Character(sceneManager.scene);

  // 3. TTS
  const tts = new TTSEngine();

  // 4. Sistema de comportamento
  const behavior = new BehaviorSystem({
    onStateChange: (state) => {
      character.applyBehaviorState(state);
      if (window.petskodAPI) window.petskodAPI.notifyStateChange(state);
    },
    onSpeak: (text) => {
      tts.speak(text);
      showSpeechBubble(text);
    },
    onStatus: (text, duration) => {
      statusLabel.show(text, duration);
    },
  });

  // 5. Tenta carregar modelo GLB
  try {
    const loader = new ModelLoader();
    const { scene: modelScene, animations } = await loader.load(MODEL_PATH);
    character.init(modelScene, animations);
    console.log('[PETSKOD] Modelo GLB carregado!');
  } catch {
    console.warn('[PETSKOD] Usando personagem placeholder.');
    character.initPlaceholder();
  }

  // 6. Input — passa o BehaviorSystem em vez do StateManager antigo
  new InputManager(sceneManager.renderer, sceneManager.camera, character, behavior);

  // 7. Loop de render
  sceneManager.onRender((delta) => character.update(delta));
  sceneManager.startLoop();

  // 8. Botão fechar
  btnClose.addEventListener('click', () => window.petskodAPI?.quitApp());

  // 9. Comandos do main process (via tray)
  if (window.petskodAPI) {
    window.petskodAPI.onSpeechTest(() => {
      tts.speak('Olá! Eu sou o PETSKOD!');
      showSpeechBubble('Olá! Eu sou o PETSKOD! 🐾');
    });

    window.petskodAPI.onForceState((state) => {
      behavior._setState(state);
      character.applyBehaviorState(state);
    });
  }

  // ── Balão de fala ─────────────────────────────────────────────────────────

  let speechBubbleTimeout = null;

  function showSpeechBubble(text) {
    if (!speechBubble || !speechText) return;
    speechText.textContent = text;
    speechBubble.classList.add('visible');
    clearTimeout(speechBubbleTimeout);
    const duration = Math.max(2000, text.length * 80);
    speechBubbleTimeout = setTimeout(() => speechBubble.classList.remove('visible'), duration);
  }

  console.log('[PETSKOD] Phase 2 iniciada! 🎉');
}

init().catch(console.error);
