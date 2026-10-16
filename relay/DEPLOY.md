# Deploy the relay

The relay is live at https://relay.sendtogrokbot.com. `wrangler.toml` already points at that custom domain, the D1 database, and the KV namespace on the Cloudflare account that holds sendtogrokbot.com. You do not need a new account or a new domain.

The worker does three things:

- The setup page at `/` creates a relay key and a one-paste connect code. You paste that code into the extension.
- `PUT /v1/config` stores a Grok Bot webhook and a Claude routine. The webhook key and the Claude token are encrypted with AES-GCM before they are saved. They are not written to the logs.
- `POST /v1/send` checks the relay key, then forwards the post. Grok Bot gets the post as JSON with `Authorization: Bearer` and `X-Sender-Key` when a key is saved. Claude gets `POST` to the routine fire URL with `anthropic-version: 2023-06-01` and `{"text":"..."}`.

D1 holds the account and the last 50 sends (time, destination, link, author, and whether it worked — not the post text). KV counts requests so one key cannot run away. Limits are 60 sends an hour, 30 saves an hour, 20 new codes an hour from the same network, and 300 API calls an hour from the same network.

ChatGPT and Codex stay in the extension. They open a tab. This relay does not send email.

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

The relay key shown under the code is the same secret. The extension wants the whole code. A Shortcut wants just the key.

## Try it locally first (optional)

```bash
cp .dev.vars.example .dev.vars
```

Put a real `openssl rand -base64 32` value in `.dev.vars`, then:

```bash
npx wrangler dev
```

Open the localhost address it prints. That connect code only works against your computer. For the extension you actually run, open https://relay.sendtogrokbot.com and use the code from that page.

## A future iPhone Shortcut

The same endpoint takes a post from the Shortcuts app. No app install is required.

1. Open Shortcuts and make a new shortcut.
2. Add **Get Contents of URL**.
3. URL: `https://relay.sendtogrokbot.com/v1/send`.
4. Method: POST.
5. Add a header named `Authorization`. The value is `Bearer ` followed by the relay key (the `rk_...` value on the setup page).
6. Add a header named `Content-Type` with the value `application/json`.
7. Set the request body to JSON:

```json
{
  "destination": "grokbot",
  "source": "shortcut",
  "url": "https://x.com/user/status/123",
  "text": "Post text",
  "author": "user",
  "sentAt": "2026-10-16T00:00:00.000Z"
}
```

`destination` is `grokbot` or `claude`. The relay uses the webhook or the routine you saved. It does not need the webhook key or the Claude token in the shortcut. Those stay encrypted on the worker.

A 200 response with `"ok": true` means the destination accepted it. `401` means the relay key is wrong. `429` means the hourly limit was hit.
