# Deploy the relay

The relay is live at https://relay.sendtogrokbot.com. `wrangler.toml` already points at that custom domain, the D1 database, and the KV namespace on the Cloudflare account that holds sendtogrokbot.com. You do not need a new account or a new domain.

The worker does four things:

- The setup page at `/` creates a relay key and a one-paste connect code. You paste that code into the extension and into the iPhone shortcut.
- `PUT /v1/config` stores a Grok Bot webhook and a Claude routine. The webhook key and the Claude token are encrypted with AES-GCM before they are saved. They are not written to the logs.
- `POST /v1/send` checks the code, then forwards the post. The `Authorization` header can be `Bearer` plus the raw relay key, or `Bearer` plus the whole `stgbr1.` code. Grok Bot gets the post as JSON with `Authorization: Bearer` and `X-Sender-Key` when a key is saved. Claude gets `POST` to the routine fire URL with `anthropic-version: 2023-06-01` and `{"text":"..."}`. ChatGPT and Codex are not forwarded. The response is `200` with `openUrl`, a `https://chatgpt.com` link that already contains a short note and the post URL. The phone opens that link. The person still presses Send in the app.
- `GET /v1/history` returns the last 50 sends for that code. The site at `https://sendtogrokbot.com/history` calls it. Browsers on `https://sendtogrokbot.com` and `https://www.sendtogrokbot.com` are allowed. Other websites are not.

D1 holds the account and the last 50 sends (time, destination, link, author, and whether it worked — not the post text). KV counts requests so one key cannot run away. Limits are 60 sends an hour, 30 saves an hour, 240 reads an hour, 20 new codes an hour from the same network, and 300 API calls an hour from the same network.

This relay does not send email.

## 1. Install the tools

From the `relay` folder:

```bash
cd relay
npm install
```

You need Node 20 or newer. Wrangler is installed locally by that command. You do not need a global install.

## 2. Log in

```bash
npx wrangler login
```

A browser opens. Sign in to the Cloudflare account that already has sendtogrokbot.com. Leave the window open until it says you are logged in.

## 3. Database and KV

These already exist and are named in `wrangler.toml`. D1 database `stgb-relay` is `933c0063-2236-480e-a9e5-b73ec76466dc`. The KV namespace id is `5c50f8ce458846739e5a1b9470ee4098`. Leave those values as they are.

If the tables were never created on that database, run:

```bash
npx wrangler d1 execute stgb-relay --remote --file=schema.sql
```

The worker also creates the tables if they are missing.

## 4. Set the encryption secret

This key encrypts webhook keys and Claude tokens at rest. Generate it on your machine:

```bash
openssl rand -base64 32
```

Then:

```bash
npx wrangler secret put ENCRYPTION_KEY
```

Paste the `openssl` output when asked. Do not put it in `wrangler.toml`, do not commit it, and do not paste it into chat. `.dev.vars` is for local preview only and is gitignored.

If you later change `ENCRYPTION_KEY`, every saved webhook key and Claude token becomes unreadable. People set those fields again on the setup page. Old connect codes still identify the account. Only the secrets are lost.

## 5. Deploy again

```bash
npx wrangler deploy
```

The route in `wrangler.toml` is `relay.sendtogrokbot.com`. After a deploy, the setup page is https://relay.sendtogrokbot.com/. Open that page before you paste a connect code into the extension. The code stores whatever address you used.

## 6. Use it

1. Open https://relay.sendtogrokbot.com/.
2. Copy the connect code. It starts with `stgbr1.`. Keep it. If you lose it, the saved destinations cannot be read back.
3. Add the Grok Bot webhook, the Claude routine, or both. Save.
4. In the extension options, check **Relay**, paste the code, and click **Save**. Leave Relay off to keep sending directly from the browser.

The relay key shown under the code is the same secret. The extension and the iPhone shortcut both want the whole code, the one that starts with `stgbr1.`. You do not copy the key into the shortcut.

## Try it locally first (optional)

```bash
cp .dev.vars.example .dev.vars
```

Put a real `openssl rand -base64 32` value in `.dev.vars`, then:

```bash
npx wrangler dev
```

Open the localhost address it prints. That connect code only works against your computer. For the extension you actually run, open https://relay.sendtogrokbot.com and use the code from that page.

## iPhone shortcut

The share sheet shortcut is `shortcuts/Send to Grok Bot.shortcut`. How to import it, how to rebuild it by hand, and how to publish the iCloud link are in `shortcuts/BUILD.md`. The public steps are on `https://sendtogrokbot.com/mobile` after the site is deployed.

The shortcut posts here:

`POST https://relay.sendtogrokbot.com/v1/send`

Header `Authorization: Bearer` plus the whole `stgbr1.` code. Header `Content-Type: application/json`. Body:

```json
{
  "destination": "grokbot",
  "source": "shortcut",
  "url": "https://x.com/user/status/123"
}
```

`destination` is `grokbot`, `claude`, `chatgpt`, or `codex`. Grok Bot and Claude use what you saved on the setup page. The shortcut does not contain the webhook key or the Claude token. ChatGPT and Codex need nothing saved. A successful response includes `notice` (the notification text) and, for ChatGPT and Codex, `openUrl`.

A 200 response with `"ok": true` means it worked. `401` means the code is wrong. `404` means Grok Bot or Claude is not saved for that code yet. `429` means the hourly limit was hit.
