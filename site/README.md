# sendtogrokbot.com

Static HTML, CSS, and a little JavaScript. No framework and no build step for the pages themselves. `public/` is exactly what is served.

| Path | File |
| --- | --- |
| `/` | `public/index.html` |
| `/setup` | `public/setup.html` |
| `/setup/grok`, `/setup/claude`, `/setup/chatgpt`, `/setup/codex` | `public/setup/*.html` |
| `/mobile` | `public/mobile.html` |
| `/connect` | `public/connect.html` |
| `/privacy` | `public/privacy.html` (the top section of `store/privacy-policy.md`) |

## Shared files

`public/assets/connect.js`, `prompts.js`, `logos.svg`, the icons, `img/`, and `promo/` are copied from the extension and `docs/img`. After changing any of those, run:

```bash
sh site/build.sh
```

`sh site/build.sh --check` fails if the copies are stale.

## /connect must keep working

The extension's content script `extension/site-connect.js` runs only on `https://sendtogrokbot.com/connect*` (and `www.`). It listens for a click on `#connect`, reads `#paste`, writes to `#msg`, and sets `data-stgb-ready` on `<html>`. Keep those ids, keep the page at `/connect`, and keep the inline script that fills `#paste` from a `#stgb1.` or `#stgbr1.` hash.

## Placeholders to fill

- Add to Chrome link: `CHROME_STORE_URL` in `public/assets/site.js` (one line). Until then it points at the GitHub README.
- Demo video: the box on the home page says where to put `demo.mp4`.
- iOS Shortcut link: `#install` in `public/mobile.html`.
- Support email: `support@sendtogrokbot.com` in `public/privacy.html`. Confirm the mailbox exists.
- Screenshot slots: each dashed box names the file to add under `public/assets/img/`. Blur names, emails, tokens, URLs, and anything else private before adding one.

## Deploy

Cloudflare Workers static assets, on the account that already holds sendtogrokbot.com:

```bash
cd site && npx wrangler deploy
```

`wrangler.jsonc` attaches `sendtogrokbot.com` and `www.sendtogrokbot.com` as custom domains. If either is already attached to another Worker or a Pages project, detach it there first.

Cloudflare Pages works too: project root `site/public`, no build command. `_headers` applies on both.
