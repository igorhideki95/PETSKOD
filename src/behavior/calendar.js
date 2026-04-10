export class CalendarSystem {
  static getSpecialEvent() {
    const today = new Date();
    const month = today.getMonth() + 1; // 1-12
    const day = today.getDate();

    if (month === 10 && day === 31) return 'HALLOWEEN';
    if (month === 12 && day === 24) return 'CHRISTMAS_EVE';
    if (month === 12 && day === 25) return 'CHRISTMAS';
    if (month === 1 && day === 1) return 'NEW_YEAR';
    
    // (Pode-se adicionar aniversário do projeto ou algo assim)

    return null;
  }
}
