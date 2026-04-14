import * as THREE from 'three';

export class HeartEmitter {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    
    this.geo = new THREE.SphereGeometry(0.04, 8, 8);
    this.mat = new THREE.MeshBasicMaterial({ 
      color: 0xff3366, 
      transparent: true,
      depthWrite: false
    });
  }

  emit(position, count = 3) {
    for(let i = 0; i < count; i++) {
      // Usamos a mesma geometria e material para todos, variando apenas escala/posiçăo
      const mesh = new THREE.Mesh(this.geo, this.mat);
      mesh.scale.set(1, 0.8, 0.2);
      
      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * 0.3;
      mesh.position.y += Math.random() * 0.3 + 0.2;

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
        // NÃO faz dispose de geo/mat aqui — são instâncias compartilhadas.
        // Serão liberadas corretamente em dispose().
        this.particles.splice(i, 1);
        continue;
      }

      p.position.addScaledVector(p.userData.velocity, delta);
      p.position.x += Math.sin(p.userData.life * 10) * 0.005;
    }
  }

  dispose() {
    for (const p of this.particles) {
      this.scene.remove(p);
    }
    this.particles = [];
    this.geo.dispose();
    this.mat.dispose();
  }
}
