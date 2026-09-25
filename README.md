# Erin Lee — Portfolio

Personal portfolio of Erin Lee, Senior Product Designer.

Plain HTML + CSS, no build step. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Pages

- `index.html` — homepage (hero with animated gradient, selected work, about, contact)
- `natural-language-filter.html`, `ai-assisted-intake-form.html`, `ai-applied-outreach.html` — case studies

## Editing

- Colors, fonts, spacing and corner radius are CSS variables at the top of `assets/css/styles.css`
  (`--radius` = homepage screenshots, `--radius-cs` = case study media).
- Hero gradient: `<shader-gradient speed="1" intensity="0.8">` in `index.html`. Optional `colors="#hex,#hex,#hex,#hex"`.
- Case study scroll reveal lives in `assets/js/reveal.js` and turns itself off for visitors with reduced motion enabled.

## Publishing on GitHub Pages

Repo → Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)`.
