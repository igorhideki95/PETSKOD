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
      alpha: true,
      powerPreference: 'low-power',
    });

    this.renderer.setSize(this.width, this.height);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setClearColor(0x000000, 0);
    
    this.renderer.shadowMap.enabled = true; 
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);
  }

  _initScene() {
    this.scene = new THREE.Scene();

    // Sombra projetada no chão invisível
    const planeGeo = new THREE.PlaneGeometry(10, 10);
    const planeMat = new THREE.ShadowMaterial({ opacity: 0.25 });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0.01; // Quase no chão absoluto
    plane.receiveShadow = true;
    this.scene.add(plane);
  }

  _initCamera() {
    const aspect = this.width / this.height;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    this.camera.position.set(0, 1.2, 3.5);
    this.camera.lookAt(0, 0.9, 0); // Foco no peito/centro do personagem (1.8 total)
  }

  _initLights() {
    // Luz ambiente suave
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambient);

    // Luz direcional principal
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(2, 4, 3);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 512;
    dirLight.shadow.mapSize.height = 512;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 10;
    dirLight.shadow.camera.left = -2;
    dirLight.shadow.camera.right = 2;
    dirLight.shadow.camera.top = 2;
    dirLight.shadow.camera.bottom = -2;
    dirLight.shadow.bias = -0.001;
    this.scene.add(dirLight);

    // Luz de preenchimento colorida (tom azulado)
    const fillLight = new THREE.DirectionalLight(0x8899ff, 0.3);
    fillLight.position.set(-2, 1, -2);
    this.scene.add(fillLight);

    // Expor para AmbientManager
    this.lights = { ambient, dirLight, fillLight };
  }

  /** Registra callback chamado a cada frame renderizado */
  onRender(fn) {
    this._onRenderCallbacks.push(fn);
  }

  /** Inicia o loop de renderização com limitador de FPS */
  startLoop() {
    const loop = (timestamp) => {
      this._animationId = requestAnimationFrame(loop);

      const rawDelta = timestamp - this._lastFrameTime;
      if (rawDelta < FRAME_TIME) return; // limita a 30 FPS

      // Clampeia o delta: se a janela ficou em background e voltou,
      // rawDelta pode ser de segundos — causaria saltos nas animações.
      const cappedDelta = Math.min(rawDelta, 100); // máximo 100ms por frame
      this._lastFrameTime = timestamp;

      for (const cb of this._onRenderCallbacks) {
        cb(cappedDelta / 1000); // passa delta em segundos
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

  dispose() {
    this.stopLoop();
    
    this.renderer.dispose();
    this.scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(mat => this._disposeMaterial(mat));
        } else {
          this._disposeMaterial(object.material);
        }
      }
    });

    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }

  _disposeMaterial(mat) {
    if (!mat) return;
    mat.dispose();
    
    // Libera texturas comumente usadas
    const textures = ['map', 'lightMap', 'bumpMap', 'normalMap', 'specularMap', 'envMap', 'metalnessMap', 'roughnessMap'];
    textures.forEach(texName => {
      if (mat[texName] && mat[texName].dispose) {
        mat[texName].dispose();
      }
    });
  }
}
