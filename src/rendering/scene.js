// rendering/scene.js
// Responsável por criar e gerenciar a cena Three.js, câmera e renderer

import * as THREE from 'three';

const TARGET_FPS = 30;
const FRAME_TIME = 1000 / TARGET_FPS;

export class SceneManager {
  constructor(container) {
    this.container = container;
    this.width = container.clientWidth;
    this.height = container.clientHeight;
    this._lastFrameTime = 0;
    this._animationId = null;
    this._onRenderCallbacks = [];

    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initLights();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,         // fundo transparente
      powerPreference: 'low-power', // economiza GPU
    });

    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x000000, 0); // totalmente transparente
    this.renderer.shadowMap.enabled = false; // sem sombras no MVP → mais leve

    this.container.appendChild(this.renderer.domElement);
  }

  _initScene() {
    this.scene = new THREE.Scene();
  }

  _initCamera() {
    const aspect = this.width / this.height;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    this.camera.position.set(0, 1.2, 3.5);
    this.camera.lookAt(0, 0.8, 0);
  }

  _initLights() {
    // Luz ambiente suave
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambient);

    // Luz direcional principal
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(2, 4, 3);
    this.scene.add(dirLight);

    // Luz de preenchimento colorida (tom azulado)
    const fillLight = new THREE.DirectionalLight(0x8899ff, 0.3);
    fillLight.position.set(-2, 1, -2);
    this.scene.add(fillLight);
  }

  /** Registra callback chamado a cada frame renderizado */
  onRender(fn) {
    this._onRenderCallbacks.push(fn);
  }

  /** Inicia o loop de renderização com limitador de FPS */
  startLoop() {
    const loop = (timestamp) => {
      this._animationId = requestAnimationFrame(loop);

      const delta = timestamp - this._lastFrameTime;
      if (delta < FRAME_TIME) return; // limita a 30 FPS

      this._lastFrameTime = timestamp - (delta % FRAME_TIME);

      for (const cb of this._onRenderCallbacks) {
        cb(delta / 1000); // passa delta em segundos
      }

      this.renderer.render(this.scene, this.camera);
    };

    this._animationId = requestAnimationFrame(loop);
  }

  stopLoop() {
    if (this._animationId !== null) {
      cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }
  }
}
