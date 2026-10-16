# sendtogrokbot.com

The pages live in `docs/`. `scripts/build-site.sh` copies them to `dist/site`, adds the shared files from the extension, and checks that `/connect` still has what the extension needs. `site/wrangler.toml` serves `dist/site` as Cloudflare Workers static assets.

```bash
bash scripts/build-site.sh
npx wrangler deploy --config site/wrangler.toml
```

| Path | File |
| --- | --- |
| `/` | `docs/index.html` |
| `/setup` | `docs/setup/index.html` |
| `/setup/grok`, `/setup/claude`, `/setup/chatgpt`, `/setup/codex` | `docs/setup/*.html` |
| `/mobile` | `docs/mobile.html` |
| `/history` | `docs/history.html` |
| `/connect` | `docs/connect.html` |
| `/privacy` | `docs/privacy.html`, the part of `store/privacy-policy.md` above the `---` line |

Pretty URLs come from `docs/_redirects`. Security and cache headers come from `docs/_headers`.

## Look and feel

All styles are in `docs/assets/site.css`: system fonts, X colors, light and dark mode through `prefers-color-scheme`. Every page shares the same header and footer markup, so a nav change touches every page. `docs/assets/site.js` sets the Add to Chrome link and runs the Copy buttons.

The build makes `assets/logos.svg` from `extension/logos.js`, so the site and the extension menu show the same marks. Claude is #D97757. Grok Bot is a white mark on black, ChatGPT is white on #10A37F, and Codex is black on white. `/logo.svg` and `/logo.png` stay at the site root because the marketplace plugin links to them.

## /connect must keep working

`extension/site-connect.js` runs only on `https://sendtogrokbot.com/connect*` (and `www.`). It listens for a click on `#connect`, reads `#paste`, writes to `#msg`, and sets `data-stgb-ready` on `<html>`. Keep those ids, keep the page at `/connect`, and keep the inline script that fills `#paste` from a `#stgb1.` or `#stgbr1.` hash. The build fails if one of the ids is missing.

## Placeholders to fill

- Add to Chrome link: `CHROME_STORE_URL` in `docs/assets/site.js`. Until it is set, it points at the GitHub README.
- Demo video: the box on the home page says where to put `demo.mp4`.
- iOS Shortcut link: the `install-link` paragraph in `docs/mobile.html` (see `shortcuts/BUILD.md`).
- Support email: `support@sendtogrokbot.com` in `docs/privacy.html`. Confirm the mailbox exists.
- Screenshot slots: each dashed box names the file to add under `docs/img/`. Blur names, emails, tokens, URLs, and anything else private.
