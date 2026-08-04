# Molduras por imagem

Todos os aparelhos usam moldura fotorrealista renderizada em imagem — aro de
metal com varrido cônico, bisel polido, vidro negro da borda, linhas de antena
e, na TV, o queixo com marca e LED de standby. A arte entra como `border-image`
de 9 fatias: os quatro cantos ficam intactos e só as faixas do meio esticam,
então a mesma imagem serve para qualquer viewport sem deformar o aparelho.

## Como é gerada

```bash
python3 tools/make_frames.py          # gera tudo (demora alguns minutos)
python3 tools/make_frames.py island   # gera só um arquétipo
```

O gerador é 100% procedural (Python stdlib + Pillow) e produz um `.webp` por
arquétipo — mais uma variante `.rot.webp` para os que giram (a luz continua
vindo de cima após a rotação, como num aparelho de verdade). A geometria vem de
`shared/frames.js` (`DP_FRAME_PRESETS`, `DP_FRAME_IMAGES`, `DP_FRAME_VIEWPORTS`)
e deve espelhar `ARCHETYPES` em `tools/make_frames.py`: **mudou os pads, rode
o gerador de novo**.

O 9-slice é fatiado (e desenhado) em `max(pad, raio)` por lado, não na
espessura da moldura: a fatia de canto precisa conter o arco inteiro da
silhueta. Fatiada mais fina que o raio, o resto da curva cai nas faixas do meio
— que esticam — e o canto se abre, com a moldura aparecendo descolada, para
fora do aparelho. O `slice` (px da imagem) sai dessa espessura × `scale`, a
razão px da imagem por px CSS definida em `DP_FRAME_IMAGES`; assim a fatia é
desenhada na escala natural. O excedente sobre a tela é o vazado transparente
da arte, e o chassi leva um fundo preto por baixo para preencher a unha entre o
vazado (canto squircle) e o recorte do iframe (canto elíptico).

| Arquivo | Usado por | Metal |
| --- | --- | --- |
| `notch.webp` | iPhone X–14 | aço inox polido |
| `island.webp` | iPhone 15/16 (Dynamic Island) | titânio natural |
| `punch.webp` | Galaxy, Xiaomi, OnePlus (furo central) | alumínio preto |
| `punch-left.webp` | Pixel e cia (furo à esquerda) | alumínio prata fosco |
| `drop.webp` | aparelhos com notch gota | preto brilhante |
| `home.webp` | iPhone 5/SE (botão home) | alumínio slate |
| `tablet.webp` | iPads, Galaxy Tab, Surface | cinza-espacial |
| `laptop.webp` | notebooks Windows/Chromebook | alumínio escuro |
| `laptop-macbook.webp` | MacBooks | alumínio claro |
| `tv.webp` | Smart TVs (queixo + LED embutidos) | metal preto |

Botões laterais, recortes de câmera, alto-falante e botão home continuam em
CSS por cima da imagem (posicionados conforme a marca), porque ficam no meio
das bordas — onde o 9-slice estica — e na área da tela.

## Arte própria por aparelho

Um aparelho pode trocar a moldura do arquétipo por uma arte própria
acrescentando `frameImage` ao seu item em `data/devices.json`:

```json
{
  "id": "galaxy-s24",
  "frameImage": {
    "src": "frames/galaxy-s24.png",
    "slice": [80, 60, 80, 60],
    "inset": [11, 11, 13, 11]
  }
}
```

- **`src`** — caminho a partir da raiz da extensão.
- **`slice`** — as quatro fatias do 9-slice, **em pixels da imagem original**,
  na ordem `topo, direita, baixo, esquerda`. Cada fatia precisa conter o canto
  inteiro do aparelho — inclusive todo o arco do arredondamento.
- **`inset`** — a espessura da moldura **como ela aparece na tela**, em pixels
  CSS, na mesma ordem. Se omitido, valem as medidas do preset de moldura.
- **`width`** — em quantos pixels CSS cada fatia é desenhada, na mesma ordem.
  Se omitido, vale o `inset`; declare-o (com `slice ÷ densidade da arte`)
  sempre que a fatia for maior que a moldura, que é o caso quando o canto é
  arredondado.
- **`corner`** — `"round"` (padrão) ou `"squircle"`, conforme o canto desenhado
  na arte. É a forma com que o CSS recorta o vidro sob a moldura e a sombra do
  aparelho; declarar `squircle` numa arte de canto circular (ou o contrário)
  deixa chassi sobrando para fora do metal, e o aparelho lê como um bloco
  quadrado.

A arte personalizada é usada como está nas duas orientações; o giro automático
com variante `.rot` vale só para as molduras geradas.

### Requisitos da arte

- **PNG/WebP/SVG com fundo transparente** e o miolo da tela **vazado** — é por
  ali que o site aparece.
- Vista frontal, sem perspectiva; a moldura precisa ser retangular para o
  9-slice funcionar.
- Botões e recortes que ficarem no meio das bordas vão esticar junto com elas.
  Se isso incomodar, aumente a fatia correspondente para incluí-los no canto.

## Licença das imagens

Renders e fotos oficiais de fabricantes (Apple, Samsung, Google) são material
protegido: não podem ser redistribuídos neste repositório, que é público, nem
publicados junto com a extensão na Chrome Web Store. Por isso as molduras da
extensão são **geradas proceduralmente** — arte própria, livre para
redistribuir. Se um dia você adicionar arte de terceiros, use apenas o que
produziu ou cuja licença permita redistribuição comercial, e registre aqui a
origem e a licença.

| Arquivo | Origem | Licença |
| --- | --- | --- |
| `*.webp` | gerados por `tools/make_frames.py` | mesma do repositório |
| `exemplo-9slice.svg` | feito para este projeto | mesma do repositório |
