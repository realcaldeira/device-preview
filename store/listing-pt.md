# Chrome Web Store — texto em português

Use estes campos no [Developer Dashboard](https://chrome.google.com/webstore/devconsole).
Nome e resumo curto precisam bater com `_locales/pt_BR/messages.json`.

## Nome (máx. 75) — 56 caracteres

```
Simulador Mobile: Teste Responsivo em 50 Aparelhos Reais
```

## Resumo curto (máx. 132) — 124 caracteres

```
Teste qualquer site em 50 celulares, tablets, notebooks e TVs reais — User-Agent, toque, teclado virtual, FPS e captura PNG.
```

## Descrição detalhada

Só as duas primeiras linhas aparecem antes do "Ler mais" — são elas que carregam
os termos de busca e o gancho.

```
Teste responsivo de verdade, além do DevTools: 50 aparelhos reais,
User-Agent real e toque real, dentro de uma moldura fotorrealista.

O Simulador Mobile abre qualquer site numa prévia com notch, Dynamic
Island, punch-hole, moldura de notebook ou chassi de TV, envia o
User-Agent real do aparelho, rola por gesto com inércia, sobe um teclado
virtual que digita de verdade e mede FPS (ao vivo + 1% low).

PARA QUEM É
• Devs e QAs que validam layout mobile/tablet/TV
• Designers que precisam de mockups realistas
• Quem compara desempenho do site em viewports reais

DESTAQUES
• 50 dispositivos com viewport, DPR e User-Agent reais
• Molduras 9-slice (iPhone, Android, iPad, MacBook, Smart TV)
• Toque real em celular/tablet (pointer: coarse, inércia)
• Teclado virtual iOS/Android (inclui numérico e símbolos)
• Barra do Chrome/Safari dentro do mockup
• Captura PNG na resolução física do aparelho
• Favoritos, presets de workflow e histórico recente
• Zero coleta de dados — tudo roda local no seu Chrome

COMO USAR
1. Abra o site que quer testar
2. Clique no ícone da extensão (ou Alt+Shift+P para reabrir o último)
3. Escolha um dispositivo no painel lateral
4. Gire, capture, meça FPS ou troque o aparelho sem sair da aba

POR QUE PEDIMOS ACESSO AOS SITES
A extensão troca o User-Agent e remove X-Frame-Options/CSP só na aba da
prévia, para embutir o site no mockup. Nenhuma outra aba é afetada. Não
enviamos URLs nem conteúdo a servidores.

Grátis, sem conta e sem telemetria. Código e política de privacidade:
https://realcaldeira.github.io/device-preview
```

## Categoria

Developer Tools

## Idioma principal

Português (Brasil) — publique também os locales English, Español, Français e Deutsch
com os arquivos correspondentes nesta pasta.

## O que saiu do texto antigo

- A linha `Keywords: …` — lista de palavras-chave sem contexto é exatamente o padrão de
  metadado irrelevante que a política de listing pune. Os mesmos termos aparecem no corpo.
- O pedido de `★★★★★` — pedir avaliação é permitido, pedir cinco estrelas especificamente
  flerta com manipulação de nota. O prompt dentro da extensão faz isso melhor.
