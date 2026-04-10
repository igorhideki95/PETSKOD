// input/input.js — Phase 2
// Mouse: clique com raycasting, drag para mover janela

import * as THREE from 'three';
import { DragTrail } from '../effects/trail.js';

export class InputManager {
  constructor(renderer, camera, character, behaviorSystem, scene) {
    this.renderer = renderer;
    this.camera = camera;
    this.character = character;
    this.behaviorSystem = behaviorSystem;
    this.scene = scene;

    this.trail = scene ? new DragTrail(scene, camera) : null;

    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();

    this._isDragging = false;
    this._dragStartX = 0;
    this._dragStartY = 0;
    this._lastMouseX = 0;
    this._lastMouseY = 0;
    this._DRAG_THRESHOLD = 4; // px para considerar drag

    this._canvas = renderer.domElement;
    this._bindEvents();
  }

  _bindEvents() {
    this._canvas.addEventListener('mousedown', this._onMouseDown.bind(this));
    window.addEventListener('mousemove', this._onMouseMove.bind(this));
    window.addEventListener('mouseup', this._onMouseUp.bind(this));
    this._canvas.addEventListener('click', this._onClick.bind(this));
    this._canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  _onMouseDown(e) {
    if (e.button !== 0) return;

    this._isDragging = false;
    this._dragStartX = e.screenX;
    this._dragStartY = e.screenY;
    this._lastMouseX = e.screenX;
    this._lastMouseY = e.screenY;
    this._canvas.style.cursor = 'grabbing';
  }

  _onMouseMove(e) {
    const rect = this._canvas.getBoundingClientRect();
    this._mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    // Se o personagem possuir rosto, atualiza o olhar dele para o mouse
    // Converter de [-1, 1] no espaço da tela para algo visual 3D
    if (this.character && this.character.face) {
      this.character.face.lookAt(this._mouse.x * 2, this._mouse.y * 2, 5);
    }

    if (e.buttons !== 1) return;

    const deltaX = e.screenX - this._lastMouseX;
    const deltaY = e.screenY - this._lastMouseY;

    const totalDX = e.screenX - this._dragStartX;
    const totalDY = e.screenY - this._dragStartY;

    if (Math.abs(totalDX) > this._DRAG_THRESHOLD || Math.abs(totalDY) > this._DRAG_THRESHOLD) {
      this._isDragging = true;
    }

    if (this._isDragging && window.petskodAPI) {
      window.petskodAPI.moveWindow(deltaX, deltaY);
      
      const rect = this._canvas.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const my = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      if (this.trail) this.trail.spawn(new THREE.Vector2(mx, my));
    }

    this._lastMouseX = e.screenX;
    this._lastMouseY = e.screenY;
  }

  _onMouseUp() {
    this._isDragging = false;
    this._canvas.style.cursor = 'grab';
  }

  _onClick(e) {
    if (this._isDragging) return;

    const rect = this._canvas.getBoundingClientRect();
    this._mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this._raycaster.setFromCamera(this._mouse, this.camera);

    const objects = [
      this.character._placeholder,
      this.character.model,
    ].filter(Boolean);

    const intersects = this._raycaster.intersectObjects(objects, true);

    if (intersects.length > 0) {
      this._onCharacterClick();
    }
  }

  _onCharacterClick() {
    this.character.react();
    // Notifica o sistema de comportamento → ele cuida de fala + estado
    this.behaviorSystem.interact();
  }

  update(delta) {
    if (this.trail) this.trail.update(delta);

    // Hover check
    if (this.scene && this.character) {
      this._raycaster.setFromCamera(this._mouse, this.camera);
      const objects = [this.character._placeholder, this.character.model].filter(Boolean);
      
      const intersects = this._raycaster.intersectObjects(objects, true);
      if (intersects.length > 0) {
        this.character.onHoverEnter();
      } else {
        this.character.onHoverExit();
      }
    }
  }

  destroy() {
    this._canvas.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
    this._canvas.removeEventListener('click', this._onClick);
  }
}
