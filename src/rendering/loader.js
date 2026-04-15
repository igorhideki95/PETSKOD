// rendering/loader.js
// Carrega modelos GLB/GLTF ou FBX com suporte a animações

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader }  from 'three/addons/loaders/FBXLoader.js';

/**
 * Clona um AnimationClip de forma profunda, preservando o tipo correto de cada track.
 * Garante que clips compartilhados pelo loader não sejam mutados pelo filtro de tracks.
 */
function cloneAnimationClip(clip) {
  const clonedTracks = clip.tracks.map(track => {
    const TrackType = track.constructor;
    return new TrackType(
      track.name,
      track.times.slice(),
      track.values.slice(),
      track.interpolation
    );
  });
  return new THREE.AnimationClip(clip.name, clip.duration, clonedTracks);
}

export class ModelLoader {
  constructor() {
    this._gltfLoader = new GLTFLoader();
    this._fbxLoader  = new FBXLoader();
  }

  async load(url) {
    const isFBX = url.toLowerCase().endsWith('.fbx');
    const loader = isFBX ? this._fbxLoader : this._gltfLoader;

    return new Promise((resolve, reject) => {
      loader.load(
        url,
        (result) => {
          let animations = [];

          if (result.animations?.length) {
            animations = result.animations.map(clip => cloneAnimationClip(clip));
          }

          if (isFBX) {
            resolve({ scene: result, animations });
          } else {
            resolve({ scene: result.scene, animations });
          }
        },
        undefined,
        reject
      );
    });
  }

  /**
   * Carrega múltiplos arquivos de animação extra (FBX do Mixamo).
   * Cada arquivo recebe o nome do arquivo como nome do clip.
   */
  async loadAnimations(urls) {
    const clips = [];

    for (const url of urls) {
      try {
        const result   = await this.load(url);
        const filename = url.split('/').pop().replace(/\.[^.]+$/, ''); // sem extensão

        for (const clip of result.animations) {
          const named   = cloneAnimationClip(clip);
          named.name    = filename.toLowerCase();
          clips.push(named);
        }
      } catch (e) {
        console.warn(`[ModelLoader] Falha ao carregar animação (${url}):`, e);
      }
    }

    return clips;
  }
}
