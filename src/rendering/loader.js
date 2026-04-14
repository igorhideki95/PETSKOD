// rendering/loader.js
// Carrega modelos GLB/GLTF ou FBX com suporte a animações

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

function cloneAnimationClip(clip) {
  const clonedTracks = clip.tracks.map(track => {
    const TrackType = track.constructor;
    return new TrackType(
      track.name,
      track.times.slice(),
      track.values.slice()
    );
  });
  return new THREE.AnimationClip(clip.name, clip.duration, clonedTracks);
}

export class ModelLoader {
  constructor() {
    this._gltfLoader = new GLTFLoader();
    this._fbxLoader = new FBXLoader();
  }

  async load(url) {
    const isFBX = url.toLowerCase().endsWith('.fbx');
    const loader = isFBX ? this._fbxLoader : this._gltfLoader;

    return new Promise((resolve, reject) => {
      loader.load(
        url,
        (result) => {
          let animations = [];
          if (result.animations && result.animations.length > 0) {
            animations = result.animations.map(clip => cloneAnimationClip(clip));
          }
          
          if (isFBX) {
            resolve({
              scene: result,
              animations: animations,
            });
          } else {
            resolve({
              scene: result.scene,
              animations: animations,
            });
          }
        },
        undefined,
        (error) => {
          reject(error);
        }
      );
    });
  }

  async loadAnimations(urls) {
    const clips = [];
    
    for (const url of urls) {
      try {
        const result = await this.load(url);
        if (result.animations && result.animations.length > 0) {
          const filename = url.split('/').pop().split('.').shift();
          
          result.animations.forEach(clip => {
            const newClip = cloneAnimationClip(clip);
            newClip.name = filename;
            clips.push(newClip);
          });
        }
      } catch (e) {
        console.warn(`[ModelLoader] Erro ao carregar animação extra (${url}):`, e);
      }
    }
    
    return clips;
  }
}
