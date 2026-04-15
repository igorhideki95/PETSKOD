// character/character.js — v3 (drag-proof)
// Sistema de snapshot completo: para o mixer por inteiro durante drag.

import * as THREE from 'three';
import { FaceController } from './face.js';
import { OutlineEffect } from '../effects/outline.js';

export const CharacterState = {
  IDLE: 'idle',
  HAPPY: 'happy',
  BORED: 'bored',
  SLEEPING: 'sleeping',
  REACTING: 'reacting',
  IDLE_VARIATION: 'idle_variation',
  DRAGGING: 'mousedragging',
};

const STATE_COLORS = {
  [CharacterState.IDLE]:     new THREE.Color(0x7c6fff),
  [CharacterState.HAPPY]:    new THREE.Color(0xffcf47),
  [CharacterState.BORED]:    new THREE.Color(0x5a8aaa),
  [CharacterState.SLEEPING]: new THREE.Color(0x2a3f7f),
  [CharacterState.REACTING]: new THREE.Color(0xff7b47),
  [CharacterState.DRAGGING]: new THREE.Color(0xadd8e6),
};

// ─────────────────────────────────────────────────────────────────────────────
// Filtro de tracks de animação (cobre todos os formatos Mixamo FBX/GLB)
// ─────────────────────────────────────────────────────────────────────────────

const SCALE_PATTERN = /\.(scale|s)$/i;
const ROOT_BONE_PATTERN = /^(hips|root|pelvis|armature|mixamorigarmaure)/i;

function stripDangerousTracks(clip) {
  const before = clip.tracks.length;
  clip.tracks = clip.tracks.filter(track => {
    const name = track.name;
    // Remove qualquer track de escala (todos os formatos)
    if (SCALE_PATTERN.test(name)) return false;

    // Extraímos o nome do osso (parte antes do primeiro '.' ou '[')
    const boneName = name.split(/[.\[]/)[0];

    // Remove track de posição do root bone (causa drift/scale vertical)
    if (ROOT_BONE_PATTERN.test(boneName) && /\.(position|p)$/i.test(name)) {
      return false;
    }

    return true;
  });

  const removed = before - clip.tracks.length;
  if (removed > 0) {
    console.log(`[Anim] "${clip.name}": ${removed} track(s) perigoso(s) removido(s)`);
  }
  return clip;
}

// ─────────────────────────────────────────────────────────────────────────────
// Character
// ─────────────────────────────────────────────────────────────────────────────

export class Character {
  constructor(scene) {
    this.scene        = scene;
    this.model        = null;
    this.mixer        = null;
    this.animations   = {};
    this.currentAction= null;
    this.state        = CharacterState.IDLE;
    this.face         = null;
    this.outline      = null;

    this._placeholder    = null;
    this._placeholderMat = null;
    this._placeholderAngle = 0;
    this._targetColor  = STATE_COLORS[CharacterState.IDLE].clone();
    this._currentColor = STATE_COLORS[CharacterState.IDLE].clone();

    this.voiceProfile  = { rate: 0, pitch: 'medium' };

    this._landingTimer    = 0;
    this._baseScale       = 1.0;
    this._isDragLocked    = false;     // flag interna de drag

    this._particles    = null;
    this._particleTimer= 0;
    this._active       = true;
    this._reactionTimeout = null;
    this._initialPosition = new THREE.Vector3();
    this._sequenceListener= null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Inicialização
  // ───────────────────────────────────────────────────────────────────────────

  _cleanup() {
    this._isDragLocked = false;

    if (this.mixer) {
      this.mixer.stopAllAction();
      if (this.model) this.mixer.uncacheRoot(this.model);
      this.mixer = null;
    }
    if (this.face)    { try { this.face.dispose(); }    catch {} this.face    = null; }
    if (this.outline) { try { this.outline.dispose(); } catch {} this.outline = null; }
    if (this.model) {
      this.model.matrixAutoUpdate = true; // garante que nunca fica preso
      try { this.scene.remove(this.model); } catch {}
      this._disposeObject(this.model);
      this.model = null;
    }

    this._landingTimer  = 0;
    this._baseScale     = 1.0;
    this.currentAction  = null;
    this._stopSequence();
  }

  init(modelScene, clips) {
    this._cleanup();

    if (this._placeholder) {
      this.scene.remove(this._placeholder);
      this._placeholder = null;
    }

    this.model = modelScene;
    this.model.matrixAutoUpdate = true;

    // ── Normalização de escala ──
    // Calcula bounding box ANTES de aplicar nossa escala (em default scale do loader).
    // Depois usa esses valores multiplicados pelo fator de escala para posicionar.
    const box = new THREE.Box3().setFromObject(this.model);
    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;

    const scale = 1.8 / maxDim;
    this._baseScale = scale;
    this.model.scale.setScalar(scale);

    // Posiciona centralizando X/Z e pousando Y no chão
    this.model.position.set(
      -center.x * scale,
      (-box.min.y * scale) + 0.02,
      -center.z * scale
    );
    this._initialPosition.copy(this.model.position);
    this.scene.add(this.model);

    this.model.traverse(child => {
      if (child.isMesh) {
        child.castShadow    = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
      }
    });

    console.log(`[Character] Model init — baseScale=${this._baseScale.toFixed(5)}, pos=${JSON.stringify(this.model.position)}`);

    this.face    = new FaceController(this.model);
    this.outline = new OutlineEffect(this.model);

    // ── Registro de animações com filtro agressivo ──
    this.mixer      = new THREE.AnimationMixer(this.model);
    this.animations = {};

    for (const clip of clips) {
      const filtered  = stripDangerousTracks(clip);
      const clipName  = filtered.name.toLowerCase();
      this.animations[clipName] = filtered;

      // Alias idle para clips do Mixamo
      if (!this.animations['idle'] &&
          (clipName === 'mixamo.com' || clipName.includes('take 001') || clipName.includes('armature'))) {
        this.animations['idle'] = filtered;
      }
    }

    const available = Object.keys(this.animations);
    console.log('[Character] Animações disponíveis:', available.join(', '));

    const startAnim = this.animations['idle'] ? 'idle' : available[0];
    if (startAnim) this.playAnimation(startAnim, true);
  }

  initPlaceholder() {
    this._cleanup();

    const geo = new THREE.BoxGeometry(0.55, 0.75, 0.55, 4, 4, 4);
    this._placeholderMat = new THREE.MeshStandardMaterial({
      color:            STATE_COLORS[CharacterState.IDLE],
      roughness:        0.35,
      metalness:        0.25,
      emissive:         STATE_COLORS[CharacterState.IDLE],
      emissiveIntensity:0.1,
    });

    this._placeholder = new THREE.Mesh(geo, this._placeholderMat);
    this._placeholder.castShadow    = true;
    this._placeholder.receiveShadow = true;
    this._placeholder.position.set(0, 0.4, 0);
    this.scene.add(this._placeholder);

    const headGeo  = new THREE.SphereGeometry(0.32, 12, 12);
    const head     = new THREE.Mesh(headGeo, this._placeholderMat);
    head.castShadow = true;
    head.position.set(0, 0.5, 0);
    this._placeholder.add(head);

    const eyeGeo  = new THREE.SphereGeometry(0.06, 8, 8);
    const eyeMat  = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.name  = 'LeftEye';
    leftEye.position.set(-0.12, 0.05, 0.28);
    head.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.name  = 'RightEye';
    rightEye.position.set(0.12, 0.05, 0.28);
    head.add(rightEye);

    this.face    = new FaceController(this._placeholder);
    this.outline = new OutlineEffect(this._placeholder);
    this._addCheeks(head);
    this._addEars(head);
    this._initParticles();
  }

  _addCheeks(parent) {
    const geo = new THREE.SphereGeometry(0.075, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff9999, transparent: true, opacity: 0.5 });
    [-0.2, 0.2].forEach(x => {
      const cheek = new THREE.Mesh(geo, mat);
      cheek.position.set(x, -0.02, 0.3);
      cheek.scale.set(1, 0.6, 0.4);
      parent.add(cheek);
    });
  }

  _addEars(parent) {
    const geo = new THREE.ConeGeometry(0.1, 0.18, 6);
    [-0.28, 0.28].forEach((x, i) => {
      const ear = new THREE.Mesh(geo, this._placeholderMat);
      ear.position.set(x, 0.38, 0);
      ear.rotation.z = i === 0 ? -0.3 : 0.3;
      parent.add(ear);
    });
  }

  _initParticles() {
    const count = 8;
    const geo   = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0, sizeAttenuation: true });
    this._particles = new THREE.Points(geo, mat);
    this._particles.position.set(0, 0.9, 0);
    this.scene.add(this._particles);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Estado visual
  // ───────────────────────────────────────────────────────────────────────────

  applyBehaviorState(behaviorState) {
    this.state = behaviorState;
    const target = STATE_COLORS[behaviorState] ?? STATE_COLORS[CharacterState.IDLE];
    this._targetColor.copy(target);

    if (behaviorState === CharacterState.HAPPY) this._burstParticles();

    // DRAGGING: não dispara animação, mixer congelado via _isDragLocked
    if (behaviorState === CharacterState.DRAGGING) return;

    // Retomada após drag pelo BehaviorSystem
    if (this.mixer) {
      this.mixer.timeScale = 1;
      if (this.currentAction) this.currentAction.paused = false;
    }

    if (!this.mixer) return;

    const animMap = {
      [CharacterState.IDLE]:     'idle',
      [CharacterState.HAPPY]:    'happy',
      [CharacterState.BORED]:    'bored',
      [CharacterState.SLEEPING]: 'sleeping',
      [CharacterState.REACTING]: 'reaction',
    };

    let animName = animMap[behaviorState];
    if (animName && !this.animations[animName]) {
      animName = this.animations['idle'] ? 'idle' : Object.keys(this.animations)[0];
    }
    if (animName && this.animations[animName]) {
      const loop = behaviorState === CharacterState.IDLE || behaviorState === CharacterState.SLEEPING;
      this.playAnimation(animName, loop);
    }
  }

  land() {
    this._landingTimer = 0.4;
    this._burstParticles();
  }

  _burstParticles() {
    if (!this._particles) return;
    this._particleTimer = 1.5;
    const pos   = this._particles.geometry.attributes.position;
    const count = pos.count;
    for (let i = 0; i < count; i++) pos.setXYZ(i, 0, 0, 0);
    pos.needsUpdate = true;
    this._particles.material.opacity = 1;
    this._particles._velocities = Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 1.5,
      y: Math.random() * 1.5 + 0.5,
      z: (Math.random() - 0.5) * 1.5,
    }));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Animações
  // ───────────────────────────────────────────────────────────────────────────

  playAnimation(name, loop = false) {
    if (!this.mixer || this._isDragLocked) return null;

    const clip = this.animations[name.toLowerCase()];
    if (!clip) return null;

    this._stopSequence();

    const action = this.mixer.clipAction(clip);
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loop;

    if (this.currentAction && this.currentAction !== action) {
      this.currentAction.fadeOut(0.25);
      action.reset().fadeIn(0.25).play();
    } else {
      action.reset().play();
    }

    this.currentAction = action;
    return action;
  }

  playSequence(names, _ignored) {
    if (!Array.isArray(names) || !names.length) return;
    const [first, ...rest] = names;
    const action = this.playAnimation(first, false);
    if (!action) return;

    const onFinished = (e) => {
      if (e.action !== action) return;
      this.mixer.removeEventListener('finished', onFinished);
      if (rest.length) this.playSequence(rest);
      else this.playAnimation('idle', true);
    };
    this._sequenceListener = onFinished;
    this.mixer.addEventListener('finished', onFinished);
  }

  _stopSequence() {
    if (this._sequenceListener && this.mixer) {
      this.mixer.removeEventListener('finished', this._sequenceListener);
      this._sequenceListener = null;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Drag lock — interface para InputManager
  // ───────────────────────────────────────────────────────────────────────────

  startDragLock() {
    if (!this.model || this._isDragLocked) return;
    this._isDragLocked = true;

    // Para o mixer completamente (sem nenhuma action ativa durante drag)
    if (this.mixer) {
      this.mixer.timeScale = 0;
      this.mixer.stopAllAction();
    }

    // Força a escala imediatamente — o update() vai continuar forçando frame a frame
    this.model.scale.setScalar(this._baseScale);

    if (this.outline) this.outline.hide();
    console.log(`[Character] DRAG START — scale=${this._baseScale.toFixed(5)}`);
  }

  endDragLock() {
    if (!this.model || !this._isDragLocked) return;
    this._isDragLocked = false;

    // Garante que a escala está limpa pós-drag
    this.model.scale.setScalar(this._baseScale);
    this.model.matrixAutoUpdate = true;

    // Retoma o mixer
    if (this.mixer) {
      this.mixer.timeScale = 1;
      const startAnim = this.animations['idle'] ? 'idle' : Object.keys(this.animations)[0];
      if (startAnim) this.playAnimation(startAnim, true);
    }

    console.log(`[Character] DRAG END — scale=${this.model.scale.x.toFixed(5)}`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Hover
  // ───────────────────────────────────────────────────────────────────────────

  onHoverEnter() {
    if (this._isDragLocked) return;
    if (this.outline) this.outline.show();
  }

  onHoverExit() {
    if (this.outline) this.outline.hide();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Interação
  // ───────────────────────────────────────────────────────────────────────────

  react() {
    if (this._placeholder) {
      this._reactionBounce();
    } else if (this.model && !this._isDragLocked) {
      this.playAnimation('reaction', false);
      clearTimeout(this._reactionTimeout);
      this._reactionTimeout = setTimeout(() => {
        if (this._active) this.playAnimation('idle', true);
      }, 1500);
    }
  }

  _reactionBounce() {
    if (!this._placeholder) return;
    const startY = this._placeholder.position.y;
    let elapsed  = 0;
    const bounce = (dt) => {
      elapsed += dt;
      const t   = Math.min(elapsed / 0.5, 1);
      this._placeholder.position.y = startY + Math.sin(t * Math.PI) * 0.25;
      this._placeholder.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.12);
      if (t < 1) requestAnimationFrame(() => bounce(0.016));
      else this._placeholder.scale.setScalar(1);
    };
    bounce(0);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Colisão
  // ───────────────────────────────────────────────────────────────────────────

  getCollidableObjects() {
    const result = [];
    if (this._placeholder) result.push(this._placeholder);
    if (this.model) {
      this.model.traverse(child => {
        if (child.isMesh && !child.userData.isOutline && child.name !== 'OutlineMarker')
          result.push(child);
      });
    }
    return result;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Update loop
  // ───────────────────────────────────────────────────────────────────────────

  update(delta) {
    if (!this._active) return;

    // ── Caminho do Placeholder ──────────────────────────────────────────────
    if (this._placeholder) {
      if (this.face)    this.face.update(delta);
      if (this.outline) this.outline.update(delta);
      this._updatePlaceholderAnimation(delta);
      this._updatePlaceholderColor(delta);

      if (this._landingTimer > 0) {
        this._landingTimer -= delta;
        const p      = 1 - (this._landingTimer / 0.4);
        const bounce = Math.sin(p * Math.PI) * 0.25 * (1 - p);
        this._placeholder.scale.y = 1 - bounce;
        this._placeholder.scale.x = 1 + bounce * 0.5;
        this._placeholder.scale.z = 1 + bounce * 0.5;
      } else {
        this._placeholder.scale.setScalar(1);
      }

      if (this._particles) this._updateParticles(delta);
      return;
    }

    // ── Caminho do Modelo GLB/FBX ───────────────────────────────────────────
    if (!this.model) return;

    // DRAG LOCK ATIVO: força a escala correta todo frame — abordagem infalível.
    // O Three.js atualiza matrizes de nós filhos mesmo com matrixAutoUpdate=false no root,
    // então a única garantia real é sobrescrever scale.x/y/z a cada frame.
    if (this._isDragLocked) {
      this.model.scale.setScalar(this._baseScale);
      return;
    }

    // ── Estado normal ───────────────────────────────────────────────────────
    if (this.mixer) this.mixer.update(delta);
    if (this.face)    this.face.update(delta);
    if (this.outline) this.outline.update(delta);

    // Float suave — amplitude e velocidade mínimas para não ser visualmente perturbador
    const floatY = Math.sin(Date.now() * 0.0008) * 0.012;
    this.model.position.set(
      this._initialPosition.x,
      this._initialPosition.y + floatY,
      this._initialPosition.z
    );

    // Guarda-chuva: se alguma track sobreviveu ao filtro e alterou a escala, corrige
    if (Math.abs(this.model.scale.x - this._baseScale) > 0.0001) {
      console.warn(`[Character] Escala corrigida: ${this.model.scale.x.toFixed(6)} → ${this._baseScale.toFixed(6)}`);
      this.model.scale.setScalar(this._baseScale);
    }

    if (this._particles) this._updateParticles(delta);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Auxiliares
  // ───────────────────────────────────────────────────────────────────────────

  _updateParticles(delta) {
    if (!this._particles) return;
    if (this._particleTimer <= 0) { this._particles.material.opacity = 0; return; }
    this._particleTimer -= delta;
    const pos = this._particles.geometry.attributes.position;
    const velocities = this._particles._velocities;
    if (!velocities) return;
    for (let i = 0; i < pos.count; i++) {
      const v = velocities[i];
      pos.setXYZ(i, pos.getX(i) + v.x * delta, pos.getY(i) + v.y * delta, pos.getZ(i) + v.z * delta);
      v.y -= 2.0 * delta;
    }
    pos.needsUpdate = true;
    this._particles.material.opacity = Math.max(0, this._particleTimer / 1.5);
  }

  _disposeObject(obj) {
    if (!obj) return;
    obj.traverse(node => {
      if (!node.isMesh) return;
      node.geometry?.dispose();
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      mats.forEach(m => this._disposeMaterial(m));
    });
  }

  _disposeMaterial(mat) {
    if (!mat) return;
    Object.values(mat).forEach(v => { if (v?.isTexture) v.dispose(); });
    mat.dispose();
  }

  _updatePlaceholderAnimation(delta) {
    this._placeholderAngle += delta;
    const a = this._placeholderAngle;
    switch (this.state) {
      case CharacterState.SLEEPING:
        this._placeholder.position.y  = 0.4 + Math.sin(a * 0.8) * 0.03;
        this._placeholder.rotation.z  = Math.sin(a * 0.4) * 0.08;
        break;
      case CharacterState.BORED:
        this._placeholder.position.y  = 0.4 + Math.sin(a * 0.8) * 0.03;
        this._placeholder.rotation.z  = Math.sin(a * 0.5) * 0.12;
        break;
      case CharacterState.HAPPY:
        this._placeholder.position.y  = 0.4 + Math.abs(Math.sin(a * 4)) * 0.15;
        this._placeholder.rotation.y  = Math.sin(a * 3) * 0.3;
        break;
      default:
        this._placeholder.position.y  = 0.4 + Math.sin(a * 1.5) * 0.045;
        this._placeholder.rotation.y  = Math.sin(a * 0.5) * 0.12;
    }
  }

  _updatePlaceholderColor(delta) {
    if (!this._placeholderMat) return;
    this._currentColor.lerp(this._targetColor, 0.05);
    this._placeholderMat.color.copy(this._currentColor);
    this._placeholderMat.emissive.copy(this._currentColor);
    this._placeholderMat.emissiveIntensity = 0.1 + Math.abs(Math.sin(Date.now() * 0.002)) * 0.05;
  }

  dispose() {
    this._active = false;
    clearTimeout(this._reactionTimeout);
    this._cleanup();
    if (this._particles) {
      this.scene.remove(this._particles);
      this._particles.geometry?.dispose();
      this._particles.material?.dispose();
      this._particles = null;
    }
  }
}
