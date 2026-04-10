// effects/trail.js
// Adiciona trilhas de partículas ao arrastar o pet

import * as THREE from 'three';

export class DragTrail {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.numParticles = 25; // Número máximo de partículas vivas simulaneamente
    
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.numParticles * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.1,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.points = new THREE.Points(geo, mat);
    this.scene.add(this.points);

    this.particles = [];
    for (let i = 0; i < this.numParticles; i++) {
      this.particles.push({
        active: false,
        age: 0,
        maxAge: 0.3 + Math.random() * 0.3,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0
      });
    }

    this._raycaster = new THREE.Raycaster();
  }

  spawn(mouseVec2) {
    // Projeta o mouse no plano do personagem (Z = 0)
    this._raycaster.setFromCamera(mouseVec2, this.camera);
    const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersectPoint = new THREE.Vector3();
    this._raycaster.ray.intersectPlane(planeZ, intersectPoint);

    // Encontra 2 partículas inativas e as inicializa
    let spawned = 0;
    for (const p of this.particles) {
      if (!p.active) {
        p.active = true;
        p.age = 0;
        p.x = intersectPoint.x + (Math.random() - 0.5) * 0.15;
        p.y = intersectPoint.y + (Math.random() - 0.5) * 0.15;
        p.z = Math.random() * 0.2; // Leve variaćão em Z para ficar "solto"
        p.vx = (Math.random() - 0.5) * 0.4;
        p.vy = (Math.random() - 0.5) * 0.4 - 0.2; // gravidade suave
        p.vz = (Math.random() - 0.5) * 0.2;
        spawned++;
        if (spawned >= 2) break;
      }
    }
  }

  update(delta) {
    const positions = this.points.geometry.attributes.position.array;
    let anyActive = false;

    for (let i = 0; i < this.numParticles; i++) {
      const p = this.particles[i];
      if (p.active) {
        anyActive = true;
        p.age += delta;
        p.x += p.vx * delta;
        p.y += p.vy * delta;
        p.z += p.vz * delta;

        // Fading baseado na idade (simulado pelo tamanho poderia ser, mas usamos position 9999 para esconder)
        if (p.age >= p.maxAge) {
          p.active = false;
        }
      }
      
      positions[i * 3] = p.active ? p.x : 9999;
      positions[i * 3 + 1] = p.active ? p.y : 9999;
      positions[i * 3 + 2] = p.active ? p.z : 9999;
    }

    if (anyActive) {
      this.points.geometry.attributes.position.needsUpdate = true;
    }
  }
}
