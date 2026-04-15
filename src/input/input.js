// input/input.js — v3 (drag-proof)
// Mouse: clique com raycasting, drag para mover janela

import * as THREE from 'three';
import { DragTrail } from '../effects/trail.js';

export class InputManager {
  constructor(renderer, camera, character, behaviorSystem, scene, onContextMenu = null) {
    this.renderer       = renderer;
    this.camera         = camera;
    this.character      = character;
    this.behaviorSystem = behaviorSystem;
    this.scene          = scene;
    this.onContextMenu  = onContextMenu;

    this.trail = scene ? new DragTrail(scene, camera) : null;

    this._raycaster = new THREE.Raycaster();
    this._mouse     = new THREE.Vector2();

    this._isDragging        = false;
    this._dragStartX        = 0;
    this._dragStartY        = 0;
    this._lastMouseX        = 0;
    this._lastMouseY        = 0;
    this._DRAG_THRESHOLD    = 4;

    this._isIgnoringMouse   = false;
    this.isOverUI           = false;
    this._passthroughThrottle = 0;

    this._canvas        = renderer.domElement;
    this._boundHandlers = null;
    this._bindEvents();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Bind de eventos
  // ─────────────────────────────────────────────────────────────────────────

  _bindEvents() {
    this._boundHandlers = {
      onMouseDown:   this._onMouseDown.bind(this),
      onMouseMove:   this._onMouseMove.bind(this),
      onMouseUp:     this._onMouseUp.bind(this),
      onClick:       this._onClick.bind(this),
      onContextMenu: this._onContextMenu.bind(this),
    };
    this._canvas.addEventListener('mousedown',   this._boundHandlers.onMouseDown);
    window.addEventListener      ('mousemove',   this._boundHandlers.onMouseMove);
    window.addEventListener      ('mouseup',     this._boundHandlers.onMouseUp);
    this._canvas.addEventListener('click',       this._boundHandlers.onClick);
    this._canvas.addEventListener('contextmenu', this._boundHandlers.onContextMenu);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────────────

  _onContextMenu(e) {
    e.preventDefault();
    if (this._isDragging) return;

    this._raycaster.setFromCamera(this._mouse, this.camera);
    const hits = this._raycaster.intersectObjects(this.character.getCollidableObjects(), true);
    if (hits.length > 0 && this.onContextMenu) {
      const rect = this._canvas.getBoundingClientRect();
      this.onContextMenu(e.clientX - rect.left, e.clientY - rect.top);
    }
  }

  _onMouseDown(e) {
    if (e.button !== 0) return;

    // Se havia um drag anterior sem mouseup (edge case), encerra antes de iniciar
    if (this._isDragging) {
      this._endDrag();
    }

    this._isDragging = false;
    this._dragStartX = e.screenX;
    this._dragStartY = e.screenY;
    this._lastMouseX = e.screenX;
    this._lastMouseY = e.screenY;
    this._canvas.style.cursor = 'grabbing';
  }

  _onMouseMove(e) {
    // ── Atualiza coords do mouse ──
    const rect = this._canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this._mouse.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      this._mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      if (isNaN(this._mouse.x)) this._mouse.x = 0;
      if (isNaN(this._mouse.y)) this._mouse.y = 0;
    }

    // ── Não atualiza face durante drag (evita chamadas sobre bones) ──
    if (!this._isDragging && this.character?.face) {
      this.character.face.lookAt(this._mouse.x * 2, this._mouse.y * 2, 5);
    }

    // ── Passthrough — só fora do drag ──
    if (!this._isDragging && !this.isOverUI && window.petskodAPI?.setIgnoreMouseEvents) {
      this._passthroughThrottle++;
      if (this._passthroughThrottle % 3 === 0) {
        this._raycaster.setFromCamera(this._mouse, this.camera);
        const over = this._raycaster.intersectObjects(this.character.getCollidableObjects(), true).length > 0;
        if (this._isIgnoringMouse && over) {
          window.petskodAPI.setIgnoreMouseEvents(false);
          this._isIgnoringMouse = false;
          this.character.onHoverEnter?.();
        } else if (!this._isIgnoringMouse && !over) {
          window.petskodAPI.setIgnoreMouseEvents(true, { forward: true });
          this._isIgnoringMouse = true;
          this.character.onHoverExit?.();
        }
      }
    }

    if (e.buttons !== 1) return;

    // ── Detecta início de drag ──
    const totalDX = e.screenX - this._dragStartX;
    const totalDY = e.screenY - this._dragStartY;
    if (!this._isDragging &&
        (Math.abs(totalDX) > this._DRAG_THRESHOLD || Math.abs(totalDY) > this._DRAG_THRESHOLD)) {
      this._startDrag();
    }

    // ── Move janela ──
    if (this._isDragging && window.petskodAPI) {
      const dx = e.screenX - this._lastMouseX;
      const dy = e.screenY - this._lastMouseY;
      window.petskodAPI.moveWindow(dx, dy);

      if (this.trail) {
        const r  = this._canvas.getBoundingClientRect();
        const mx = ((e.clientX - r.left) / r.width)  * 2 - 1;
        const my = -((e.clientY - r.top) / r.height) * 2 + 1;
        this.trail.spawn(new THREE.Vector2(mx, my));
      }
    }

    this._lastMouseX = e.screenX;
    this._lastMouseY = e.screenY;
  }

  _onMouseUp() {
    if (this._isDragging) {
      this._endDrag();
    }
    this._canvas.style.cursor = 'grab';
  }

  _onClick(e) {
    if (this._isDragging) return;

    const rect = this._canvas.getBoundingClientRect();
    this._mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    this._mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;

    this._raycaster.setFromCamera(this._mouse, this.camera);
    const hits = this._raycaster.intersectObjects(this.character.getCollidableObjects(), true);
    if (hits.length > 0) {
      this.character.react?.();
      this.behaviorSystem.interact?.();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Drag — centralizado em dois métodos atômicos
  // ─────────────────────────────────────────────────────────────────────────

  _startDrag() {
    this._isDragging = true;
    // 1. Congela o modelo (para o mixer + matrix)
    this.character.startDragLock?.();
    // 2. Notifica o behavior system (muda estado para DRAGGING)
    this.behaviorSystem.startDragging?.();
  }

  _endDrag() {
    this._isDragging = false;
    // Ordem inversa: libera o modelo ANTES de mudar o estado para evitar
    // que applyBehaviorState(idle) chame playAnimation enquanto o lock ainda está ativo
    this.character.endDragLock?.();
    this.behaviorSystem.stopDragging?.();
    this.character.land?.();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Update loop
  // ─────────────────────────────────────────────────────────────────────────

  update(delta) {
    if (this.trail) this.trail.update(delta);
    if (this._isDragging) return; // nada sobre o personagem durante drag

    if (this.scene && this.character) {
      this._raycaster.setFromCamera(this._mouse, this.camera);
      const hits = this._raycaster.intersectObjects(this.character.getCollidableObjects(), true);
      if (hits.length > 0) {
        this.character.onHoverEnter?.();
      } else {
        this.character.onHoverExit?.();
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Destroy
  // ─────────────────────────────────────────────────────────────────────────

  destroy() {
    if (this._boundHandlers) {
      this._canvas.removeEventListener('mousedown',   this._boundHandlers.onMouseDown);
      window.removeEventListener      ('mousemove',   this._boundHandlers.onMouseMove);
      window.removeEventListener      ('mouseup',     this._boundHandlers.onMouseUp);
      this._canvas.removeEventListener('click',       this._boundHandlers.onClick);
      this._canvas.removeEventListener('contextmenu', this._boundHandlers.onContextMenu);
      this._boundHandlers = null;
    }
    if (this._isDragging) this._endDrag();
  }
}
