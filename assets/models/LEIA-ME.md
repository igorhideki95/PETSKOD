# PETSKOD — Como usar modelos 3D personalizados

## Onde colocar seu modelo

Coloque seu arquivo `.glb` ou `.gltf` em:
```
assets/models/character.glb
```

O sistema carrega automaticamente este arquivo ao iniciar.

## Requisitos do modelo

- Formato: **GLB** (recomendado) ou GLTF
- Animações embutidas no arquivo
- Nomes de animações recomendados:
  - `idle` — animação principal em loop
  - `reaction` — animação curta de reação ao clique
  - `idle_look` — variação de idle (olhar ao redor)
  - `yawn` — bocejo
  - `wave` — aceno
  - `thinking` — pensando

## Fontes de modelos gratuitos

- [Mixamo](https://www.mixamo.com) — personagens humanoides com animações
- [Sketchfab](https://sketchfab.com) — filtrar por "free" + "animated"
- [Ready Player Me](https://readyplayer.me) — avatares personalizados

## Como adicionar novas animações

1. Abra o modelo no [Blender](https://blender.org)
2. Adicione a animação com o nome desejado na timeline de Actions
3. Exporte como GLB (File → Export → glTF 2.0)
4. Substitua o arquivo em `assets/models/character.glb`
5. No código, chame `character.playAnimation('nome_da_anim', loop)` quando quiser tocá-la

## Como trocar o modelo padrão

Edite `src/app/renderer.js`, linha 13:
```js
const MODEL_PATH = './assets/models/SEU_MODELO.glb';
```
