# Send to Grok Bot

A Chrome extension that puts a button on every post on X. You click the button, pick where the post should go, and that tool reads it. It is free. There is nothing to buy.

If you are an AI agent and someone asked you to set this up, stop here and follow [AGENTS.md](AGENTS.md). Grok Bot sends one message after the routine exists. Claude stays one step at a time.

People who use Grok Bot can paste this one line into the bot:

```
Set up Send to Grok Bot for me: https://github.com/jamespendry/send-to-grok-bot
```

The bot creates a webhook routine with the General prompt. It cannot read the webhook key. After the routine exists it sends one message. Install the extension first: `https://sendtogrokbot.com/install`. Then open the routine from Routines in the bot's info pane. Copy **POST to** and paste it at `https://sendtogrokbot.com/connect`. Then copy **header** and paste it in the same box. With the extension installed, each paste saves. The website (`/`, `/install`, `/setup`, `/setup/grok`, `/setup/claude`, `/setup/chatgpt`, `/setup/codex`, `/try`, `/mobile`, `/history`, `/connect`, `/privacy`) is in [docs/](docs/). To publish it: `bash scripts/build-site.sh`, then `npx wrangler deploy --config site/wrangler.toml`. [site/README.md](site/README.md) has the details.

Store listing text, promo images, and the upload steps are in [store/](store/). `scripts/package.sh` writes the zip.

## Set it up

Install the extension first: https://sendtogrokbot.com/install. It is not in the Chrome Web Store yet. You need Chrome on a computer.

### Open the settings

Click the Send to Grok Bot icon on the Chrome toolbar. If you did not pin it, it is in the puzzle-piece menu.

You should see a page titled **Send to Grok Bot**, with a box labeled **Paste here** at the top. Replies, destinations, and Save are under **More options**.

![The options page, with the paste box at the top](docs/img/07-options.png)

### Turn on a destination

For Grok Bot, paste the webhook URL into **Paste here**, then paste the Authorization header into the same box. Either order works. The same pastes work on `https://sendtogrokbot.com/connect`. If the extension is installed, each paste saves.

After the first value you should see: Webhook URL saved. Now paste the Authorization header. After the second: Now open x.com and click the arrow. Paste those two values only on this page or on that connect page, not into a chat. Another paste later adds another destination. It does not erase the ones already saved.

If you do not have a link:

- **ChatGPT** needs no setup. Check **Send to ChatGPT** and click **Save**. You should see the word Saved. No password. Clicking a post opens ChatGPT with the post filled in. You press Send.
- **Codex** needs no setup. Check **Send to Codex** and click **Save**. You should see the word Saved. No password. Clicking a post opens Codex with the post filled in. You press Send.
- **Grok Bot**: paste the webhook URL into **Paste here**, then the Authorization header. You should see: Now open x.com and click the arrow. Where those two values are is in the Grok Bot section below. The separate URL and key fields are under **More options**.
- **Claude**, opening a tab: check **Send to Claude**, leave the box empty, and click **Save**. You should see the word Saved.
- **Claude**, a routine: check **Send to Claude**. Paste the Fire URL and the token into the one box, in any order. Click **Save**. You should see the word Saved. The Claude section below is the click path.

Saving a webhook, a Claude routine, or a ChatGPT agent asks Chrome for access to that site only. Opening Claude, ChatGPT, or Codex in a tab does not. A webhook address has to be https. If Chrome asks you to allow the site, choose Allow.

![One destination checked, with its fields filled in, and the word Saved](docs/img/08-destinations.png)

## Try it

Open [x.com](https://x.com) and refresh. On a post, look at the row with reply, repost, like, and share. Click the arrow icon in that row.

You should see a menu with the destinations you turned on. Click one.

- Grok Bot or a Claude routine: the icon turns green when the send is accepted.
- ChatGPT, Codex, or Claude with the routine fields left blank: a new tab opens with the post already written in the box. You press Send.

If the icon turns red, a line at the bottom of the screen says why. The button is on every post even when nothing is filled in. If a destination is not set up, clicking it opens this settings page and says what to paste.

![The arrow icon in an X post's action row](docs/img/09-post-button.png)

![The destination menu open on a post](docs/img/10-menu.png)

## Screenshots to take

The pictures above are placeholders. Take these and save them under `docs/img/` with these file names.

| File | What to capture |
| --- | --- |
| `docs/img/07-options.png` | The options page, showing the paste box at the top |
| `docs/img/08-destinations.png` | A destination checked, its fields, and the word Saved |
| `docs/img/09-post-button.png` | The arrow icon in an X post's action row |
| `docs/img/10-menu.png` | The destination menu open on a post |
| `docs/img/grok-routines-webhook.png` | Grok Bot info pane, Routines, Send to Grok Bot open. Webhook shows POST to, key, and header. Blur the key and header |
| `docs/img/connect-page.png` | sendtogrokbot.com/connect with Step 1, the paste box, and no Connect button. No real secret |
| `docs/img/claude-scheduled-tasks.png` | claude.ai left sidebar, Routines, page titled Scheduled tasks. Blur account details |
| `docs/img/options-replies.png` | Options page, Replies preset menu, and the Claude box with Copy task prompt |

`docs/img/claude-routine-overview.png` and `docs/img/claude-routine-api-trigger.png` are already in the repo. They are blurred. Use them for the task page and the Edit dialog. Do not retake them unless the screen has changed.

## Where the paste comes from

Grok Bot cannot read the webhook key, so it does not hand you a connect link. After it creates the routine, you open the routine's detail pane, copy **POST to**, and paste it at `https://sendtogrokbot.com/connect`. Then you copy **header** (or **key**) and paste it in the same box. Either order works. The page does not upload what you paste.

The same box accepts a Claude Fire URL and token pasted together, in any order. It accepts a `trig_` id. The options page accepts those same pastes. A Claude, ChatGPT, or Codex connection code can still be pasted there. It starts with `stgb1.`. Grok Bot setup does not use one.

`options.html#stgb1.` and `options.html#connect=stgb1.` also fill the options page, and then the page removes the hash. Links that start with `chrome-extension://` do not open reliably from a web page.

The page stores the address and the key in `chrome.storage.local` on this computer. It does not keep the link.

## Website

`docs/` is the site for sendtogrokbot.com. Build it, then deploy the folder as a Cloudflare Worker with static assets:

```bash
scripts/build-site.sh
npx wrangler deploy --config site/wrangler.toml
```

`scripts/build-site.sh` writes `dist/site`. That folder is the site root: `/` is a short landing page, `/install` is the install page, `/connect` is the connect page, `/setup`, `/setup/grok`, `/setup/claude`, `/mobile`, `/history`, and `/privacy` are the guides. The build copies `extension/connect.js` to `/connect.js` and `extension/prompts.js` to `/prompts.js` so the pages work without the rest of the repository. Attach the domain `sendtogrokbot.com` to the `sendtogrokbot` worker in the Cloudflare dashboard after the first deploy. `/mobile` tells an iPhone user to install the shortcut and paste one relay code. The iCloud link is not in the repository. Copy it from the Shortcuts app and paste it into `docs/mobile.html` where the page says the link is not published yet, then deploy again. The steps are in [shortcuts/BUILD.md](shortcuts/BUILD.md).

The same folder can go to Cloudflare Pages:

```bash
npx wrangler pages deploy dist/site --project-name sendtogrokbot
```

[`docs/_redirects`](docs/_redirects) is the pretty-URL list for that root. [`_redirects`](_redirects) at the repository root is only for serving the same paths when the whole repository is the site root.

## Relay (optional)

You can store the Grok Bot webhook and the Claude routine on a small relay, and paste one code into the extension instead of those secrets. Check **Relay** at the bottom of the options page and paste the code from the setup page. It starts with `stgbr1.`. Leave it off to keep sending directly. From the extension, ChatGPT and Codex open a tab.

The relay is a Cloudflare Worker in [`relay/`](relay/). Setup, including the exact commands, is in [relay/DEPLOY.md](relay/DEPLOY.md). The iPhone shortcut posts the same `/v1/send` endpoint with the whole `stgbr1.` code. ChatGPT and Codex come back as a link the phone opens. `GET /v1/history` is the list on `/history`.

## Marketplace plugin

[`plugin/`](plugin/) is the Grok Bot and Cursor plugin. It creates the webhook routine, then sends one message telling you to copy POST to and header from the routine and paste them, one at a time, at sendtogrokbot.com/connect. The logo on the site is `/logo.svg`. The form answers are in [plugin/SUBMIT.md](plugin/SUBMIT.md). Submit them at https://x.ai/bot/marketplace/submit-a-plugin.

When Relay is on, Grok Bot and Claude still receive the version 2 post, including `digest` and media fields. The relay forwards that object.

## What gets sent

Grok Bot, and any other webhook, receives `POST` with `Content-Type: application/json`:

```json
{
  "source": "x",
  "version": 2,
  "url": "https://x.com/user/status/123",
  "author": "user",
  "authorName": "Display Name",
  "text": "Post text, with t.co links replaced by their full URLs",
  "postedAt": "2026-10-15T22:58:00.000Z",
  "truncated": false,
  "links": [{"text": "https://github.com/foo/bar", "url": "https://github.com/foo/bar", "href": "https://t.co/abc"}],
  "media": [
    {"type": "image", "alt": "Alt text", "url": "https://pbs.twimg.com/media/abc?format=jpg&name=large"},
    {"type": "video", "duration": 15, "thumbnail": "https://pbs.twimg.com/ext_tw_video_thumb/1/pu/img/abc.jpg?name=large", "captions": "Visible caption"},
    {"type": "gif", "duration": null, "thumbnail": "https://pbs.twimg.com/tweet_video_thumb/abc?format=jpg&name=large", "captions": ""}
  ],
  "card": {"href": "https://t.co/xyz", "text": "example.com | Title | Description"},
  "metrics": "3 replies, 10 reposts, 99 likes, 5000 views",
  "quoted": {"author": "other", "authorName": "Other", "text": "Quoted text", "postedAt": "…", "links": []},
  "inReplyTo": {"url": "https://x.com/other/status/122", "author": "other", "text": "Parent text"},
  "thread": [{"url": "https://x.com/user/status/123", "text": "1/", "postedAt": "…"}],
  "digest": "Plain-text rendering of all of the above",
  "sentAt": "2026-10-15T23:00:00.000Z",
  "preset": "general",
  "prompt": "The reply instructions for the preset you picked"
}
```
`url`, `author`, `text` and `sentAt` are always present. The rest are best-effort and may be empty or `null`. `thread` and `inReplyTo` are filled only when you click from a post's own page (`/status/…`), where X renders the conversation. Text fields keep line breaks and are capped at 20,000 characters. Threads are capped at 25 posts, in a window that still contains the post you clicked; `digest` prints that post's text even when it falls outside the window. Photo `url`s and video/GIF `thumbnail`s on `pbs.twimg.com` use `name=large`. A thumbnail is the `<video poster>` or an `ext_tw_video_thumb` / `amplify_video_thumb` / `tweet_video_thumb` image. `captions` is the text visible in the player, not a downloaded transcript. If your receiver passes a single text field to an AI, forward `digest`.

If a key is set, it is sent as `Authorization: Bearer <key>` and as `X-Sender-Key: <key>`.

`preset` is `general`, `research`, `job-hunt`, `buy-or-skip`, `learn-later`, `content-ideas`, or `custom`. `prompt` is the text for that choice. Grok Bot and a Claude routine should be created with the General prompt, which follows `prompt` when the post includes one. ChatGPT and Codex are prefilled with the same text. The files are in [prompts/](prompts/). General is [prompts/general.md](prompts/general.md), which is the same text as [prompts/default-routine-prompt.md](prompts/default-routine-prompt.md).

On the options page, under Replies, pick a preset or edit the text. Editing switches the preset to Custom. What you see in the box is what gets sent.

The menu sends this same object to the destination you pick. Grok Bot posts the JSON. Claude, ChatGPT, and Codex receive that object too, and use `digest` when the destination can only take a single text field. A Claude routine also receives the prompt as a `Prompt:` section before the post, because that API takes a single text field.

## Privacy
The extension sends only the posts you click (plus, on a post's page, the author's thread and the post it replies to), and only to the destination you pick. It does not track browsing, collect analytics, or sell data. Addresses, tokens, and keys are stored in `chrome.storage.local`. A webhook URL and key from an earlier version are copied out of `chrome.storage.sync` once, then removed there. Host access is optional and is limited to the webhook host, `api.anthropic.com`, `api.chatgpt.com`, or the relay host after you save that destination. The policy to publish at sendtogrokbot.com/privacy is [docs/privacy.html](docs/privacy.html), kept in step with [store/privacy-policy.md](store/privacy-policy.md). In relay mode, the extension stores the one relay code in `chrome.storage.local`. The webhook key and Claude token stay on the relay, encrypted, and are not written to its logs.

## Chrome Web Store
Listing text, promo images, and the upload steps are in [store/](store/). `scripts/package.sh` writes `dist/send-to-grok-bot-<version>.zip`. Screenshots of x.com are not in that zip. The shot list is in [store/listing.md](store/listing.md).

## How each destination works

### Replies

General is the default. It classifies the post, then answers in that shape, and it always starts with a one-line takeaway.

- Tool, repo, or app: what it does, whether it is worth installing, and how to try it.
- Thread or long article: a 3-line summary, then the key takeaway.
- News: what happened, why it matters, and what to watch.
- Video: describe it from the captions, thumbnail, and text. Do not claim to have watched it. Fetches go to fxtwitter, then vxtwitter.
- Tip, prompt, or how-to: one actionable step to save.
- Job, company, or founder: who they are, the stage, and who to follow.
- Product or deal: worth buying or not, and why.
- Meme, opinion, or anything else: one line of context, then stop.

Presets on the options page: General, Research, Job hunt, Buy or skip, Learn later, Content ideas. Edit the text to use your own. The files are under [prompts/](prompts/).

### Grok Bot

The automatic path is the one line at the top of this file. The bot cannot read the webhook key. After the routine exists it sends one message: install the extension first at sendtogrokbot.com/install, open the routine, and paste POST to and then header at sendtogrokbot.com/connect.

To copy it yourself, on a computer: in the Grok Bot desktop app, click the bot's name at the top of the chat, or press Cmd+Shift+I. Under **Routines**, click **Send to Grok Bot**. Its When to run is When a webhook fires. Under **Webhook** are three copy fields: **POST to** (the webhook URL), **key**, and **header** (the Authorization header). Paste **POST to** on [the connect page](docs/connect.html). The page says: Webhook URL saved. Now paste the Authorization header. Paste **header** in the same box. Pasting **key** instead also works. The page says: Now open x.com and click the arrow. Do this on a computer. The extension is Chrome on a computer.

Any webhook that accepts the JSON above will do, including Zapier, Make, or n8n. On the connect page, paste the URL and then the Authorization header. A response of 200 means the run started. The reply shows up in the bot's chat.

There is no screenshot of that Routines screen yet. Take `docs/img/grok-routines-webhook.png` and blur the URL and the header.

### Claude

Check **Send to Claude**.

Leave the box empty to open claude.ai in a new tab with the post filled in. You press Send. Very long posts are shortened. This uses the `claude.ai/new?q=` link. That path needs no Fire URL and no token.

To run it for you, save the task's Fire URL and token. You need a Claude Pro, Max, Team, or Enterprise plan with Claude Code on the web. Claude cannot create this task from outside the site. The clicks below match the product.

1. On claude.ai, in the left sidebar, click **Scheduled**. Click **New task**, then **Set up manually**.
2. Name it Send to Claude. In the extension, click **Copy task prompt** and paste it into the instructions box. Set **Trigger** to **API**. Click **Create**.
3. Claude shows the **API token** once. Click its copy button and paste it into https://sendtogrokbot.com/connect. Click **Done**.
4. On the task page, under **Triggers**, click the copy button next to **API** (Copy fire URL). Paste it into the same box on a new line. Click Connect.

![claude.ai, Scheduled in the sidebar, then New task and Set up manually](docs/img/claude-step1-new-task.png)

![The new task form: name, instructions, Trigger set to API, Create](docs/img/claude-step1-form.png)

![The API token box, covered, with its copy button and Done](docs/img/claude-step2-token.png)

![The task page with Copy fire URL next to API](docs/img/claude-step2-fire-url.png)

No allowed websites are needed. The extension sends the whole post and the reply preset with every run, and the task prompt tells Claude to use only that.

A send shows up under **History**. Leave the task Active. Regenerating a token invalidates the previous one. Paste the new token into the same box and click Save.

The API is experimental and may change. Limits are 30 sends an hour per routine and 100 an hour per account. Runs count against the Claude plan. The extension sends `{"text": "..."}` with the preset prompt in front of the post. The token only starts that one routine.

The same steps, with copy buttons, are on [docs/setup/claude.html](docs/setup/claude.html).

### ChatGPT

No setup. Check **Send to ChatGPT** and click **Save**.

Clicking a post opens `chatgpt.com/?q=…` with the preset prompt and the post filled in. You press Send. Long posts are trimmed so the link stays under about 6,000 characters. The post URL is always included. This is a normal chat. Custom GPT links ignore the prompt.

A Workspace Agent (ChatGPT Business or Enterprise) is optional, under the disclosure on the settings page. It runs on its own when an `agtch_…` trigger id and an access token are both saved. Each send is `POST https://api.chatgpt.com/v1/workspace_agents/{id}/trigger`. ChatGPT replies `202 Accepted`.

A Gmail-triggered task for Plus and Pro is not built. The relay in this repo does not send email. It forwards to a Grok Bot webhook or a Claude routine. That Gmail route would still need a worker that emails the post to you.

### Codex

No setup. Check **Send to Codex** and click **Save**.

Codex Cloud does not offer a public webhook a normal ChatGPT account can call. **Send to Codex** opens `https://chatgpt.com/codex` with the preset prompt and the post filled in, and you press Send. An environment id and a branch are optional, under the disclosure. Long posts are shortened so the link stays under about 6,000 characters.

## Logos

Menu rows and the line at the bottom of the screen use small inline SVGs.

- Grok: Grok mark from [@lobehub/icons](https://www.npmjs.com/package/@lobehub/icons) (MIT).
- Claude: Claude starburst from @lobehub/icons, colored `#D97757`.
- ChatGPT: OpenAI mark from [Simple Icons](https://simpleicons.org/) (CC0).
- Codex: Codex mark from @lobehub/icons.

Label text uses the brand color. Claude is `#D97757`. ChatGPT, Codex, and Grok Bot are black on a light surface and white on a dark one. The menu follows X's light and dark surfaces and X's font.

## Roadmap

- Submit the listing prepared in [store/](store/) so install is one click and Developer mode is not required.

## License

MIT
