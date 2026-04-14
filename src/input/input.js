// input/input.js — Phase 2
// Mouse: clique com raycasting, drag para mover janela

import * as THREE from 'three';
import { DragTrail } from '../effects/trail.js';

export class InputManager {
  constructor(renderer, camera, character, behaviorSystem, scene, onContextMenu = null) {
    this.renderer = renderer;
    this.camera = camera;
    this.character = character;
    this.behaviorSystem = behaviorSystem;
    this.scene = scene;
    this.onContextMenu = onContextMenu;

    this.trail = scene ? new DragTrail(scene, camera) : null;

    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();

    this._isDragging = false;
    this._dragStartX = 0;
    this._dragStartY = 0;
    this._lastMouseX = 0;
    this._lastMouseY = 0;
    this._DRAG_THRESHOLD = 4; // px para considerar drag

    this._isIgnoringMouse = false;
    this.isOverUI = false; // Flag para forçar foco no UI
    this._passthroughThrottle = 0;

    this._canvas = renderer.domElement;
    this._boundHandlers = null;
    this._bindEvents();
  }

  _bindEvents() {
    this._boundHandlers = {
      onMouseDown: this._onMouseDown.bind(this),
      onMouseMove: this._onMouseMove.bind(this),
      onMouseUp: this._onMouseUp.bind(this),
      onClick: this._onClick.bind(this),
      onContextMenu: this._onContextMenu.bind(this)
    };
    this._canvas.addEventListener('mousedown', this._boundHandlers.onMouseDown);
    window.addEventListener('mousemove', this._boundHandlers.onMouseMove);
    window.addEventListener('mouseup', this._boundHandlers.onMouseUp);
    this._canvas.addEventListener('click', this._boundHandlers.onClick);
    this._canvas.addEventListener('contextmenu', this._boundHandlers.onContextMenu);
  }

  _onContextMenu(e) {
    e.preventDefault();
    if (this._isDragging) return;
    
    // Raycast para garantir que clicou no pet
    this._raycaster.setFromCamera(this._mouse, this.camera);
    const collidables = this.character.getCollidableObjects();
    const intersects = this._raycaster.intersectObjects(collidables, true);

    if (intersects.length > 0 && this.onContextMenu) {
      // Passa coordenadas relativas ao container
      const rect = this._canvas.getBoundingClientRect();
      this.onContextMenu(e.clientX - rect.left, e.clientY - rect.top);
    }
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
    if (rect.width > 0 && rect.height > 0) {
      this._mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this._mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      // Sanitização de segurança
      if (isNaN(this._mouse.x)) this._mouse.x = 0;
      if (isNaN(this._mouse.y)) this._mouse.y = 0;
    }

    // ── Mouse Passthrough ─────────────────────────────────────────────────────
    // Se estiver sobre o UI (menu, botão fechar), NUNCA ignora mouse
    if (this.isOverUI) {
      if (this._isIgnoringMouse && window.petskodAPI?.setIgnoreMouseEvents) {
        window.petskodAPI.setIgnoreMouseEvents(false);
        this._isIgnoringMouse = false;
      }
      return; // Pula lógica de passthrough para o personagem
    }

    // Se não estiver arrastando, verifica se o mouse está sobre o personagem
    if (!this._isDragging && window.petskodAPI?.setIgnoreMouseEvents) {
      this._passthroughThrottle++;
      if (this._passthroughThrottle % 2 === 0) { // Throttle simples a cada 2 frames de mousemove
        this._raycaster.setFromCamera(this._mouse, this.camera);
        const collidables = this.character.getCollidableObjects();
        const intersects = this._raycaster.intersectObjects(collidables, true);
        const isOverCharacter = intersects.length > 0;

        if (this._isIgnoringMouse && isOverCharacter) {
          window.petskodAPI.setIgnoreMouseEvents(false);
          this._isIgnoringMouse = false;
          if (this.character.onHoverEnter) this.character.onHoverEnter();
        } else if (!this._isIgnoringMouse && !isOverCharacter) {
          window.petskodAPI.setIgnoreMouseEvents(true, { forward: true });
          this._isIgnoringMouse = true;
          if (this.character.onHoverExit) this.character.onHoverExit();
        }
      }
    }

    // Se o personagem possuir rosto, atualiza o olhar dele para o mouse
    if (this.character && this.character.face) {
      this.character.face.lookAt(this._mouse.x * 2, this._mouse.y * 2, 5);
    }

    if (e.buttons !== 1) return;

    const deltaX = e.screenX - this._lastMouseX;
    const deltaY = e.screenY - this._lastMouseY;

    const totalDX = e.screenX - this._dragStartX;
    const totalDY = e.screenY - this._dragStartY;

    if (Math.abs(totalDX) > this._DRAG_THRESHOLD || Math.abs(totalDY) > this._DRAG_THRESHOLD) {
      if (!this._isDragging) {
        this._isDragging = true;
        // Captura snapshot de transform ANTES de qualquer movimento
        if (this.character.startDragLock) this.character.startDragLock();
        if (this.behaviorSystem.startDragging) this.behaviorSystem.startDragging();
      }
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
    if (this._isDragging) {
      // Restore transform ANTES de mudar estado para evitar flash de escala errada
      if (this.character.endDragLock) this.character.endDragLock();
      if (this.behaviorSystem.stopDragging) this.behaviorSystem.stopDragging();
      if (this.character.land) this.character.land();
    }
    this._isDragging = false;
    this._canvas.style.cursor = 'grab';
  }

  _onClick(e) {
    if (this._isDragging) return;

    const rect = this._canvas.getBoundingClientRect();
    this._mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this._raycaster.setFromCamera(this._mouse, this.camera);

    const collidables = this.character.getCollidableObjects();
    const intersects = this._raycaster.intersectObjects(collidables, true);

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

    // Durante drag, ignora hover check — o canvas se moveu e as coords do mouse
    // relativas a ele são instáveis, causando eventos onHoverEnter/Exit parasitas
    if (this._isDragging) return;

    // Hover check (apenas fora do drag)
    if (this.scene && this.character) {
      this._raycaster.setFromCamera(this._mouse, this.camera);
      const collidables = this.character.getCollidableObjects();
      const intersects = this._raycaster.intersectObjects(collidables, true);
      if (intersects.length > 0) {
        this.character.onHoverEnter();
      } else {
        this.character.onHoverExit();
      }
    }
  }

  destroy() {
    if (this._boundHandlers) {
      this._canvas.removeEventListener('mousedown', this._boundHandlers.onMouseDown);
      window.removeEventListener('mousemove', this._boundHandlers.onMouseMove);
      window.removeEventListener('mouseup', this._boundHandlers.onMouseUp);
      this._canvas.removeEventListener('click', this._boundHandlers.onClick);
      this._canvas.removeEventListener('contextmenu', this._boundHandlers.onContextMenu);
      this._boundHandlers = null;
    }
  }
}
