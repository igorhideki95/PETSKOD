// effects/ambient.js
// Gerencia a transição de iluminação baseada na hora do dia

import * as THREE from 'three';

export class AmbientManager {
  constructor(scene, lights) {
    this.scene = scene;
    this.lights = lights; // { ambient, dirLight, fillLight }
    
    // Configurações de cores por hora do dia
    this.themes = {
      day: {
        ambient: 0xffffff,
        ambientIntensity: 0.7,
        dirLight: 0xffffff,
        dirIntensity: 1.0,
        fillLight: 0x8899ff,
        fillIntensity: 0.3
      },
      evening: {
        ambient: 0xffe0b2,
        ambientIntensity: 0.6,
        dirLight: 0xffa726,
        dirIntensity: 0.9,
        fillLight: 0x9575cd,
        fillIntensity: 0.5
      },
      night: {
        ambient: 0x9fa8da,
        ambientIntensity: 0.4,
        dirLight: 0x5c6bc0,
        dirIntensity: 0.5,
        fillLight: 0x283593,
        fillIntensity: 0.4
      }
    };

    this.currentTheme = null;
    this._checkTime();
    
    // Atualiza a cada 5 minutos
    this._interval = setInterval(() => this._checkTime(), 5 * 60 * 1000);
  }

  _checkTime() {
    const hour = new Date().getHours();
    let themeName = 'day';

    if (hour >= 18 && hour < 22) {
      themeName = 'evening';
    } else if (hour >= 22 || hour < 6) {
      themeName = 'night';
    } else {
      themeName = 'day';
    }

    if (this.currentTheme !== themeName) {
      this._applyTheme(themeName);
    }
  }

  _applyTheme(themeName) {
    this.currentTheme = themeName;
    const theme = this.themes[themeName];

    if (!this.lights) return;
    
    if (this.lights.ambient) {
      this.lights.ambient.color.setHex(theme.ambient);
      this.lights.ambient.intensity = theme.ambientIntensity;
    }
    if (this.lights.dirLight) {
      this.lights.dirLight.color.setHex(theme.dirLight);
      this.lights.dirLight.intensity = theme.dirIntensity;
    }
    if (this.lights.fillLight) {
      this.lights.fillLight.color.setHex(theme.fillLight);
      this.lights.fillLight.intensity = theme.fillIntensity;
    }
    console.log(`[Ambient] Tema de iluminação alterado para: ${themeName}`);
  }

  destroy() {
    clearInterval(this._interval);
  }
}
