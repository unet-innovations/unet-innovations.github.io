# Unet Innovations — Website

A fast, fully static, bilingual (MN/EN) website with light/dark themes, responsive feature sections, and Chart.js visualizations.

- **Live (Org root site):** https://innovations.mn/
- **Tech:** HTML, CSS, JS (no build step)
- **Host:** GitHub Pages (static)

---

## Features

- **Bilingual:** Mongolian (default) & English via `assets/i18n.json`
- **Theme:** Light (default) & Dark with persistence
- **Charts:** Chart.js (loaded locally from `assets/js/chart.js`)
- **Responsive:** Feature splits collapse cleanly on phones
- **Deep links:** Cards jump to corresponding sections

---

## Project structure

```
/
├─ index.html
├─ features.html
├─ about.html
├─ products.html
├─ team.html
├─ 404.html
├─ .nojekyll
├─ assets/
│  ├─ css/
│  │  ├─ styles.css
│  │  ├─ feature.css
│  │  └─ mobile-safety.css
│  ├─ js/
│  │  ├─ script.js        # i18n + theme toggle + utilities
│  │  ├─ feature.js       # charts & feature-specific logic
│  │  └─ chart.js         # local Chart.js
│  ├─ data/
│  │  ├─ i18n.json
│  │  ├─ feature1.json
│  │  ├─ feature3.json
│  │  ├─ feature4.json
│  │  └─ feature5.json
│  ├─ icons/              # svg logos (excel.svg, powerpoint.svg, stata.svg)
│  └─ reports/            # images for previews (e.g., page2.jpg)
```