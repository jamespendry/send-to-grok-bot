# Set up Send to Grok Bot

You were given this repository and asked to set it up. You are Grok Bot, Claude Code, ChatGPT, or Codex. Do the work yourself. The person should only have to do the clicks you cannot perform.

Read this file before you give instructions. The human steps in the README are for a person working alone. You are not that person.

## Rules

1. Do every step your tools and permissions allow. Reading this repo, creating the routine, and building the connection code are your job.
2. Speak to the person one step at a time. One action in a message. Wait until they tell you what they see. If it does not match the success line, fix that step before you send the next one.
3. Do not ask the person to paste a webhook key, routine token, or other secret into this chat. Tell them which box on the extension options page to paste it into.
4. When you can see both the address and the secret, return them as one connection code. They paste that code once, into the options page. They do not paste it back into this chat. Do not also print the raw key.
5. When you cannot see the secret, do not collect it. The person copies it from the routine page straight into the options page. A secret-request card is the wrong destination. The secret belongs in the extension, in `chrome.storage.local`, not in your notes.
6. Do not invent webhook URLs, `trig_` ids, or tokens. Copy them from the tool or the screen that created them.
7. Do not post, follow, or message anyone on X while you set this up.
8. Do not edit `extension/content.js`. Another change owns how posts are read.
9. Do not commit a connection code, a key, or a token. Do not put one in a GitHub issue, pull request, or chat log you file somewhere else.

## What done looks like

Chrome shows a button on each X post. The person clicks it and picks a destination you prepared.

- Grok Bot: a webhook routine exists, and the extension has its URL and key.
- Claude Code: an API task exists under Scheduled tasks, with the default prompt and the network allowlist below, and the extension has its Fire URL and token. Runs show up under that task's History. If they cannot use tasks, Claude opens in a tab and no secret is stored.
- ChatGPT or Codex: no secret. Clicking a post opens that product with the post filled in.

You cannot load an unpacked extension into their Chrome unless you are driving that Chrome window. Assume you are not. The last section is the walkthrough you give them.

## Which destination

If they named one, use it. If they did not, ask once which they want: Grok Bot, Claude, ChatGPT, or Codex. Then start. A second destination is a second connection code later. Do not make them choose a stack of options before the first one works.

## Connection code

A connection code is one string. It starts with `stgb1.` and the rest is base64url-encoded JSON. The options page reads it, fills that destination, and saves to `chrome.storage.local`. It does not keep the code string, and it does not send the code anywhere.

Build it with the repo, from the repo root:

```bash
node -e 'const {encodeConnectionCode}=require("./extension/connect.js"); console.log(encodeConnectionCode({destination:"chatgpt"}))'
```

`encodeConnectionCode` checks the fields and throws a plain-language error when something is missing. Use it. Do not hand-encode unless you cannot run Node. If you cannot, the JSON below is the whole format. UTF-8 JSON, base64url, no padding, prefix `stgb1.`

| Destination | JSON |
| --- | --- |
| Grok Bot | `{"destination":"grokbot","mode":"webhook","url":"https://...","key":"..."}` |
| Claude routine | `{"destination":"claude","mode":"routine","url":"https://api.anthropic.com/v1/claude_code/routines/trig_.../fire","token":"..."}` |
| Claude tab | `{"destination":"claude","mode":"link"}` |
| ChatGPT tab | `{"destination":"chatgpt","mode":"link"}` |
| ChatGPT agent | `{"destination":"chatgpt","mode":"agent","triggerId":"agtch_...","token":"..."}` |
| Codex | `{"destination":"codex","mode":"link"}` |

The key is optional for Grok Bot. For Claude, `url` is the **Fire URL** copied from Edit scheduled task. A routines page link or a bare `trig_` id also works. Do not build the URL yourself. Codex may also include `environment` and `branch`. Claude, ChatGPT, and Codex may include `prompt`. Grok Bot must not: the prompt lives on the routine, and the encoder rejects a Grok Bot code that contains one.

A Claude or ChatGPT `link` code clears a routine token already saved for that destination, so the button opens a tab. It does not clear the other destinations.

`options.html#connect=stgb1....` fills the same way when the options page opens, then the page removes the hash. Do not send the person a `chrome-extension://` link. Those links do not open reliably from web pages or from chat. The paste box is the path. The fragment is only for a case where you can already set the address of the open options page.

There is also a local page, [docs/connect.html](docs/connect.html). Opened from the unzipped project folder, it builds a code in the browser and does not upload it. Use it when the person is holding the secret and you are not. Do not ask them to paste the secret into chat so you can run the Node command.

## Grok Bot

Create a webhook-triggered routine yourself.

- Name: Send to Grok Bot
- Trigger: webhook
- Instruction: the prompt under the line in [prompts/default-routine-prompt.md](prompts/default-routine-prompt.md), unchanged. Do not include the title.

If creating it shows a confirm card, that confirmation is one step. Ask, wait, then continue. Leave the routine on, not paused.

The create result often does not include the webhook URL or the key. They appear on the routine after it exists. On desktop, click the bot's name at the top of the chat, open Routines, and open this routine. The Webhook section has **POST to** (the URL) and **key**. Copy those values. Do not construct the URL. It looks like `https://api2.cursor.sh/automations/webhook/...` but the id has to come from the routine. The phone app does not show these fields. Desktop does.

When you can read both, build a `grokbot` connection code and keep it for the handoff. That code is how you return the URL and the key. Do not print the key on its own line.

When you cannot read the key, stop trying to obtain it. In the handoff, walk the person from that Webhook section into the options page: Webhook URL, then Webhook key, then Save. One box per step. They tell you when the page says Saved. They never type the key into this chat.

The extension POSTs the post as JSON and sends the key as `Authorization: Bearer <key>` and as `X-Sender-Key: <key>`. A 200 means the routine started. The reply shows up in the bot's chat when the run finishes.

## Claude Code

Create a scheduled task the extension can start. Tasks live at [claude.ai/code/routines](https://claude.ai/code/routines). That page is titled **Scheduled tasks**. Do this yourself if you are logged in. The CLI `/schedule` command creates a scheduled routine and cannot mint the API token. The Fire URL and token are on the task, in **Edit scheduled task**.

1. Click **New task**, then **Set up manually**. Do not create a local Desktop task.
2. Name it Send to Claude.
3. Set the instructions to the prompt under the line in [prompts/default-routine-prompt.md](prompts/default-routine-prompt.md).
4. In the **Trigger** section, choose **API**.
5. The prompt does not commit or push. If the form will not save without a repository, ask which repo to attach and wait. Do not create a repository unless they ask.
6. Set the network allowlist, below. The dialog says permissions are set by the environment.
7. Save.
8. Click the task, then Edit. Copy the **Fire URL** and the **Token**.

![Edit scheduled task. Trigger is API. Fire URL has a copy button. Token has Regenerate and delete.](docs/img/claude-routine-api-trigger.png)

The Fire URL goes in **Routine URL**. The token goes in **Routine token**. Copy them from this dialog. The extension also accepts a routines page link or a bare `trig_` id, but the Fire URL is the value on screen.

**Regenerate** and the delete button sit on the Token row. Regenerating invalidates the previous token. Delete turns off API access. To get a new token, click the task, choose Edit, and click **Regenerate**. Do not ask the person to regenerate so you can read the token. If you cannot copy the two values yourself, the handoff walks them through it, one box at a time. They paste into the options page, not into this chat.

The task page shows **History**, **Instructions**, **Triggers** (API, with a copy icon), and **Runs with**.

![The task page: History, Instructions, Triggers set to API, and Runs with.](docs/img/claude-routine-overview.png)

Runs show up under **History**. Leave the task **Active**.

If you hold both the Fire URL and the token, build a `claude` routine connection code for the handoff. Do not print the token by itself.

This needs a Claude Pro, Max, Team, or Enterprise plan with Claude Code on the web. If they do not have that, say so, and use a link code (`{"destination":"claude","mode":"link"}`) instead. No secret. Clicking a post opens claude.ai with the post filled in, and they press Send.

### Network allowlist

The routine should open the post when the text in the payload is thin. It does that by fetching `api.fxtwitter.com`. A default environment uses Trusted network access, which allows package registries and a short host list, and blocks everything else. A fetch to fxtwitter or x.com then fails with 403 (`host_not_allowed`), and the routine can only see the text the extension sent.

On the routine, open **environment settings**. Set **Network access** to **Custom**. Allow these hosts, one per line:

```
api.fxtwitter.com
fxtwitter.com
api.vxtwitter.com
vxtwitter.com
x.com
twitter.com
t.co
```

If there is a checkbox to also keep the default package-manager list, turn it on, so the environment can still install tools. Save the environment. The routine uses that environment's network on every run.

If you cannot change the environment, walk those clicks one at a time in the handoff, and wait for them to say the environment saved before you talk about the token.

## ChatGPT

Link mode needs no secret and no setup on chatgpt.com. Build `{"destination":"chatgpt","mode":"link"}` and use it in the handoff.

Do not set up a Workspace Agent unless they ask for a fully automatic run. That needs a Business or Enterprise workspace, an admin, an `agtch_` trigger id, and an access token. If they do ask and you cannot create the token, they paste the id into **API trigger ID** and the token into **Workspace Agent access token** on the options page. Not into this chat.

## Codex

Link mode needs no secret. Build `{"destination":"codex","mode":"link"}`.

Add `environment` and `branch` only when they already gave you those values. Codex Cloud has no public webhook a normal ChatGPT account can call. Do not ask for an API key. Clicking a post opens `chatgpt.com/codex` with the post filled in, and they press Send.

## Handoff

Do this after the destination exists, or, for ChatGPT and Codex, as soon as you have the link code. Send one step. Stop. Wait for them to say what they see. Use these words, with their real file name filled in.

1. "Open the project page on GitHub in Chrome. Click the green Code button, then click Download ZIP. Tell me when a file whose name starts with send-to-grok-bot is in your Downloads folder."
2. "Double-click that zip. Open the folder inside it until you see a folder named extension. Open extension and tell me when you see a file named manifest.json. Then go back so extension is a folder you can select, not a window full of files."
3. "Click the address bar, type chrome://extensions, and press Enter. Tell me when the page title is Extensions."
4. "At the top right, turn Developer mode on. Tell me when a button named Load unpacked appears."
5. "Click Load unpacked. Select the extension folder, the one that contains manifest.json, and confirm. Tell me when a card named Send to Grok Bot appears and its switch is on. If Chrome says the manifest is missing, you selected the outer folder. Go back and select extension."
6. "Click the puzzle-piece icon on the Chrome toolbar. Beside Send to Grok Bot, click the pin. Tell me when that icon is sitting on the toolbar."
7. "Click that icon. Tell me when you see a page titled Send to Grok Bot with a box labeled Connection code."
8. Then one of these, not both:
   - You have a connection code: "Paste this into the Connection code box and click Connect. Do not paste it back here." Put the code in that message. Success is a green line that starts with "Saved Send to" and names their destination.
   - They are the only ones who can see the secret. For Grok Bot: "On the routine page, click the webhook address to copy it. On the extension page, paste it into Webhook URL. Tell me when the address is in that box." Next message: the key, into Webhook key, with "Do not paste the key here." Next message: "Click Save. Tell me when you see the word Saved." For Claude: "Click the task, then Edit. Copy the Fire URL. Paste it into Routine URL. Tell me when it is in that box." Next message: "Copy the token. Paste it into Routine token. Do not paste the token here." Next message: "Click Save. Tell me when you see the word Saved."

9. "Open x.com and refresh. On any post, click the arrow icon in the row with reply, repost, like, and share. Tell me which names you see." Success is the destination you set up. Then: "Click that name."
   - Grok Bot: the icon turns green, and a run shows up in the bot's chat. A 200 only means the run started.
   - Claude routine: the run is listed under History on the task page.
   - Claude, ChatGPT, or Codex tab: a new tab opens with the post written in the box. They press Send.
   - A red icon: read the line under the message at the bottom of the screen, and fix that one thing.

If they already have the folder, skip the download and start at the first step they have not done. Ask what they see. Do not replay finished steps.

## When something fails

- Chrome says it needs a manifest: they selected the folder that contains `extension`, not `extension` itself.
- Developer mode is off: Load unpacked is hidden. That is step 4.
- The menu on a post is empty and the options page opens: nothing is checked, or Grok Bot is checked without a webhook address.
- Grok Bot returns anything other than 200: the routine is paused, or the key is not the current one.
- Claude says the token is invalid: click the task, choose Edit, click **Regenerate**, paste that token into **Routine token**, and click Save. Regenerating invalidates the previous token.
- Claude cannot open the post: the network allowlist is missing or still on Trusted. Repeat the environment step.
- They pasted the code into this chat: tell them to paste it into the options page instead, and do not ask them to paste it again here.
