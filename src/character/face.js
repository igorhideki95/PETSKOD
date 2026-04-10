import * as THREE from 'three';

export class FaceController {
  constructor(characterMesh) {
    this.mesh = characterMesh;
    
    // Tenta encontrar os olhos pelo nome na hierarquia
    this.leftEye = this.mesh.getObjectByName('LeftEye');
    this.rightEye = this.mesh.getObjectByName('RightEye');
    
    this.blinkTimer = 0;
    this.blinkInterval = Math.random() * 3 + 2; // 2 a 5 segundos
    this.isBlinking = false;
    this.blinkDuration = 0.15; // 150ms rápido
    this.blinkProgress = 0;
    
    // Alvo para onde os olhos "olhariam"
    this.target = new THREE.Vector3(0, 0, 5);
    this.currentLook = new THREE.Vector3(0, 0, 1);
  }

  lookAt(x, y, z) {
    this.target.set(x, y, z);
  }

  update(delta) {
    // 1. Lógica do Piscar
    this.blinkTimer += delta;
    if (!this.isBlinking && this.blinkTimer > this.blinkInterval) {
      this.isBlinking = true;
      this.blinkProgress = 0;
    }

    let eyeScaleY = 1;
    if (this.isBlinking) {
      this.blinkProgress += delta;
      const t = this.blinkProgress / this.blinkDuration;
      
      // Animação vai-e-volta (Ping pong): 1 -> 0.1 -> 1
      if (t < 0.5) {
        eyeScaleY = 1.0 - (t * 2 * 0.9); // fecha
      } else if (t < 1.0) {
        eyeScaleY = 0.1 + ((t - 0.5) * 2 * 0.9); // abre
      } else {
        this.isBlinking = false;
        this.blinkTimer = 0;
        this.blinkInterval = Math.random() * 3 + 2;
        eyeScaleY = 1;
      }
    }

    // Aplica a escala Y se os olhos existirem (piscar)
    if (this.leftEye) this.leftEye.scale.y = eyeScaleY;
    if (this.rightEye) this.rightEye.scale.y = eyeScaleY;

    // 2. Lógica de movimento dos olhos (se eles estiverem montados de forma que rotacionar afete a pupila)
    // Aqui fazemos uma interpolação suave da direção do olhar
    this.currentLook.lerp(this.target, delta * 5);
    // Para simplificar, poderíamos aplicar uma leve rotação de offset ou mover localmente a posição do olho,
    // dependendo da malha.
  }
}
