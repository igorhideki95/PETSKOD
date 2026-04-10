export class LevelingSystem {
  constructor(initialData = {}) {
    this.level = initialData.level ?? 1;
    this.xp = initialData.xp ?? 0;
  }

  get xpRequiredForNextLevel() {
    // Curva de XP: 100 base + 50 a cada level extra (100, 150, 200, 250...)
    return 100 + (this.level - 1) * 50;
  }

  addXP(amount, onLevelUp) {
    this.xp += amount;
    
    let leveledUp = false;
    while (this.xp >= this.xpRequiredForNextLevel) {
      this.xp -= this.xpRequiredForNextLevel;
      this.level++;
      leveledUp = true;
    }

    if (leveledUp && typeof onLevelUp === 'function') {
      onLevelUp(this.level);
    }
    
    return leveledUp;
  }

  getData() {
    return {
      level: this.level,
      xp: this.xp
    };
  }
}
