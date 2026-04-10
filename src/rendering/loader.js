// rendering/loader.js
// Carrega modelos GLB/GLTF com suporte a animações

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class ModelLoader {
  constructor() {
    this._loader = new GLTFLoader();
  }

  /**
   * Carrega um modelo GLB/GLTF
   * @param {string} url - Caminho para o arquivo .glb ou .gltf
   * @returns {Promise<{scene: THREE.Group, animations: THREE.AnimationClip[]}>}
   */
  load(url) {
    return new Promise((resolve, reject) => {
      this._loader.load(
        url,
        (gltf) => {
          resolve({
            scene: gltf.scene,
            animations: gltf.animations,
          });
        },
        undefined, // onProgress
        (error) => {
          console.error('[ModelLoader] Erro ao carregar modelo:', error);
          reject(error);
        }
      );
    });
  }
}
