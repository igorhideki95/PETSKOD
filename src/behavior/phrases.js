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
};

/** Retorna uma frase aleatória de uma categoria */
export function randomPhrase(category) {
  const list = PHRASES[category] || PHRASES.idle;
  return list[Math.floor(Math.random() * list.length)];
}
