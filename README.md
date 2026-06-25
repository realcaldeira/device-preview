<div align="center">

# 📱 DeviceDeck

**Visualize qualquer site em resoluções reais de celulares, tablets e Smart TVs — com moldura de dispositivo realista.**

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![Chrome 116+](https://img.shields.io/badge/Chrome-116%2B-success)
![Edge](https://img.shields.io/badge/Edge-compatível-0078D7)
![Versão](https://img.shields.io/badge/versão-1.1.0-orange)
![Dispositivos](https://img.shields.io/badge/dispositivos-42-purple)

</div>

---

Extensão para **Chrome/Edge (Manifest V3)** que abre uma prévia fiel de qualquer página dentro de uma **moldura realista** — com notch, Dynamic Island, status bar, botões laterais, recortes de câmera e até chassi de TV com pedestal. Vai além do modo dispositivo do DevTools ao trocar o **User-Agent real** por aparelho e ainda **mede o desempenho (FPS)** do site embutido.

## ✨ Destaques

- 🖼️ **Moldura 100% CSS/SVG** — aço inox nos aparelhos Apple, alumínio fosco nos Android, recortes com lente de câmera, status bar por plataforma (iOS vs Android) com **hora e bateria reais** do computador.
- 🌐 **42 dispositivos** com specs reais (viewport, DPR físico e User-Agent) — telefones, tablets e TVs.
- 🔄 **Gira** entre retrato e paisagem (recortes e botões migram de borda, como nos aparelhos reais).
- 🪟 **Sites em iframe que normalmente bloqueiam** — remoção cirúrgica de `X-Frame-Options` / CSP apenas na aba da prévia.
- 📊 **Medidor de FPS** via `chrome.scripting` — FPS ao vivo, **1% low** (pior caso) e tempo de quadro do site embutido.
- ⭐ **Favoritos** e **memória de estado** (zoom, tela cheia, esticar, orientação, último site/aparelho).
- 📸 **Captura PNG** do mockup completo na resolução física do dispositivo.
- 🌗 Tema **claro/escuro** da interface.

## 📦 Instalação (modo desenvolvedor)

1. Abra `chrome://extensions` (ou `edge://extensions`).
2. Ative o **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e selecione a pasta `devicedeck/`.
4. Clique no ícone da extensão para abrir o **side panel** com os dispositivos.

> Requer **Chrome/Edge 116+** (uso de `side_panel`).

## 🚀 Como usar

Com qualquer site aberto, clique no ícone da extensão e escolha um dispositivo no painel lateral — a prévia abre na própria aba atual, já com a URL que estava aberta. Uma aba de prévia já existente é reaproveitada, trocando apenas o dispositivo.

Na tela de prévia você pode:

| Ação | O que faz |
|------|-----------|
| 🔗 **Trocar URL** | Barra de endereço (Enter ou "Ir"), com **recarregar** e **voltar**. |
| 📱 **Trocar dispositivo** | Seletor da barra superior ou o side panel (a aba é reaproveitada). |
| 🔄 **Girar** | Alterna entre retrato e paisagem. |
| ⛶ **Tela cheia** | Oculta a moldura e mantém só a tela do site, na resolução exata (proporção preservada). |
| ↔️ **Esticar** | Preenche 100% da janela em largura e altura (distorce a proporção). |
| 🔍 **Zoom** | − / + / Ajustar à janela. |
| 📊 **FPS** | Mede o desempenho do site embutido: FPS ao vivo, 1% low e tempo de quadro. |
| 📸 **Capturar** | PNG do mockup completo na resolução física do dispositivo. |
| 🌗 **Tema** | Alterna claro/escuro da interface. |
| 🚪 **Sair** | Fecha a prévia e volta ao site normal na mesma aba. |

- ⭐ **Favoritos**: clique na estrela ao lado de um dispositivo para fixá-lo no topo do painel. A lista persiste entre sessões.
- 💾 **Memória de estado**: a prévia retoma zoom, tela cheia, esticar e (ao reabrir o mesmo aparelho) a orientação usada por último. URL e dispositivo são lembrados quando a prévia é aberta sem parâmetros.

## 📱 Dispositivos suportados

| Categoria | Qtd. | Exemplos |
|-----------|:----:|----------|
| 🤖 Telefones Android | 18 | Galaxy S20 / S21 Ultra / S22, Pixel, OnePlus… |
| 🍎 Telefones Apple | 14 | iPhone 5, SE, X, XR, e modelos com notch / Dynamic Island |
| 📒 Tablets | 6 | iPad Mini, iPad Air, iPad Pro 11", iPad Pro 12.9"… |
| 📺 Smart TVs | 4 | HD 720p, Full HD, 4K UHD, 8K |
| **Total** | **42** | |

Cada dispositivo carrega `viewport`, `dpr` (resolução física), tipo de moldura e `User-Agent` reais — definidos em [`data/devices.json`](data/devices.json).

## 📊 Medidor de FPS

O botão **FPS** injeta, via `chrome.scripting` (no *world* MAIN), uma sonda **dentro do frame do site** (a interface da prévia não é afetada) que mede o tempo de cada quadro via `requestAnimationFrame`. O painel mostra, em tempo real:

- **FPS ao vivo** — média dos quadros dos últimos ~0,5 s;
- **1% low** — média dos ~1% piores quadros dos últimos ~3 s, que revela travadas que a média esconde;
- **tempo de quadro** em milissegundos.

A cor muda por faixa (verde ≥ 50, amarelo ≥ 30, vermelho < 30). É uma medida do desempenho da *main thread* do site (jank de JavaScript/layout) — ótima para comparar páginas e detectar travadas. Não é o FPS do compositor/GPU, e o teto é o refresh do seu monitor.

> ℹ️ A sonda é re-injetada automaticamente a cada navegação/recarga do site. Desligue no mesmo botão para parar a medição. Não há aviso de depuração do Chrome — a medição usa `chrome.scripting`, não o protocolo de depuração.

## ⚙️ Como funciona

- **User-Agent real por dispositivo**: ao selecionar um aparelho, o service worker cria regras de sessão do `chrome.declarativeNetRequest` restritas à aba da prévia (`condition.tabIds`), substituindo o cabeçalho `User-Agent` (e os client hints `sec-ch-ua-*`) em todas as requisições do iframe.
- **Sites dentro de iframe**: a mesma técnica remove os cabeçalhos `X-Frame-Options` e `Content-Security-Policy` apenas nas respostas de `sub_frame` daquela aba, permitindo carregar sites que normalmente bloqueiam iframes.
- **Moldura**: aro metálico em gradiente, recortes com lente de câmera e brilho azulado (notch, Dynamic Island, furo central/lateral, gota), status bar específica por plataforma com hora e bateria reais, indicador de gesto, botões físicos posicionados conforme cada marca (mute do iPhone, alert slider do OnePlus, power acima do volume no Pixel) e chassi de TV com chin, logo, LED de standby e pedestal. Em paisagem, recortes e botões migram de borda.
- **Limpeza**: as regras de rede são removidas quando a aba da prévia é fechada ou navega para fora da extensão.

## 🗂️ Estrutura do projeto

```
devicedeck/
├── manifest.json               # Manifest V3
├── background/
│   └── service-worker.js       # Regras de rede (UA + iframe), abertura da prévia, captura
├── sidepanel/
│   └── sidepanel.html/.css/.js # Painel lateral com os dispositivos por categoria
├── preview/
│   └── preview.html/.css/.js   # Mockup com moldura, status bar e controles
├── data/
│   └── devices.json            # 42 dispositivos com specs reais (viewport, DPR, UA)
├── shared/
│   └── icons.js                # Silhuetas SVG por tipo de moldura
├── icons/                      # Ícones PNG da extensão
└── tools/
    └── make_icons.py           # Gerador dos ícones (somente stdlib)
```

## ⚠️ Limitações conhecidas

- O User-Agent é sobrescrito **na camada de rede** (cabeçalho HTTP); o `navigator.userAgent` via JavaScript continua o do desktop, e o conteúdo renderiza com o DPR do seu monitor.
- O motor de renderização é sempre o **Blink** do seu Chrome: detalhes específicos de Safari/WebKit (iOS) e de navegadores de TV não são reproduzidos por nenhuma ferramenta desktop.
- Sites com *frame-busting* via JavaScript (`if (top !== self) ...`) ainda podem se recusar a renderizar.
- Logins que dependem de cookies `SameSite=Lax/Strict` podem falhar dentro do iframe.
- A captura usa `chrome.tabs.captureVisibleTab`: o zoom é ajustado automaticamente para caber o mockup inteiro na janela antes do clique.

## 🎨 Regenerar ícones

```bash
python3 tools/make_icons.py
for s in 16 32 48; do sips -z $s $s icons/icon128.png --out icons/icon$s.png; done
```

## 👤 Autor

Desenvolvido por **Lucas Caldeira**.
