---
title: Welcome to Pages
description: A sample Markdown page demonstrating the static content system
---

# Welcome to Pages

This is a sample page written in **Markdown**. It lives at
`client/public/page-content/welcome.md` and is served at `/pages/welcome` — no
Angular code required.

## What you can use

All standard Markdown works:

- Lists, **bold**, *italics*, and `inline code`
- [Links to other pages](/pages/index), which stay inside the app
- [External links](https://en.wikipedia.org/wiki/Almanac), which open normally

> Blockquotes work too — useful for quoting primary sources.

### Tables

| Year | Almanac | Notes |
|------|---------|-------|
| 1833 | The Catholic Almanac | First edition |
| 1860 | Metropolitan Catholic Almanac | Renamed |

### Images

Place image files in the same `page-content/` folder (or a subfolder) and reference
them with an absolute path:

```markdown
![John Bapst](/John_Bapst_standing_cropped.jpg)
```

## Linking into the database

Because these pages render inside the app, you can link straight into the
database views, for example [browse institutions](/institutions) or
[the diocese map](/dioceses/map).
