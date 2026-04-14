// behavior/phrases.js
// Banco de frases por estado do personagem

export const PHRASES = {
  idle: [
    'Hmm...',
    'Por aqui!',
    'Estou aqui! 🐾',
    'Olhando o mundo...',
    'Que dia bonito!',
    'Pensamentos a mil... 💭',
    'Pronto pra ajudar!',
    'O que vamos fazer agora ?',
  ],

  happy: [
    'Yeee! 🎉',
    'Adoro isso!',
    'Que bom estar aqui!',
    'Obrigado! 😊',
    'Hehe!',
    'Sou feliz!',
    'Uhu!',
  ],

  bored: [
    'Hmm... que silêncio...',
    'Alguém aí?',
    'Onde estão todos?',
    'Estou entediado...',
    'Psst... me clica!',
    'Bocejando... 😴',
    'Esperando algo...',
  ],

  sleeping: [
    'Zzz...',
    'Ronh...',
    'Snzz...',
    'Mm... dormindo...',
  ],

  reaction: [
    'Ei!',
    'Oii!',
    'Olá!',
    'Que foi?',
    'Aqui! 👋',
    'Me achou!',
    'Boa! ⭐',
  ],

  greeting: [
    'Olá! Estou online! 🐾',
    'Pronto para o dia!',
    'Que bom te ver!',
  ],

  wakeUp: [
    'Hm? Acordei!',
    'Ah! Tá acordado?',
    'De volta!',
    'Bom dia! ☀️',
  ],

  greeting_bff: [
    'Meu humano favorito! ❤️',
    'Que saudade eu estava!',
    'Oi melhor amigo!',
    'O melhor momento do dia! 🐾'
  ],

  reaction_bff: [
    'Hehe, seu carinho é o melhor! ❤️',
    'Amo você!',
    'Yaaay! 🥰',
    'Puro amor!'
  ],

  levelUp: [
    'Uau, me sinto mais forte!',
    'Subi de nível! ⭐',
    'Estamos crescendo juntos!',
    'Mais inteligente e fofo!'
  ]
};

export const CHARACTER_PHRASES = {
  granny: {
    idle: ['Um dia de cada vez...', 'O tempo voa, aproveite-o.', 'Quer um conselho? Aprenda sempre.', 'Tenho muitas histórias...'],
    happy: ['Puras alegrias!', 'Isso aquece meu coração.', 'Maravilhoso!', 'Hehe, que gentil.'],
    reaction: ['Sim, querido?', 'O tempo é precioso.', 'Diga...'],
  },
  michelle: {
    idle: ['Bora lá!', 'Pronta pro desafio!', 'Foco no objetivo!', 'Já zerou o dia hoje?'],
    happy: ['AÊÊ! Mandou bem!', 'Top demais!', 'GG WP!', 'Incrível!'],
    reaction: ['E aí!', 'Manda ver!', 'Sussa?', 'Bora!'],
  }
};

/** Retorna uma frase aleatória de uma categoria, opcionalmente filtrada por personagem */
export function randomPhrase(category, characterKey = null) {
  // Tenta pegar do personagem específico primeiro
  if (characterKey && CHARACTER_PHRASES[characterKey]?.[category]) {
    const charList = CHARACTER_PHRASES[characterKey][category];
    return charList[Math.floor(Math.random() * charList.length)];
  }

  const list = PHRASES[category] || PHRASES.idle;
  return list[Math.floor(Math.random() * list.length)];
}
