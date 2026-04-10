// character/character.js — Phase 2
// Gerencia o personagem 3D com suporte a estados visuais por comportamento

import * as THREE from 'three';

export const CharacterState = {
  IDLE: 'idle',
  HAPPY: 'happy',
  BORED: 'bored',
  SLEEPING: 'sleeping',
  REACTING: 'reacting',
  IDLE_VARIATION: 'idle_variation',
};

// Cores do placeholder por estado
const STATE_COLORS = {
  [CharacterState.IDLE]: new THREE.Color(0x7c6fff),        // roxo
  [CharacterState.HAPPY]: new THREE.Color(0xffcf47),       // amarelo dourado
  [CharacterState.BORED]: new THREE.Color(0x5a8aaa),       // azul acinzentado
  [CharacterState.SLEEPING]: new THREE.Color(0x2a3f7f),    // azul escuro
  [CharacterState.REACTING]: new THREE.Color(0xff7b47),    // laranja vibrante
};

export class Character {
  constructor(scene) {
    this.scene = scene;
    this.model = null;
    this.mixer = null;
    this.animations = {};
    this.currentAction = null;
    this.state = CharacterState.IDLE;

    this._placeholder = null;
    this._placeholderMat = null;
    this._placeholderAngle = 0;
    this._targetColor = STATE_COLORS[CharacterState.IDLE].clone();
    this._currentColor = STATE_COLORS[CharacterState.IDLE].clone();

    // Partículas de reação
    this._particles = null;
    this._particleTimer = 0;
  }

  // ── Inicialização ─────────────────────────────────────────────────────────

  init(modelScene, clips) {
    if (this._placeholder) {
      this.scene.remove(this._placeholder);
      this._placeholder = null;
    }

    this.model = modelScene;

    const box = new THREE.Box3().setFromObject(this.model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 1.8 / maxDim;

    this.model.scale.setScalar(scale);
    this.model.position.sub(center.multiplyScalar(scale));
    this.scene.add(this.model);

    this.mixer = new THREE.AnimationMixer(this.model);
    for (const clip of clips) {
      this.animations[clip.name.toLowerCase()] = clip;
    }

    console.log('[Character] Animações:', Object.keys(this.animations));
    this.playAnimation('idle', true);
  }

  initPlaceholder() {
    const geo = new THREE.BoxGeometry(0.55, 0.75, 0.55, 4, 4, 4);

    this._placeholderMat = new THREE.MeshStandardMaterial({
      color: STATE_COLORS[CharacterState.IDLE],
      roughness: 0.35,
      metalness: 0.25,
      emissive: STATE_COLORS[CharacterState.IDLE],
      emissiveIntensity: 0.1,
    });

    this._placeholder = new THREE.Mesh(geo, this._placeholderMat);
    this._placeholder.position.set(0, 0.4, 0);
    this.scene.add(this._placeholder);

    // Cabeça redonda
    const headGeo = new THREE.SphereGeometry(0.32, 12, 12);
    const head = new THREE.Mesh(headGeo, this._placeholderMat);
    head.position.set(0, 0.5, 0);
    this._placeholder.add(head);

    // Olhos
    this._addEyes(head);
    // Bochechas
    this._addCheeks(head);
    // Orelhinhas
    this._addEars(head);
    // Partículas idle
    this._initParticles();
  }

  _addEyes(parent) {
    const eyeGeo = new THREE.SphereGeometry(0.065, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilGeo = new THREE.SphereGeometry(0.035, 8, 8);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

    const eyes = [[-0.13, 0.1, 0.3], [0.13, 0.1, 0.3]];
    for (const [x, y, z] of eyes) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(x, y, z);
      parent.add(eye);

      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(0.01, 0, 0.05);
      eye.add(pupil);
    }
    this._eyes = parent.children.filter(c => c instanceof THREE.Mesh && c.geometry.type === 'SphereGeometry' && c.material.color?.getHex() === 0xffffff);
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

  // ── Estado visual ─────────────────────────────────────────────────────────

  /** Muda o estado visual do personagem */
  applyBehaviorState(behaviorState) {
    this.state = behaviorState;
    const target = STATE_COLORS[behaviorState] || STATE_COLORS[CharacterState.IDLE];
    this._targetColor.copy(target);

    // Dispara partículas no estado happy
    if (behaviorState === CharacterState.HAPPY) {
      this._burstParticles();
    }

    // Animações do GLB
    if (this.mixer) {
      const animMap = {
        [CharacterState.IDLE]: 'idle',
        [CharacterState.HAPPY]: 'happy',
        [CharacterState.BORED]: 'bored',
        [CharacterState.SLEEPING]: 'sleeping',
        [CharacterState.REACTING]: 'reaction',
      };
      const animName = animMap[behaviorState];
      if (animName) {
        const loop = behaviorState === CharacterState.IDLE || behaviorState === CharacterState.SLEEPING;
        this.playAnimation(animName, loop);
      }
    }
  }

  _burstParticles() {
    if (!this._particles) return;
    this._particleTimer = 1.5; // segundos de animação

    const positions = this._particles.geometry.attributes.position;
    const count = positions.count;

    // Resetar posições
    for (let i = 0; i < count; i++) {
      positions.setXYZ(i, 0, 0, 0);
    }
    positions.needsUpdate = true;
    this._particles.material.opacity = 1;
    this._particles._velocities = Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 1.5,
      y: Math.random() * 1.5 + 0.5,
      z: (Math.random() - 0.5) * 1.5,
    }));
  }

  // ── Animações (GLB) ───────────────────────────────────────────────────────

  playAnimation(name, loop = false) {
    if (!this.mixer) return;
    const clip = this.animations[name.toLowerCase()];
    if (!clip) return;

    const action = this.mixer.clipAction(clip);
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loop;

    if (this.currentAction && this.currentAction !== action) {
      this.currentAction.fadeOut(0.4);
      action.reset().fadeIn(0.4).play();
    } else {
      action.reset().play();
    }
    this.currentAction = action;
  }

  // ── Reação ao clique ──────────────────────────────────────────────────────

  react() {
    if (this._placeholder) {
      this._reactionBounce();
    } else {
      this.playAnimation('reaction', false);
      setTimeout(() => this.playAnimation('idle', true), 1500);
    }
  }

  _reactionBounce() {
    if (!this._placeholder) return;
    const startY = this._placeholder.position.y;
    const duration = 600;
    const start = performance.now();

    const animate = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const bounce = Math.sin(t * Math.PI) * 0.45;
      if (this._placeholder) {
        this._placeholder.position.y = startY + bounce;
        this._placeholder.rotation.y = Math.sin(t * Math.PI * 2) * 0.4;
        this._placeholder.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.12);
      }
      if (t < 1) requestAnimationFrame(animate);
      else {
        if (this._placeholder) {
          this._placeholder.position.y = startY;
          this._placeholder.rotation.y = 0;
          this._placeholder.scale.setScalar(1);
        }
      }
    };
    requestAnimationFrame(animate);
  }

  // ── Update por frame ──────────────────────────────────────────────────────

  update(delta) {
    if (this.mixer) this.mixer.update(delta);

    if (this._placeholder) {
      this._updatePlaceholderAnimation(delta);
      this._updatePlaceholderColor(delta);
    }

    this._updateParticles(delta);
  }

  _updatePlaceholderAnimation(delta) {
    this._placeholderAngle += delta;

    switch (this.state) {
      case CharacterState.SLEEPING: {
        // Respiração lenta
        const breathe = Math.sin(this._placeholderAngle * 0.8) * 0.03;
        this._placeholder.position.y = 0.4 + breathe;
        this._placeholder.rotation.z = Math.sin(this._placeholderAngle * 0.4) * 0.08;
        break;
      }
      case CharacterState.BORED: {
        // Balanço lento e triste
        this._placeholder.position.y = 0.4 + Math.sin(this._placeholderAngle * 0.8) * 0.03;
        this._placeholder.rotation.z = Math.sin(this._placeholderAngle * 0.5) * 0.12;
        break;
      }
      case CharacterState.HAPPY: {
        // Pulo animado
        const jump = Math.abs(Math.sin(this._placeholderAngle * 4)) * 0.15;
        this._placeholder.position.y = 0.4 + jump;
        this._placeholder.rotation.y = Math.sin(this._placeholderAngle * 3) * 0.3;
        break;
      }
      default: {
        // Idle: flutuação suave
        this._placeholder.position.y = 0.4 + Math.sin(this._placeholderAngle * 1.5) * 0.045;
        this._placeholder.rotation.y = Math.sin(this._placeholderAngle * 0.5) * 0.12;
      }
    }
  }

  _updatePlaceholderColor(delta) {
    if (!this._placeholderMat) return;
    // Interpola suavemente para a cor alvo
    this._currentColor.lerp(this._targetColor, delta * 3);
    this._placeholderMat.color.copy(this._currentColor);
    this._placeholderMat.emissive.copy(this._currentColor);
    this._placeholderMat.emissiveIntensity = this.state === CharacterState.HAPPY ? 0.3 : 0.08;
  }

  _updateParticles(delta) {
    if (!this._particles || this._particleTimer <= 0) return;

    this._particleTimer -= delta;
    const t = 1 - Math.max(this._particleTimer / 1.5, 0);

    const positions = this._particles.geometry.attributes.position;
    const velocities = this._particles._velocities || [];

    for (let i = 0; i < positions.count; i++) {
      const v = velocities[i] || { x: 0, y: 1, z: 0 };
      positions.setXYZ(
        i,
        v.x * t,
        v.y * t - t * t * 2, // gravidade
        v.z * t
      );
    }
    positions.needsUpdate = true;
    this._particles.material.opacity = Math.max(0, 1 - t * 1.5);

    if (this._particleTimer <= 0) {
      this._particles.material.opacity = 0;
    }
  }
}
