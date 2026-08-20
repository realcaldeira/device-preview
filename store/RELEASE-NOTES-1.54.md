# Notas de versão — 1.54

## Português

```
• Novo: o pedido de avaliação também aparece para quem usa a prévia com
  frequência — antes só surgia depois de exportar um PNG, e a maioria dos
  usuários nunca exporta
• Melhoria: nome e resumo da extensão agora começam pelo que as pessoas
  buscam na loja ("teste responsivo"), nos cinco idiomas
• Correção: o botão "Avaliar" usa a URL da loja por ID, então renomear a
  extensão não quebra mais o link
```

## English

```
• New: the review prompt now also reaches people who use the preview
  regularly — it used to appear only after exporting a PNG, and most users
  never export one
• Improved: the extension name and summary now lead with what people
  actually search for ("responsive testing"), in all five languages
• Fix: the "Rate" button uses the store URL by ID, so renaming the
  extension no longer breaks the link
```

## Checklist de publicação

- [ ] Colar nome, resumo e descrição de `listing-en.md` e `listing-pt.md` no dashboard
- [ ] Adicionar os locales Español, Français e Deutsch (`listing-es/fr/de.md`)
- [ ] Subir 5 screenshots 1280×800 (shot list em `screenshots-and-video.md`)
- [ ] Colar o "What's new" acima em PT e EN
- [ ] Pacote ZIP sem `tools/`, `.git`, `store/`, `docs/` e zips antigos
