# Deploy the relay

This is the Cloudflare Worker for sendtogrokbot.com. It is not deployed yet. You already have a Cloudflare account, and the domain sendtogrokbot.com is already on that account. You do not need a new account or a new domain.

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

## 3. Create the database

```bash
npx wrangler d1 create stgb-relay
```

The output includes a `database_id`. Copy it into `wrangler.toml`, replacing `00000000-0000-0000-0000-000000000000`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "stgb-relay"
database_id = "paste-the-id-here"
```

Then create the tables:

```bash
npx wrangler d1 execute stgb-relay --remote --file=schema.sql
```

The worker also creates the tables if they are missing. Run the command anyway so the database is ready before the first request.

## 4. Create the KV namespace

```bash
npx wrangler kv namespace create STGB_KV
```

Copy the `id` into `wrangler.toml`, replacing the line of zeros:

```toml
[[kv_namespaces]]
binding = "KV"
id = "paste-the-id-here"
```

## 5. Set the encryption secret

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

## 6. Deploy

```bash
npx wrangler deploy
```

This publishes the worker. It does not, by itself, put it on sendtogrokbot.com. The command prints a `*.workers.dev` address. You can open that to confirm the setup page loads. The connect code will use whatever address you opened, so create the real hostname before you paste a code into the extension.

## 7. Put it on the domain

Pick one. The setup page and the API both work either way.

### relay.sendtogrokbot.com

1. In the Cloudflare dashboard, open **Workers & Pages**.
2. Open **stgb-relay**.
3. Open **Settings**, then **Domains & Routes**.
4. Choose **Add**, then **Custom domain**.
5. Enter `relay.sendtogrokbot.com`.

Cloudflare creates the DNS record because the zone is already on this account. Wait until the certificate is active, then open:

```text
https://relay.sendtogrokbot.com/
```

### Or a path on the existing site

1. In the same **Domains & Routes** screen, choose **Add route**.
2. Route: `sendtogrokbot.com/api/*`
3. Zone: `sendtogrokbot.com`

Then open:

```text
https://sendtogrokbot.com/api/
```

The connect code stores that `/api` base. The extension posts to `https://sendtogrokbot.com/api/v1/send`.

You can instead uncomment one `routes` line in `wrangler.toml` and run `npx wrangler deploy` again. The dashboard does the same thing.

## 8. Use it

1. Open the setup page on the hostname you chose.
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

Open the localhost address it prints. That connect code only works against your computer. Use the public hostname for the extension you actually run.

## A future iPhone Shortcut

The same endpoint takes a post from the Shortcuts app. No app install is required.

1. Open Shortcuts and make a new shortcut.
2. Add **Get Contents of URL**.
3. URL: `https://relay.sendtogrokbot.com/v1/send` (or `https://sendtogrokbot.com/api/v1/send` if you used the path).
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
