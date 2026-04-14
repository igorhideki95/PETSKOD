# Guia de Modelos 3D (PETSKOD)

O PETSKOD suporta modelos nos formatos **.GLB / .GLTF** e **.FBX** (incluindo Mixamo).

## Como adicionar seu personagem

1. Vá até a pasta `assets/models/`.
2. Coloque seu arquivo lá com um dos seguintes nomes:
   - `character.glb`
   - `character.fbx`
3. O app tentará carregar primeiro o `character.glb`. Se não encontrar, tentará o `character.fbx`.

## Animações Extras (Mixamo Pro)

Agora você pode adicionar quantas animações quiser sem precisar editar o código!

1. Na pasta `assets/models/`, crie uma subpasta chamada `animations/`.
2. Baixe animações no Mixamo usando a opção **"Without Skin"** (Sem Pele).
3. Renomeie o arquivo para o nome da ação que você quer (ex: `happy.fbx`, `dance.fbx`, `jump.fbx`).
4. Coloque esses arquivos dentro de `assets/models/animations/`.

### Como o PETSKOD carrega:
- Ele primeiro carrega o corpo (`character.fbx`).
- Depois, ele vasculha a pasta `animations/` e "ensina" todas aquelas animações ao personagem automaticamente.
- Se o arquivo se chamar `happy.fbx`, o sistema entenderá que aquela é a animação para o estado "Feliz".

### Problemas comuns
- **Escala:** O PETSKOD ajusta a escala automaticamente para caber na janela, mas modelos muito grandes (comuns no Mixamo) podem levar mais tempo para carregar.
- **Texturas:** Certifique-se de que as texturas estão embutidas (Embedded) no arquivo FBX ou na mesma pasta.
