import * as THREE from 'three';

export class FaceController {
  constructor(characterMesh) {
    this.mesh = characterMesh;
    this._refreshEyes();
    
    this.blinkTimer = 0;
    this.blinkInterval = Math.random() * 3 + 2;
    this.isBlinking = false;
    this.blinkDuration = 0.15;
    this.blinkProgress = 0;
    
    this.target = new THREE.Vector3(0, 0, 5);
    this.currentLook = new THREE.Vector3(0, 0, 1);
  }

  _refreshEyes() {
    if (!this.mesh) return;
    this.leftEye = this.mesh.getObjectByName('LeftEye');
    this.rightEye = this.mesh.getObjectByName('RightEye');
  }

  lookAt(x, y, z) {
    this.target.set(x, y, z);
  }

  update(delta) {
    if ((!this.leftEye || !this.rightEye) && this.mesh) {
      this._refreshEyes();
    }

    this.blinkTimer += delta;
    if (!this.isBlinking && this.blinkTimer > this.blinkInterval) {
      this.isBlinking = true;
      this.blinkProgress = 0;
    }

    let eyeScaleY = 1;
    if (this.isBlinking) {
      this.blinkProgress += delta;
      const t = this.blinkProgress / this.blinkDuration;
      
      if (t < 0.5) {
        eyeScaleY = 1.0 - (t * 2 * 0.9);
      } else if (t < 1.0) {
        eyeScaleY = 0.1 + ((t - 0.5) * 2 * 0.9);
      } else {
        this.isBlinking = false;
        this.blinkTimer = 0;
        this.blinkInterval = Math.random() * 3 + 2;
        eyeScaleY = 1;
      }
    }

    if (this.leftEye) this.leftEye.scale.y = eyeScaleY;
    if (this.rightEye) this.rightEye.scale.y = eyeScaleY;

    // 2. Lógica de movimento dos olhos (se eles estiverem montados de forma que rotacionar afete a pupila)
    // Aqui fazemos uma interpolação suave da direção do olhar
    this.currentLook.lerp(this.target, delta * 5);
    // Para simplificar, poderíamos aplicar uma leve rotação de offset ou mover localmente a posição do olho,
    // dependendo da malha.
  }
}
