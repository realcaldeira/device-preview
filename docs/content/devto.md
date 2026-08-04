# Dev.to / Hashnode — rascunho de artigo

## Título

```
Why Chrome DevTools Device Mode Isn’t Enough for Mobile QA
```

## Tags

`webdev`, `chrome`, `css`, `testing`, `javascript`

## Intro

```
Chrome’s device toolbar is the default for responsive checks. It resizes the viewport and can emulate a user agent string — but the page still feels like a desktop browser: mouse cursor, fine pointer media queries in stylesheets, no hardware chrome, no easy physical-resolution screenshot for stakeholders.

If you ship UI to phones, tablets, and living-room TVs, those gaps show up in bug reports.
```

## Seções sugeridas

1. **What DevTools does well** — viewport, DPR toggle, network throttling.
2. **What it doesn’t** — photorealistic frame, true touch gestures, in-device browser chrome, FPS of the embedded page, one-click mockup PNG.
3. **What Simulador Mobile adds** — link with UTM:
   `https://chromewebstore.google.com/detail/ebnbfkejdddkbpkljbbcnchnlekombef?utm_source=devto&utm_medium=article&utm_campaign=growth`
4. **How UA switching works (high level)** — session DNR rules scoped to the preview tab; CSP/XFO stripped only for `sub_frame` on that tab.
5. **Privacy** — no analytics; local storage only.
6. **Limitations** — honest list from the FAQ (frame-busting JS, SameSite cookies, CSS hover/pointer in stylesheets).

## CTA final

```
Install: https://chromewebstore.google.com/detail/ebnbfkejdddkbpkljbbcnchnlekombef?utm_source=devto&utm_medium=article&utm_campaign=growth
Landing: https://realcaldeira.github.io/device-preview/?utm_source=devto&utm_medium=article&utm_campaign=growth
GitHub: https://github.com/realcaldeira/device-preview
```

Inclua um GIF do teclado virtual ou da Island no topo do post.
