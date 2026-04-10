export class MemorySystem {
  constructor(initialData = {}) {
    this.affinity = initialData.affinity ?? 50; // 0 a 100
    this.interactionsToday = initialData.interactionsToday ?? 0;
    this.lastInteractionDate = initialData.lastInteractionDate ?? this._getTodayDate();
    
    this._processDecay();
  }

  _getTodayDate() {
    return new Date().toDateString();
  }

  _processDecay() {
    const today = this._getTodayDate();
    if (this.lastInteractionDate !== today) {
      // Diferença rudimentar em dias (baseado em datas brutas)
      const last = new Date(this.lastInteractionDate);
      const curr = new Date(today);
      const diffTime = Math.abs(curr - last);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      
      if (diffDays > 0) {
        // Reduz afinidade em 3 pontos por dia ignorado
        const decay = diffDays * 3;
        this.affinity = Math.max(0, this.affinity - decay);
      }
      
      this.interactionsToday = 0;
      this.lastInteractionDate = today;
    }
  }

  interact() {
    this._processDecay();
    this.interactionsToday++;

    // Diminui os ganhos de afinidade conforme clica muito no mesmo dia (limite natural)
    const gain = Math.max(0, 5 - Math.floor(this.interactionsToday / 2));
    this.affinity = Math.min(100, this.affinity + gain);
  }

  getAffinityTier() {
    if (this.affinity >= 80) return 'best_friend';
    if (this.affinity >= 50) return 'friend';
    if (this.affinity >= 20) return 'neutral';
    return 'distant';
  }

  getData() {
    return {
      affinity: this.affinity,
      interactionsToday: this.interactionsToday,
      lastInteractionDate: this.lastInteractionDate
    };
  }
}
