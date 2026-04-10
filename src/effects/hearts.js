import * as THREE from 'three';

export class HeartEmitter {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    
    // Forma aproximada em 3D usando esfera achatada ou billboard
    this.geo = new THREE.SphereGeometry(0.04, 8, 8);
    this.mat = new THREE.MeshBasicMaterial({ 
      color: 0xff3366, 
      transparent: true,
      depthWrite: false
    });
  }

  emit(position, count = 3) {
    for(let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.geo, this.mat.clone());
      mesh.scale.set(1, 0.8, 0.2); // achata para lembrar um card/coração simples
      
      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * 0.3;
      mesh.position.y += Math.random() * 0.3 + 0.2; // aparece acima

      mesh.userData = {
        velocity: new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.4 + Math.random() * 0.4, 0),
        life: 1.5 + Math.random() * 0.5
      };

      this.scene.add(mesh);
      this.particles.push(mesh);
    }
  }

  update(delta) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.userData.life -= delta;

      if (p.userData.life <= 0) {
        this.scene.remove(p);
        p.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }

      p.position.addScaledVector(p.userData.velocity, delta);
      // Flutuação serpenteante minimalista
      p.position.x += Math.sin(p.userData.life * 10) * 0.005;
      
      p.material.opacity = Math.min(1, p.userData.life);
    }
  }
}
