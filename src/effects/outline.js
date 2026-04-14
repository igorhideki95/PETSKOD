import * as THREE from 'three';

export class OutlineEffect {
  constructor(characterNode) {
    this.rootNode = characterNode;
    this.outlines = [];
    this.isActive = false;

    this.outlineMaterial = new THREE.MeshBasicMaterial({
      color: 0x88ffff,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this._createOutlines();
  }

  _createOutlines() {
    if (!this.rootNode) return;
    
    // Convert to array FIRST to prevent traverse from iterating over newly added children
    const meshesToOutline = [];
    this.rootNode.traverse((child) => {
      // Coleta meshes que precisam ter outline
      if (child.isMesh && child.name !== 'LeftEye' && child.name !== 'RightEye') {
        meshesToOutline.push(child);
      }
    });

    meshesToOutline.forEach((child) => {
      // Em vez de clonar todos os descendantes, criamos uma casca baseada na mesma geometria
      let outlineMesh;
      if (child.isSkinnedMesh) {
        outlineMesh = new THREE.SkinnedMesh(child.geometry, this.outlineMaterial);
        outlineMesh.bind(child.skeleton, child.bindMatrix);
      } else {
        outlineMesh = new THREE.Mesh(child.geometry, this.outlineMaterial);
      }
      
      outlineMesh.scale.set(1.08, 1.08, 1.08); 
      outlineMesh.name = 'OutlineMarker';
      outlineMesh.userData.isOutline = true;
      child.add(outlineMesh);
      outlineMesh.visible = false;
      this.outlines.push(outlineMesh);
    });
  }

  show() {
    if (this.isActive || this.outlines.length === 0) return;
    this.isActive = true;
    this.outlines.forEach(m => m.visible = true);
  }

  hide() {
    if (!this.isActive) return;
    this.isActive = false;
    this.outlines.forEach(m => m.visible = false);
  }

  update(delta) {
    if (!this.isActive) return;
    const t = Date.now() * 0.005;
    this.outlineMaterial.opacity = 0.3 + Math.sin(t) * 0.2;
  }

  dispose() {
    this.outlines.forEach(outline => {
      if (outline.geometry) outline.geometry.dispose();
      outline.parent?.remove(outline);
    });
    this.outlines = [];
    if (this.outlineMaterial) {
      this.outlineMaterial.dispose();
    }
  }
}
