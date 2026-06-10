# Contributing content pages

Any `.md` or `.html` file dropped into this folder becomes a page on the
site — no Angular knowledge needed.

## How it works

| You add | The site serves it at |
|---|---|
| `my-essay.md` | `/pages/my-essay` |
| `history/jesuits.md` | `/pages/history/jesuits` |
| `custom-layout.html` | `/pages/custom-layout` |

File and folder names may contain letters, numbers, hyphens, and
underscores (no spaces). If both a `.md` and `.html` file share a name, the
`.md` file wins.

During development (`ng serve`) new files are available immediately on save.
In production they ship with the next build.

## Front matter (optional)

Start a file with a metadata block to set the browser tab title:

```
---
title: My Essay Title
description: One-line summary
---
```

Without it, the page's first heading is used as the title.

## Writing tips

- **Markdown** files get typographic styling automatically (headings, lists,
  tables, blockquotes).
- **HTML** files are for custom layouts; you may use Tailwind utility
  classes. Write only the body fragment — no `<html>` or `<head>` tags.
- Links to other parts of the site (e.g. `/people`, `/pages/welcome`)
  navigate in-app without a reload. External links work normally.
- Images: put them in this folder and reference them as `/page-content/your-image.jpg`.
- `<script>` tags are **not** executed.
- After adding a page, link it from `index.md` so people can find it.

## Note for the curious

This `README.md` is itself reachable at `/pages/README` — that's harmless,
but keep that in mind when editing it.
