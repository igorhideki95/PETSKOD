import { CalendarSystem } from './calendar.js';

export function getContextualGreeting(affinityTier) {
  const event = CalendarSystem.getSpecialEvent();
  
  // 1. Prioriza Datas Comemorativas
  if (event === 'HALLOWEEN') return 'Doces ou travessuras! 🎃';
  if (event === 'CHRISTMAS') return 'Feliz Natal! 🎄';
  if (event === 'CHRISTMAS_EVE') return 'A véspera de Natal chegou! 🎁';
  if (event === 'NEW_YEAR') return 'Feliz Ano Novo! ✨';

  // 2. Horário do dia
  const hour = new Date().getHours();
  
  if (affinityTier === 'best_friend') {
    if (hour < 6) return 'Coruja? Eu também! 🦉❤️';
    if (hour < 12) return 'Bom dia, melhor amigo! ☀️';
    if (hour < 18) return 'Uma boa tarde pra nós! ☕';
    return 'Boa noite pra minha pessoa favorita! 🌙';
  }

  if (hour < 6) return 'Tão cedo... ou tão tarde? 🦉';
  if (hour < 12) return 'Bom dia! ☀️';
  if (hour < 18) return 'Boa tarde! ☕';
  return 'Boa noite! 🌙';
}
