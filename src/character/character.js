// character/character.js — Refatorado (drag-safe)
// Gerencia o personagem 3D com suporte a estados visuais por comportamento

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

// Cores do placeholder por estado
const STATE_COLORS = {
  [CharacterState.IDLE]:     new THREE.Color(0x7c6fff),
  [CharacterState.HAPPY]:    new THREE.Color(0xffcf47),
  [CharacterState.BORED]:    new THREE.Color(0x5a8aaa),
  [CharacterState.SLEEPING]: new THREE.Color(0x2a3f7f),
  [CharacterState.REACTING]: new THREE.Color(0xff7b47),
  [CharacterState.DRAGGING]: new THREE.Color(0xadd8e6),
};

// ── Utilitário: snapshot/restore de transform ────────────────────────────────
function captureTransform(obj) {
  return {
    position: obj.position.clone(),
    quaternion: obj.quaternion.clone(),
    scale: obj.scale.clone(),
  };
}
function restoreTransform(obj, snap) {
  obj.position.copy(snap.position);
  obj.quaternion.copy(snap.quaternion);
  obj.scale.copy(snap.scale);
}

export class Character {
  constructor(scene) {
    this.scene = scene;
    this.model = null;
    this.mixer = null;
    this.animations = {};
    this.currentAction = null;
    this.state = CharacterState.IDLE;
    this.face = null;
    this.outline = null;

    this._placeholder = null;
    this._placeholderMat = null;
    this._placeholderAngle = 0;
    this._targetColor = STATE_COLORS[CharacterState.IDLE].clone();
    this._currentColor = STATE_COLORS[CharacterState.IDLE].clone();

    this.voiceProfile = { rate: 0, pitch: 'medium' };

    this._landingTimer = 0;
    this._baseScale = 1.0;

    // Snapshot de transform capturado no início do drag
    this._dragSnapshot = null;

    // Partículas de reação
    this._particles = null;
    this._particleTimer = 0;
    this._active = true;
    this._reactionTimeout = null;
    this._initialPosition = new THREE.Vector3();
    this._modelVersion = 0;

    // Diagnóstico de escala (log a cada N frames, apenas em dev)
    this._diagFrameCount = 0;
  }

  _cleanup() {
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }
    if (this.face) {
      try { this.face.dispose(); } catch {}
      this.face = null;
    }
    if (this.outline) {
      try { this.outline.dispose(); } catch {}
      this.outline = null;
    }
    if (this.model) {
      try { this.scene.remove(this.model); } catch {}
      this._disposeObject(this.model);
      this.model = null;
    }
    this._landingTimer = 0;
    this._baseScale = 1.0;
    this._dragSnapshot = null;
    this.currentAction = null;
  }

  // ── Inicialização ──────────────────────────────────────────────────────────

  init(modelScene, clips) {
    this._cleanup();
    this._modelVersion++;

    if (this._placeholder) {
      this.scene.remove(this._placeholder);
      this._placeholder = null;
    }

    this.model = modelScene;

    // Normaliza escala pelo bounding box
    const box = new THREE.Box3().setFromObject(this.model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;

    const scale = 1.8 / maxDim;
    this.model.scale.setScalar(scale);
    this._baseScale = scale;

    const groundOffset = 0.02;
    this.model.position.set(
      -center.x * scale,
      (-box.min.y * scale) + groundOffset,
      -center.z * scale
    );

    this.model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
      }
    });

    this._initialPosition.copy(this.model.position);
    this.scene.add(this.model);

    this.face = new FaceController(this.model);
    this.outline = new OutlineEffect(this.model);

    // ── Filtro de animações ────────────────────────────────────────────────
    this.mixer = new THREE.AnimationMixer(this.model);
    this.animations = {};

    clips.forEach(clip => {
      const clipName = clip.name.toLowerCase();

      // Remove TODOS os tracks de escala (de qualquer osso) e posição do root
      // Usa toLowerCase() para comparação consistente
      clip.tracks = clip.tracks.filter(track => {
        const name = track.name.toLowerCase();

        // Remove qualquer track de escala — eles causam crescimento durante animação
        if (name.endsWith('.scale') ||
            name.includes('.scale[') ||
            name.match(/\.scale\.(x|y|z)$/)) {
          return false;
        }

        // Remove posição do root bone para evitar drift vertical
        const boneName = name.split('.')[0];
        const isRootBone = boneName.includes('hips') ||
                           boneName.includes('root') ||
                           boneName.includes('pelvis') ||
                           boneName === '' ||
                           boneName.includes('armature');
        if (isRootBone && name.includes('.position')) {
          return false;
        }

        return true;
      });

      this.animations[clipName] = clip;

      // Alias para o clip padrão do Mixamo
      if ((clipName === 'mixamo.com' || clipName.includes('take 001')) && !this.animations['idle']) {
        this.animations['idle'] = clip;
      }
    });

    // Detectar perfil de voz
    const modelName = this.model.name?.toLowerCase() ?? '';
    if (modelName.includes('granny')) {
      this.voiceProfile = { rate: -1, pitch: 'low' };
    } else if (modelName.includes('michelle')) {
      this.voiceProfile = { rate: 2, pitch: 'high' };
    } else {
      this.voiceProfile = { rate: 0, pitch: 'medium' };
    }

    if (this._reactionTimeout) clearTimeout(this._reactionTimeout);
    const availableAnims = Object.keys(this.animations);
    console.log('[Character] Animações carregadas:', availableAnims.join(', '));

    if (this.animations['idle']) {
      this.playAnimation('idle', true);
    } else if (availableAnims.length > 0) {
      console.log(`[Character] "idle" não encontrado, usando "${availableAnims[0]}"`);
      this.playAnimation(availableAnims[0], true);
    }
  }

  initPlaceholder() {
    this._cleanup();

    const geo = new THREE.BoxGeometry(0.55, 0.75, 0.55, 4, 4, 4);

    this._placeholderMat = new THREE.MeshStandardMaterial({
      color: STATE_COLORS[CharacterState.IDLE],
      roughness: 0.35,
      metalness: 0.25,
      emissive: STATE_COLORS[CharacterState.IDLE],
      emissiveIntensity: 0.1,
    });

    this._placeholder = new THREE.Mesh(geo, this._placeholderMat);
    this._placeholder.castShadow = true;
    this._placeholder.receiveShadow = true;
    this._placeholder.position.set(0, 0.4, 0);
    this.scene.add(this._placeholder);

    // Cabeça
    const headGeo = new THREE.SphereGeometry(0.32, 12, 12);
    const head = new THREE.Mesh(headGeo, this._placeholderMat);
    head.castShadow = true;
    head.position.set(0, 0.5, 0);
    this._placeholder.add(head);

    // Olhos
    const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.name = 'LeftEye';
    leftEye.position.set(-0.12, 0.05, 0.28);
    head.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.name = 'RightEye';
    rightEye.position.set(0.12, 0.05, 0.28);
    head.add(rightEye);

    this.face = new FaceController(this._placeholder);
    this.outline = new OutlineEffect(this._placeholder);

    this._addCheeks(head);
    this._addEars(head);
    this._initParticles();
  }

  _addCheeks(parent) {
    const cheekGeo = new THREE.SphereGeometry(0.075, 8, 8);
    const cheekMat = new THREE.MeshBasicMaterial({ color: 0xff9999, transparent: true, opacity: 0.5 });
    [-0.2, 0.2].forEach(x => {
      const cheek = new THREE.Mesh(cheekGeo, cheekMat);
      cheek.position.set(x, -0.02, 0.3);
      cheek.scale.set(1, 0.6, 0.4);
      parent.add(cheek);
    });
  }

  _addEars(parent) {
    const earGeo = new THREE.ConeGeometry(0.1, 0.18, 6);
    [-0.28, 0.28].forEach((x, i) => {
      const ear = new THREE.Mesh(earGeo, this._placeholderMat);
      ear.position.set(x, 0.38, 0);
      ear.rotation.z = i === 0 ? -0.3 : 0.3;
      parent.add(ear);
    });
  }

  _initParticles() {
    const count = 8;
    const pGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.06,
      transparent: true,
      opacity: 0,
      sizeAttenuation: true,
    });
    this._particles = new THREE.Points(pGeo, pMat);
    this._particles.position.set(0, 0.9, 0);
    this.scene.add(this._particles);
  }

  // ── Estado visual ──────────────────────────────────────────────────────────

  applyBehaviorState(behaviorState) {
    this.state = behaviorState;
    const target = STATE_COLORS[behaviorState] ?? STATE_COLORS[CharacterState.IDLE];
    this._targetColor.copy(target);

    if (behaviorState === CharacterState.HAPPY) {
      this._burstParticles();
    }

    // DRAGGING: congela o mixer imediatamente, sem disparar nenhuma animação.
    // Qualquer animação em andamento fica pausada e será retomada ao soltar.
    if (behaviorState === CharacterState.DRAGGING) {
      if (this.mixer) this.mixer.timeScale = 0;
      if (this.currentAction) this.currentAction.paused = true;
      return;
    }

    // Saindo do DRAGGING: retoma mixer
    if (this.mixer) {
      this.mixer.timeScale = 1;
      if (this.currentAction) this.currentAction.paused = false;
    }

    // Mapeia estado → animação
    if (this.mixer) {
      const animMap = {
        [CharacterState.IDLE]:     'idle',
        [CharacterState.HAPPY]:    'happy',
        [CharacterState.BORED]:    'bored',
        [CharacterState.SLEEPING]: 'sleeping',
        [CharacterState.REACTING]: 'reaction',
      };

      let animName = animMap[behaviorState];
      if (animName && !this.animations[animName.toLowerCase()]) {
        animName = this.animations['idle'] ? 'idle' : Object.keys(this.animations)[0];
      }
      if (animName && this.animations[animName?.toLowerCase()]) {
        const loop = behaviorState === CharacterState.IDLE ||
                     behaviorState === CharacterState.SLEEPING;
        this.playAnimation(animName, loop);
      }
    }
  }

  /** Efeito de pouso (Squash & Stretch) */
  land() {
    this._landingTimer = 0.4;
    this._burstParticles();
    console.log('[Character] Pouso detectado 🛬');
  }

  _burstParticles() {
    if (!this._particles) return;
    this._particleTimer = 1.5;
    const positions = this._particles.geometry.attributes.position;
    const count = positions.count;
    for (let i = 0; i < count; i++) positions.setXYZ(i, 0, 0, 0);
    positions.needsUpdate = true;
    this._particles.material.opacity = 1;
    this._particles._velocities = Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 1.5,
      y: Math.random() * 1.5 + 0.5,
      z: (Math.random() - 0.5) * 1.5,
    }));
  }

  // ── Animações ──────────────────────────────────────────────────────────────

  playAnimation(name, loop = false) {
    if (!this.mixer) return;
    const clip = this.animations[name.toLowerCase()];
    if (!clip) return;

    this._stopSequence();

    const action = this.mixer.clipAction(clip);
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loop;

    if (this.currentAction && this.currentAction !== action) {
      this.currentAction.fadeOut(0.3);
      action.reset().fadeIn(0.3).play();
    } else {
      action.reset().play();
    }
    this.currentAction = action;
    return action;
  }

  playSequence(names, loop = false) {
    if (!names.length) return;
    const [first, ...rest] = names;
    const action = this.playAnimation(first, false);
    if (!action) return;

    const onFinished = (e) => {
      if (e.action === action) {
        this.mixer.removeEventListener('finished', onFinished);
        if (rest.length) {
          this.playSequence(rest, loop);
        } else if (loop) {
          this.playSequence(names, loop);
        }
      }
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

  // ── Drag ───────────────────────────────────────────────────────────────────

  /** Chamado pelo InputManager quando o drag COMEÇA. */
  startDragLock() {
    if (!this.model) return;
    this._dragSnapshot = captureTransform(this.model);
    if (this.outline) this.outline.hide();
    console.log(`[Character] Drag lock — escala base: ${this._baseScale.toFixed(4)}`);
  }

  /** Chamado pelo InputManager quando o drag TERMINA. */
  endDragLock() {
    if (!this.model) return;
    if (this._dragSnapshot) {
      // Restaura exatamente a posição e escala capturadas antes do drag
      restoreTransform(this.model, this._dragSnapshot);
    }
    this._dragSnapshot = null;
    console.log('[Character] Drag lock liberado');
  }

  // ── Hover ──────────────────────────────────────────────────────────────────

  onHoverEnter() {
    if (this.state === CharacterState.DRAGGING) return; // ignora hover durante drag
    if (this.outline) this.outline.show();
  }

  onHoverExit() {
    if (this.outline) this.outline.hide();
  }

  react() {
    if (this._placeholder) {
      this._reactionBounce();
    } else if (this.model) {
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
    let elapsed = 0;
    const dur = 0.5;
    const bounce = (dt) => {
      elapsed += dt;
      const t = Math.min(elapsed / dur, 1);
      const off = Math.sin(t * Math.PI) * 0.25;
      this._placeholder.position.y = startY + off;
      this._placeholder.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.12);
      if (t < 1) requestAnimationFrame(() => bounce(0.016));
      else this._placeholder.scale.setScalar(1);
    };
    bounce(0);
  }

  // ── Colisão / Raycasting ───────────────────────────────────────────────────

  getCollidableObjects() {
    const result = [];
    if (this._placeholder) result.push(this._placeholder);
    if (this.model) {
      this.model.traverse(child => {
        if (child.isMesh && !child.userData.isOutline && child.name !== 'OutlineMarker') {
          result.push(child);
        }
      });
    }
    return result;
  }

  // ── Loop de update ─────────────────────────────────────────────────────────

  update(delta) {
    if (!this._active) return;

    // ── Diagnóstico de escala (dev) ─────────────────────────────────────────
    this._diagFrameCount++;
    if (this._diagFrameCount % 120 === 0 && this.model) {
      const s = this.model.scale.x;
      if (Math.abs(s - this._baseScale) > 0.001) {
        console.warn(`[Character] ESCALA DESVIOU: ${s.toFixed(5)} (base=${this._baseScale.toFixed(5)})`);
      }
    }

    // ── Caminho do Placeholder ─────────────────────────────────────────────
    if (this._placeholder) {
      if (this.face) this.face.update(delta);
      if (this.outline) this.outline.update(delta);

      this._updatePlaceholderAnimation(delta);
      this._updatePlaceholderColor(delta);

      if (this._landingTimer > 0) {
        this._landingTimer -= delta;
        const progress = 1 - (this._landingTimer / 0.4);
        const bounce = Math.sin(progress * Math.PI) * 0.25 * (1 - progress);
        this._placeholder.scale.y = 1 - bounce;
        this._placeholder.scale.x = 1 + bounce * 0.5;
        this._placeholder.scale.z = 1 + bounce * 0.5;
      } else {
        this._placeholder.scale.setScalar(1);
      }

      if (this._particles) this._updateParticles(delta);
      return;
    }

    // ── Caminho do Modelo GLB/FBX ──────────────────────────────────────────
    if (!this.model) return;

    // ── DRAGGING: restore snapshot toda frame ──────────────────────────────
    // Mixer NÃO é atualizado durante drag para eliminar qualquer track de escala.
    // A transform é restaurada a partir do snapshot capturado em startDragLock().
    if (this.state === CharacterState.DRAGGING) {
      if (this._dragSnapshot) {
        restoreTransform(this.model, this._dragSnapshot);
      } else {
        // Fallback: força escala base caso startDragLock() não tenha sido chamado
        this.model.scale.setScalar(this._baseScale);
      }
      return; // mixer.update() NÃO roda aqui
    }

    // ── Estado normal ──────────────────────────────────────────────────────
    if (this.mixer) this.mixer.update(delta);
    if (this.face) this.face.update(delta);
    if (this.outline) this.outline.update(delta);

    const floatOffset = Math.sin(Date.now() * 0.003) * 0.05;
    this.model.position.y = this._initialPosition.y + floatOffset;
    this.model.position.x = this._initialPosition.x;
    this.model.position.z = this._initialPosition.z;

    // Garante que a escala nunca deriva mesmo fora do drag
    if (Math.abs(this.model.scale.x - this._baseScale) > 0.002) {
      this.model.scale.setScalar(this._baseScale);
    }

    if (this._particles) this._updateParticles(delta);
  }

  // ── Métodos auxiliares ─────────────────────────────────────────────────────

  _updateParticles(delta) {
    if (!this._particles) return;
    if (this._particleTimer <= 0) {
      this._particles.material.opacity = 0;
      return;
    }
    this._particleTimer -= delta;
    const positions = this._particles.geometry.attributes.position;
    const count = positions.count;
    const velocities = this._particles._velocities;
    if (!velocities) return;
    for (let i = 0; i < count; i++) {
      const v = velocities[i];
      positions.setXYZ(i,
        positions.getX(i) + v.x * delta,
        positions.getY(i) + v.y * delta,
        positions.getZ(i) + v.z * delta
      );
      v.y -= 2.0 * delta;
    }
    positions.needsUpdate = true;
    this._particles.material.opacity = Math.max(0, this._particleTimer / 1.5);
  }

  _disposeObject(obj) {
    if (!obj) return;
    obj.traverse(node => {
      if (node.isMesh) {
        node.geometry?.dispose();
        if (Array.isArray(node.material)) {
          node.material.forEach(m => this._disposeMaterial(m));
        } else {
          this._disposeMaterial(node.material);
        }
      }
    });
  }

  _disposeMaterial(mat) {
    if (!mat) return;
    Object.keys(mat).forEach(key => {
      if (mat[key]?.isTexture) mat[key].dispose();
    });
    mat.dispose();
  }

  _updatePlaceholderAnimation(delta) {
    this._placeholderAngle += delta;
    switch (this.state) {
      case CharacterState.SLEEPING: {
        const breathe = Math.sin(this._placeholderAngle * 0.8) * 0.03;
        this._placeholder.position.y = 0.4 + breathe;
        this._placeholder.rotation.z = Math.sin(this._placeholderAngle * 0.4) * 0.08;
        break;
      }
      case CharacterState.BORED: {
        this._placeholder.position.y = 0.4 + Math.sin(this._placeholderAngle * 0.8) * 0.03;
        this._placeholder.rotation.z = Math.sin(this._placeholderAngle * 0.5) * 0.12;
        break;
      }
      case CharacterState.HAPPY: {
        const jump = Math.abs(Math.sin(this._placeholderAngle * 4)) * 0.15;
        this._placeholder.position.y = 0.4 + jump;
        this._placeholder.rotation.y = Math.sin(this._placeholderAngle * 3) * 0.3;
        break;
      }
      default: {
        this._placeholder.position.y = 0.4 + Math.sin(this._placeholderAngle * 1.5) * 0.045;
        this._placeholder.rotation.y = Math.sin(this._placeholderAngle * 0.5) * 0.12;
      }
    }
  }

  _updatePlaceholderColor(delta) {
    if (!this._placeholderMat) return;
    this._currentColor.lerp(this._targetColor, 0.05);
    this._placeholderMat.color.copy(this._currentColor);
    this._placeholderMat.emissive.copy(this._currentColor);
    this._placeholderMat.emissiveIntensity = 0.1 +
      Math.abs(Math.sin(Date.now() * 0.002)) * 0.05;
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
