// app/renderer.js — Phase 2
// Bootstrap principal - integra BehaviorSystem + TTSEngine + visual states

import { SceneManager } from '../rendering/scene.js';
import { ModelLoader } from '../rendering/loader.js';
import { Character } from '../character/character.js';
import { InputManager } from '../input/input.js';
import { BehaviorSystem } from '../behavior/behavior.js';
import { TTSEngine } from '../speech/tts.js';
import { AmbientManager } from '../effects/ambient.js';
import { HeartEmitter } from '../effects/hearts.js';

// ── Error Boundaries ──────────────────────────────────────────────────────────
window.onerror = function (message, source, lineno, colno, error) {
  console.error('[System] Erro fatal detectado no processo Renderer:', message, error);
  
  if (window.petskodAPI?.logError) {
    window.petskodAPI.logError({
      message: message,
      stack: error?.stack || `at ${source}:${lineno}:${colno}`
    });
  }

  const statusEl = document.getElementById('status-label');
  if (statusEl) {
    statusEl.textContent = 'Erro interno ⚠️';
    statusEl.classList.add('visible');
    setTimeout(() => statusEl.classList.remove('visible'), 3000);
  }
};

window.onunhandledrejection = function (event) {
  console.error('[System] Rejeição de promessa não tratada (Unhandled Rejection):', event.reason);
  if (window.petskodAPI?.logError) {
    window.petskodAPI.logError({
      message: String(event.reason),
      stack: event.reason?.stack || 'Promessa rejeitada sem stack'
    });
  }
};

// ── UI Manager ──────────────────────────────────────────────────────────────
class UIManager {
  constructor() {
    this._statusEl = document.getElementById('status-label');
    this._speechBubble = document.getElementById('speech-bubble');
    this._speechText = document.getElementById('speech-text');
    this._contextMenu = document.getElementById('context-menu');
    this._characterList = document.getElementById('character-list');
    this._menuMain = document.getElementById('menu-main');
    this._menuSettings = document.getElementById('menu-settings');
    this._statusTimeout = null;
    this._speechTimeout = null;

    this._initContextMenu();
  }

  _initContextMenu() {
    if (!this._contextMenu) return;
    this._contextMenu.addEventListener('click', (e) => {
      const item = e.target.closest('.menu-item');
      if (!item) return;

      const action = item.getAttribute('data-action');
      const modelName = item.getAttribute('data-model');
      const isQuit = item.getAttribute('action-quit');

      if (isQuit) {
        window.petskodAPI?.quitApp();
      } else if (modelName && this.onCharacterChange) {
        this.onCharacterChange(modelName);
      } else if (action && this.onAction) {
        this.onAction(action);
      }
      this.hideContextMenu();
    });

    window.addEventListener('click', () => this.hideContextMenu());
  }

  updateCharacterList(models, current) {
    if (!this._characterList) return;
    this._characterList.innerHTML = '';
    models.forEach(m => {
      const item = document.createElement('div');
      item.className = 'menu-item';
      item.setAttribute('data-model', m);
      const isCurrent = m === current;
      item.innerHTML = `${isCurrent ? '🔘' : '⚪'} ${m.replace('character-', '').replace('.fbx', '').replace('.glb', '')}`;
      if (isCurrent) item.style.fontWeight = '800';
      this._characterList.appendChild(item);
    });
  }

  showStatus(text, duration = 2500) {
    if (!this._statusEl) return;
    this._statusEl.textContent = text;
    this._statusEl.classList.add('visible');
    clearTimeout(this._statusTimeout);
    this._statusTimeout = setTimeout(() => this._statusEl.classList.remove('visible'), duration);
  }

  showSpeech(text) {
    if (!this._speechBubble || !this._speechText) return;
    this._speechText.textContent = text;
    this._speechBubble.classList.add('visible');
    clearTimeout(this._speechTimeout);
    const duration = Math.max(2000, text.length * 105);
    this._speechTimeout = setTimeout(() => this._speechBubble.classList.remove('visible'), duration);
  }

  showContextMenu(x, y) {
    if (!this._contextMenu) return;
    
    this._contextMenu.style.display = 'flex';
    const menuWidth = this._contextMenu.offsetWidth || 165;
    const menuHeight = Math.min(this._contextMenu.scrollHeight, 420);
    this._contextMenu.style.display = 'none';
    
    const container = document.getElementById('app');
    const windowWidth = container?.clientWidth || 500;
    const windowHeight = container?.clientHeight || 500;
    
    const padding = 10;
    let posX = Math.max(padding, Math.min(x, windowWidth - menuWidth - padding));
    let posY = Math.max(padding, Math.min(y, windowHeight - menuHeight - padding));

    this._contextMenu.style.left = `${posX}px`;
    this._contextMenu.style.top = `${posY}px`;
    this._contextMenu.style.display = 'flex';
    
    this.switchMenu('main');
  }

  hideContextMenu() {
    if (this._contextMenu) this._contextMenu.style.display = 'none';
    if (this.onUIHoverChange) this.onUIHoverChange(false);
  }

  switchMenu(target) {
    if (!this._menuMain || !this._menuSettings) return;
    
    if (target === 'settings') {
      this._menuMain.style.display = 'none';
      this._menuSettings.style.display = 'flex';
    } else {
      this._menuMain.style.display = 'flex';
      this._menuSettings.style.display = 'none';
    }
  }

  /** Vincula ao InputManager para gerenciar o passthrough do mouse */
  bindInputExclusions(inputManager) {
    this.onUIHoverChange = (isOver) => {
      inputManager.isOverUI = isOver;
    };

    const elements = [this._contextMenu, document.getElementById('btn-close')].filter(Boolean);
    
    elements.forEach(el => {
      el.addEventListener('mouseenter', () => this.onUIHoverChange(true));
      el.addEventListener('mouseleave', () => {
        // Se for o menu, só sai do modo UI se ele estiver escondido ou se o mouse saiu dele de verdade
        if (el === this._contextMenu && this._contextMenu.style.display !== 'none') return;
        this.onUIHoverChange(false);
      });
      
      // Impede que o scroll chegue no sistema (desfocando janelas de fundo)
      el.addEventListener('wheel', (e) => e.stopPropagation(), { passive: false });
    });
  }

  dispose() {
    clearTimeout(this._statusTimeout);
    clearTimeout(this._speechTimeout);
  }
}

async function init() {
  const container = document.getElementById('app');
  const btnClose = document.getElementById('btn-close');
  const ui = new UIManager();

  // 1. Vincula o botão de fechar IMEDIATAMENTE para garantir controle do usuário
  // Isso deve vir antes de qualquer carregamento pesado (Three.js, modelos)
  if (btnClose) {
    btnClose.addEventListener('click', () => {
      console.log('[Renderer] Solicitando encerramento da aplicação via botão de interface...');
      window.petskodAPI?.quitApp();
    });
  }

  // 2. Cena Three.js
  const sceneManager = new SceneManager(container);
  const ambientManager = new AmbientManager(sceneManager.scene, sceneManager.lights);
  const character = new Character(sceneManager.scene);
  const tts = new TTSEngine();
  const heartEmitter = new HeartEmitter(sceneManager.scene);

  let appData = {};
  try {
    appData = window.petskodAPI?.getAppData ? await window.petskodAPI.getAppData() : {};
  } catch (err) {
    console.warn('[Renderer] Falha ao obter appData:', err);
  }
  let currentModelFile = appData.selectedModel || 'character.fbx';

  // 2. Sistema de comportamento
  const behavior = new BehaviorSystem({
    initialState: appData.lastState || 'idle',
    appData,
    onStateChange: (state) => {
      if (state === 'flair') {
        character.playSequence(['dance-flair-initial', 'dance-flair-middle', 'dance-flair-finishing'], {
          onComplete: () => behavior.forceState('idle')
        });
      } else {
        character.applyBehaviorState(state);
      }
      if (window.petskodAPI) window.petskodAPI.notifyStateChange(state);
    },
    onSpeak: (text) => {
      const profile = behavior.getVoiceProfile(character.voiceProfile);
      tts.speak(text, profile);
      ui.showSpeech(text);
    },
    onStatus: (text, duration) => ui.showStatus(text, duration),
    onSpecialReaction: (type) => {
      if (type === 'heart') heartEmitter.emit(character.model?.position || {x:0, y:0.5, z:0}, 5);
    },
    onDataChange: (data) => {
      const fullData = { ...data, selectedModel: currentModelFile };
      window.petskodAPI?.saveAppData(fullData);
    }
  });

  // 3. Loader de Personagem
  const loadCharacter = async (filename, isRetry = false) => {
    ui.showStatus(isRetry ? 'Tentando novamente...' : 'Carregando...', 1500);
    const loader = new ModelLoader();
    const modelPath = `./assets/models/${filename}`;
    
    try {
      const mainResult = await loader.load(modelPath);
      
      let extraClips = [];
      if (window.petskodAPI?.listAnimations) {
        try {
          const animFiles = await window.petskodAPI.listAnimations();
          const animUrls = animFiles.map(f => `./assets/models/animations/${f}`);
          extraClips = await loader.loadAnimations(animUrls);
        } catch (animErr) {
          console.warn('[Renderer] Falha ao carregar animações extras:', animErr);
        }
      }
      
      character.init(mainResult.scene, [...mainResult.animations, ...extraClips]);
      currentModelFile = filename;

      const charKey = filename.toLowerCase().includes('granny') ? 'granny' : 
                      filename.toLowerCase().includes('michelle') ? 'michelle' : null;
      behavior.setCharacterKey(charKey);
      
      try {
        const allModels = await window.petskodAPI.listModels();
        ui.updateCharacterList(allModels, currentModelFile);
      } catch (modelErr) {
        console.warn('[Renderer] Falha ao listar modelos:', modelErr);
      }
      
      ui.showStatus('Pronto!', 1500);
      return true;
    } catch (e) {
      console.error('[Renderer] Falha ao carregar personagem:', e);
      
      if (!isRetry) {
        console.log('[Renderer] Tentando modelo padrão como fallback...');
        return loadCharacter('character.fbx', true);
      }
      
      ui.showStatus('Erro ao carregar modelo', 4000);
      character.initPlaceholder();
      return false;
    }
  };

  // 4. Ações
  ui.onAction = (action) => {
    switch (action) {
      case 'feed': ui.showStatus('Hummm! 🍕'); behavior.interact(); break;
      case 'play': behavior.forceState('happy'); break;
      case 'pet': behavior.interact(); break;
      case 'dance-flair': behavior.forceState('flair'); break;
      case 'dance-random': {
        const dances = ['dance-chicken', 'dance-salsa', 'dance-samba', 'dance-shuffling', 'dance-hiphop'];
        const d = dances[Math.floor(Math.random()*dances.length)];
        character.playAnimation(d, false);
        setTimeout(() => behavior.forceState('idle'), 4000);
        break;
      }
      case 'exercise': {
        const ex = ['exercise-plank', 'exercise-situps'];
        character.playAnimation(ex[Math.floor(Math.random()*ex.length)], true);
        setTimeout(() => behavior.forceState('idle'), 6000);
        break;
      }
      case 'toggle-sleep':
        behavior.forceState(behavior.state === 'sleeping' ? 'idle' : 'sleeping');
        break;
      
      // Ajustes de voz
      case 'voice-rate--2': behavior.setVoiceSettings({ rate: -2 }); ui.showStatus('Voz: Lenta 🐢'); break;
      case 'voice-rate-0':  behavior.setVoiceSettings({ rate: 0 });  ui.showStatus('Voz: Normal 🚶'); break;
      case 'voice-rate-3':  behavior.setVoiceSettings({ rate: 3 });  ui.showStatus('Voz: Rápida ⚡'); break;
      
      case 'voice-pitch-low':    behavior.setVoiceSettings({ pitch: 'low' });    ui.showStatus('Tom: Grave 📉'); break;
      case 'voice-pitch-medium': behavior.setVoiceSettings({ pitch: 'medium' }); ui.showStatus('Tom: Normal ↔️'); break;
      case 'voice-pitch-high':   behavior.setVoiceSettings({ pitch: 'high' });   ui.showStatus('Tom: Agudo 📈'); break;
      
      case 'view-settings': ui.switchMenu('settings'); break;
      case 'view-main':     ui.switchMenu('main'); break;
    }
  };

  ui.onCharacterChange = (newModel) => {
    loadCharacter(newModel);
    behavior.interact(); // Reage à troca
  };

  // Carga inicial
  const loaded = await loadCharacter(currentModelFile);
  if (!loaded) {
    // initPlaceholder() já foi chamado dentro de loadCharacter() no caminho de erro.
    console.warn('[Renderer] Modelo não carregado — usando placeholder gerado no loadCharacter().');
  }

  // 5. Input
  const inputManager = new InputManager(
    sceneManager.renderer, sceneManager.camera, character, behavior, sceneManager.scene,
    (x, y) => ui.showContextMenu(x, y)
  );
  ui.bindInputExclusions(inputManager);

  sceneManager.onRender((delta) => {
    character.update(delta);
    inputManager.update(delta);
    heartEmitter.update(delta);
  });
  sceneManager.startLoop();

  if (window.petskodAPI) {
    window.petskodAPI.onForceState(s => behavior.forceState(s));
    window.petskodAPI.onContextMenuAction(a => ui.onAction(a));
  }

  window.addEventListener('beforeunload', () => {
    behavior.destroy();
    ambientManager.destroy();
    sceneManager.dispose();
    character.dispose();
    ui.dispose();
  });
}

init().catch(console.error);
