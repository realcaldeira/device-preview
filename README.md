# Device Preview

Extensão Chrome/Edge (Manifest V3) para visualizar qualquer site em resoluções reais de celulares, tablets e Smart TVs — com moldura realista (notch, Dynamic Island, status bar, botões laterais e suporte de TV).

Desenvolvido por **Lucas Caldeira**.

## Instalação (modo desenvolvedor)

1. Abra `chrome://extensions` (ou `edge://extensions`).
2. Ative o **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e selecione a pasta `device-preview/`.
4. Clique no ícone da extensão para abrir o **side panel** com os dispositivos.

## Como usar

- Com qualquer site aberto, clique no ícone da extensão e escolha um dispositivo no painel lateral — a prévia abre em uma nova guia, já com a URL da aba atual.
- **Favoritos**: clique na estrela ao lado de qualquer dispositivo para fixá-lo na seção **Favoritos**, no topo do painel. A lista é salva e persiste entre sessões.
- **Lembrar o último estado**: a prévia retoma automaticamente o **zoom**, os modos **tela cheia** e **esticar** e, ao reabrir o mesmo aparelho, a **orientação** usada por último. URL e dispositivo são lembrados quando a página de prévia é aberta sem parâmetros.
- Na prévia você pode:
  - **Trocar a URL** na barra de endereço (Enter ou botão "Ir"), **recarregar** e **voltar**;
  - **Trocar o dispositivo** pelo seletor da barra superior (ou pelo side panel — a aba de prévia é reaproveitada);
  - **Girar** entre retrato e paisagem;
  - Ativar a **Tela cheia** (botão de expandir na barra): oculta a moldura, a status bar, os recortes e os botões, mantendo só a tela do site na resolução exata do dispositivo (proporção preservada), com os controles compactados e a área de visualização maximizada;
  - Ativar o **Esticar** (botão de setas na barra): preenche 100% da janela em largura e altura, distorcendo a proporção. Ativa a tela cheia automaticamente; o zoom manual desfaz o esticar. A **captura** continua saindo na proporção e resolução corretas do dispositivo;
  - Controlar o **zoom** (− / + / Ajustar à janela);
  - Alternar **tema claro/escuro** da interface;
  - Ativar a **Emulação profunda** (botão próprio na barra): aplica User-Agent via JavaScript, `devicePixelRatio` e emulação de toque reais no site;
  - **Capturar** uma imagem PNG do mockup completo (moldura + site) na resolução física do dispositivo.

## Estrutura

```
device-preview/
├── manifest.json               # Manifest V3
├── background/
│   └── service-worker.js       # Regras de rede (UA + iframe), abertura da prévia, captura
├── sidepanel/
│   ├── sidepanel.html/.css/.js # Painel lateral com os dispositivos por categoria
├── preview/
│   ├── preview.html/.css/.js   # Mockup com moldura, status bar, controles
├── data/
│   └── devices.json            # 42 dispositivos com specs reais (viewport, DPR, UA)
├── shared/
│   └── icons.js                # Silhuetas SVG por tipo de moldura
├── icons/                      # Ícones PNG da extensão
└── tools/
    └── make_icons.py           # Gerador dos ícones (somente stdlib)
```

## Como funciona

- **User-Agent real por dispositivo**: ao selecionar um dispositivo, o service worker cria regras de sessão do `chrome.declarativeNetRequest` restritas à aba da prévia (`condition.tabIds`), substituindo o cabeçalho `User-Agent` (e os client hints `sec-ch-ua-*`) em todas as requisições do iframe.
- **Sites dentro de iframe**: a mesma técnica remove os cabeçalhos `X-Frame-Options` e `Content-Security-Policy` apenas nas respostas de `sub_frame` daquela aba, permitindo carregar sites que normalmente bloqueiam iframes.
- **Moldura**: 100% CSS/SVG — aro metálico em gradiente (aço inox polido nos aparelhos Apple, alumínio fosco nos Android), recortes com lente de câmera e brilho azulado (notch com alto-falante, Dynamic Island, furo central/lateral, gota), status bar específica por plataforma (iOS vs Android) com hora real e **nível de bateria real do computador**, indicador de gesto (home indicator), botões físicos posicionados conforme cada marca (mute do iPhone, alert slider do OnePlus, power acima do volume no Pixel), botão home com squircle (iPhones clássicos), e chassi de TV com chin, logo, LED de standby e pedestal. Sombra de chão sob o aparelho e reflexo de vidro sutil na tela. Em paisagem, recortes e botões migram de borda, como nos aparelhos reais.
- **Limpeza**: as regras de rede são removidas quando a aba da prévia é fechada ou navega para fora da extensão.

## Emulação profunda

O botão **Emulação profunda** na barra da prévia anexa o protocolo de depuração do Chrome (`chrome.debugger`) **diretamente ao processo do iframe** (a interface da prévia não é afetada) e aplica:

- `navigator.userAgent` e `navigator.userAgentData` do dispositivo (JavaScript, não só rede);
- `devicePixelRatio` real do aparelho — imagens `srcset` passam a ser escolhidas corretamente;
- **Emulação de toque**: cliques viram eventos touch, e `@media (pointer: coarse)` / `(hover: none)` respondem como num celular.

Com isso, dispositivos **Android atingem a mesma fidelidade do modo dispositivo do DevTools** (o Chrome do Android usa o mesmo motor Blink). Para iOS e TVs a fidelidade aumenta, mas o motor continua sendo o Blink do desktop — bugs específicos de Safari/WebKit não aparecem.

Custos do modo: o Chrome exibe o aviso *"Device Preview começou a depurar este navegador"* enquanto ativo (não há como ocultar), e a re-anexação é refeita automaticamente a cada navegação entre sites diferentes. Desligue no mesmo botão para voltar ao modo leve.

## Limitações conhecidas

- **Sem** Emulação profunda: o User-Agent é sobrescrito só **na camada de rede** (`navigator.userAgent` via JS continua o do desktop) e o conteúdo renderiza com o DPR do seu monitor. Ative a Emulação profunda para corrigir os dois.
- O motor de renderização é sempre o Blink do seu Chrome: detalhes específicos de Safari/WebKit (iOS) e dos navegadores de TV não são reproduzidos por nenhuma ferramenta desktop.
- Sites com *frame-busting* via JavaScript (`if (top !== self) ...`) ainda podem se recusar a renderizar.
- Logins que dependem de cookies `SameSite=Lax/Strict` podem falhar dentro do iframe.
- A captura usa `chrome.tabs.captureVisibleTab`: o zoom é ajustado automaticamente para caber o mockup inteiro na janela antes do clique.

## Regenerar ícones

```bash
python3 tools/make_icons.py
for s in 16 32 48; do sips -z $s $s icons/icon128.png --out icons/icon$s.png; done
```
