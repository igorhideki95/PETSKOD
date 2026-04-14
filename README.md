<div align="center">
  <img src="assets/icons/petskod_32.png" alt="PETSKOD Logo" width="80" height="80">
  <h1>PETSKOD 🐾</h1>
  <p><strong>3D Desktop Companion inteligente construído com Electron + Three.js</strong></p>

  [![Electron Version](https://img.shields.io/badge/Electron-^28.0.0-47848f?style=flat-square&logo=electron)](https://www.electronjs.org/)
  [![Three.js Version](https://img.shields.io/badge/Three.js-^0.160.0-black?style=flat-square&logo=three.js)](https://threejs.org/)
  [![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
</div>

<br />

**PETSKOD** é um companheiro virtual 3D que vive diretamente na sua área de trabalho. Ele foi projetado desde o princípio com foco em **extrema leveza, performance em computadores modestos e um alto nível de fofura e interatividade**.

Diferente de widgets pesados, o PETSKOD utiliza um loop de renderização cravado em 30 FPS e a flag de low-power no WebGL, garantindo que você mal sinta sua presença nos recursos da máquina, mas sempre possa contar com a sua companhia visual e sonora.

---

## 📑 Índice
- [✨ Funcionalidades](#-funcionalidades)
- [🚀 Instalação e Execução](#-instalação-e-execução)
- [🎮 Como Interagir](#-como-interagir)
- [🏗️ Arquitetura e Estrutura](#-arquitetura-e-estrutura)
- [🛠️ Guia de Customização](#-guia-de-customização)
  - [Adicionando seu Próprio Modelo 3D](#adicionando-seu-próprio-modelo-3d)
  - [Customizando Frases e TTS](#customizando-frases-e-tts)
- [🔌 Guia para Desenvolvedores (IPC API)](#-guia-para-desenvolvedores-ipc-api)
- [🔮 Roadmap](#-roadmap-próximas-fases)

---

## ✨ Funcionalidades

O projeto atualmente contempla as evoluções da Fase 1 (MVP) e Fase 2 (Brain & Behavior).

### 🖥️ Overlay e Motor 3D
- **Janela Always-On-Top Transparente**: Vive livre na tela, sem fundos e sem bordas de janela.
- **Renderização Three.js**: Carrega modelos GLB e GLTF com o `AnimationMixer` perfeitamente integrado.
- **Movimentação Livre**: Arraste-o para qualquer lugar da tela perfeitamente (Custom Native Dragging).
- **Leveza Absoluta**: Renderização a cravados 30 FPS (configurable tick) em modo `low-power`.

### 🧠 Cérebro, Memória e Comportamento Autônomo
- **Máquina de Estados**: O personagem transita nativamente entre ciclos de `Idle`, `Happy`, `Bored`, `Sleeping` e `Reacting`.
- **Motor de Personalidade (Memória e Leveling)**: Você ganha XP interagindo (clicando) diariamente com ele. Se não aparecer a tempo, a afinidade "decai".
- **Amigo Virtual Perfeito**: Alcance o tier de afinidade "Best Friend" para reações exclusivas com explosão de corações virtuais ❤️.
- **Consciência de Calendário (System-Aware)**: O pet sabe quando é Halloween, Natal, a hora atual do dia (madrugada/manhã) e cumprimenta você de acordo com a vida real. 
- **Persistência de Dados**: Ele salva todo o progresso (XP, last time seen) localmente em um data store no disco usando _Electron-Store_.
- **Balões de Fala e TTS Nativo**: Além de UI animada, o pet integra chamadas de `Windows SAPI` invisíveis via PowerShell e te escuta nativamente (Text-to-Speech) sem lag e offline.
- **Tray Icon Poderoso**: Menu de sistema disponível na bandeja para forçar estados e encerrá-lo rapidamente.

---

## 🚀 Instalação e Execução

### Pré-requisitos
- Sistema Operacional: **Windows** (Para recurso de Fala - TTS via PowerShell nativo)
- [Node.js](https://nodejs.org) (v18 ou superior recomendado)
- NPM ou Yarn

### Passos

1. **Clone ou navegue até a pasta do projeto:**
   ```bash
   cd C:\User\PETSKOD
   ```

2. **Instale as dependências (Three.js & Electron):**
   ```bash
   npm install
   ```

3. **Inicie a Aplicação:**
   ```bash
   npm start
   ```

> **Nota para Desenvolvedores**: Caso queira depurar o projeto com o console Chrome DevTools acoplado na janela, utilize `npm run dev`.

---

## 🎮 Como Interagir

No centro da experiência do PETSKOD, você tem os seguintes comandos intuitivos:

- **Arraste Livre**: Clique e segure ao redor do personagem ou nela e arraste-o por toda a extensão de seus monitores.
- **Cumprimentar / Reação**: Dê um clique simples no personagem. Ele irá emitir um festival de partículas, falar algo e entrar no estado *Feliz* por 5 segundos.
- **Menu da Bandeja do Sistema**: Localize o ícone do PETSKOD (um círculo roxo) na barra de tarefas do Windows. Lá você pode:
   - Forçar o personagem a dormir (`Dormindo`)
   - Forçá-lo a sorrir (`Feliz`)
   - Ocultá-lo ou encerrá-lo (`Ocultar / Fechar`)

---

## 🏗️ Arquitetura e Estrutura

Código modular, legível e orientado a eventos no Render, usando contexto seguro de IPC bridge.

```text
PETSKOD/
├── index.html                   ← Scaffold visual HUD (Balões e Transparência)
├── package.json                 ← Ponto de start / Node scripts
├── scripts/
│   └── generate-icon.js         ← Script sem lib para gerar Ícones Node Nativo
├── assets/
│   ├── icons/                   ← Ícones RGBA do App/Tray gerados dinamicamente
│   └── models/                  ← Local do seu arquivo `character.glb`
└── src/
    ├── app/                     ← "Coração Electron"
    │   ├── main.js              ← Gerência SO (Janela, PowerShell SAPI TTS, Tray)
    │   ├── preload.js           ← IPC Secure Bridge contextBridge
    │   └── renderer.js          ← Main Front-end Script, Instancia Cena 3D e Lógicas
    ├── behavior/                ← "Cérebro do Pet"
    │   ├── behavior.js          ← State Machine (Timeouts automáticos de vida)
    │   └── phrases.js           ← Dicionário Lexical de Frases JSON
    ├── character/               ← "O Corpo Mágico"
    │   └── character.js         ← Lida com o Mesh, Materiais Lerp, GLB Anim Loader
    ├── input/                   ← "O Tato e Motor"
    │   └── input.js             ← Engine de Raycasting para clicks precisos no mesh
    ├── rendering/               ← "Os Olhos Essenciais"
    │   ├── loader.js            ← Facilidade GLTF Promise base
    │   └── scene.js             ← Motor Threejs (Câmera, Render, WebGL, Luzes)
    └── speech/                  ← "As Cordas Vocais"
        └── tts.js               ← Lida com a temporização e envia payload TTS via IPC
```

---

## 🛠️ Guia de Customização

### Adicionando seu Próprio Modelo 3D

Por padrão, a versão do desenvolvedor gera um **Placeholder (um cubo muito fofinho, com olhos, orelhas, bochechas e que respira)** para preencher o vazio até seu modelo próprio chegar.

Para usar o seu modelo `GLTF/GLB`:

1. Obtenha um personagem em **GLB**. (Ótimas fontes: Mixamo, Sketchfab, ReadyPlayerMe).
2. Tenha certeza de nomear algumas de suas tracks de animações no Blender (ou outro editor) para parear com a inteligência do bot:
   - `idle` (padrão)
   - `reaction` (ação rápida ao clique - 1.5s)
   - *Suportes opcionais (idle_look, yawn, wave, thinking)*
3. Jogue seu modelo em `assets/models/` e o renomeie como `character.glb`. O projeto o detectará magicamente na próxima execução.

### Customizando Frases e TTS

Para fazer com que seu companheiro aja de forma única, edite o arquivo `src/behavior/phrases.js`. Lá você pode alterar facilmente todas as strings de diálogos que o PETSKOD puxa randomicamente dependendo da sua emoção:

```javascript
// Exemplo em src/behavior/phrases.js
export const PHRASES = {
  idle: ['Pensamentos a mil... 💭', 'O que vamos fazer agora ?'],
  // adicione novas a vontade...
}
```

---

## 🔌 Guia para Desenvolvedores (IPC API)

O front-end e o back-end (Janela Transparente ↔ Sistema Operacional) comunicam-se via eventos IPC encapsulados seguros no Preload. Estas chamadas estão expostas no Web Environment como: `window.petskodAPI`.

| Rotina exposta                  | Direção               | Objetivo |
|---------------------------------|-----------------------|-----------|
| `petskodAPI.moveWindow(x,y)`    | Render -> Main        | Movimenta janela XY pixel perfeito ao drag. |
| `petskodAPI.speak('Texto')`     | Render -> Main        | Desencadeia TTS PowerShell sem block loop Node. |
| `petskodAPI.notifyStateChange`  | Render -> Main        | Avisa o Node para alterar Emojis da Bandeja (Tray) |
| `petskodAPI.onForceState(cb)`   | Main -> Render        | Handler que recebe a força de mudança de state pelo Tray. |

Se quiser adicionar uma nova funcionalidade (Ex: Trocar de roupa do modelo), adicione uma função em `src/app/preload.js` conectando-se ao seu evento via `ipcRenderer`.

---

## 🔮 Roadmap (Próximas Fases)

- [x] **Fases 1, 2 e 3**: Core Setup, Three.js Rendering Borderless, State Machine básica, Dragging Nativo 2D e TTS Embebido.
- [x] **Fase 4**: Polimento Visual, Shader de Outline Glow e Raycasting Input aprimorado.
- [x] **Fase 5 (The Brain Update)**: Motor de Personalidade Completo. Memória de longo prazo, XP Levels, Interações Diárias limitadas, Decaimento, Reações Contextuais (Tempo, Feriados) e Feedback Visual (Corações).
- [ ] **Fase 6**: Integração com APIs externas de LLM/Agents (OpenAI / Anthropic / Local Meta Llama via Ollama) para reescrever as falas proceduralmente e manter conversas profundas. 
- [ ] **Fase 7**: Dashboard Local em HUD (React/Vue) para configurar perfis de TTS, voz, escolher modelos GLB visualmente sem lidar com arquivos crus no SO.
---

<br>
<div align="center">
  <i>Criado com foco no baixo consumo de CPU por IgorDev — 2026.</i>
</div>
