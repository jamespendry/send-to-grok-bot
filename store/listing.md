# Chrome Web Store listing

Paste these into the Store listing tab. There are no emoji in this copy. Do not add any.

## Name

Send to Grok Bot

The name matches `name` in manifest.json. It uses "Grok", which is another company's mark. See the trademark item in store/permissions.md.

## Short description

132 characters is the limit. This is 101.

Send any X post to Grok Bot, Claude, ChatGPT, or Codex in one click. Only the post you click is sent.

Chrome Web Store shows the summary above in the store. Chrome shows the manifest `description` at install and on the extensions page. They can differ, but a close match avoids a "description mismatch" flag. The current manifest description is 99 characters:

> Adds a native-looking button to X posts that sends the post to Grok Bot, Claude, ChatGPT, or Codex.

It is accurate, so no change is required. If you want them identical, change the manifest `description` line to the 101-character summary above. This file does not edit the manifest.

## Detailed description

Tired of copying and pasting posts from X into every AI?

Send to Grok Bot adds one Send arrow to the action bar of every post on X. It sits in the same row as reply, repost, like, and share.

Click it. If one destination is turned on, the post goes there. If more than one is on, a menu opens and you pick one.

Destinations:
- Grok Bot, or any https webhook you enter.
- Claude. Opens Claude with the post filled in, or starts a Claude Code routine if you saved one.
- ChatGPT. Opens ChatGPT with the post filled in, or starts a Workspace Agent if you saved one.
- Codex. Opens the Codex cloud task composer with the post filled in.

For Claude, ChatGPT, and Codex in a tab, you press Send yourself.

Each send includes the post text, link, and author. When you send, the extension also fetches the full post, the posts it replies to, and any quoted post from the public mirrors api.fxtwitter.com and api.vxtwitter.com, so the AI gets the whole conversation. Links, media addresses, and alt text come along when the post has them.

Reply presets. Pick General, Research, Job hunt, Buy or skip, Learn later, or Content ideas on the options page. The preset you pick is sent with the post. You can also write your own prompt.

On iPhone. A free Shortcut, set up at sendtogrokbot.com/mobile, adds Send to Grok Bot to the share sheet in the X app. Share a post and pick Claude, ChatGPT, or Grok Bot. The AI opens with the post filled in. Codex is Chrome only.

Privacy.
- Only the post you click is sent. The extension does not read direct messages or browse your history.
- Only the destination you turn on, or pick from the menu, receives it.
- Webhook keys and API tokens are stored in this browser. They are not synced to your Google account.
- No analytics, no advertising, and no data sold.
- Access to your webhook host, api.anthropic.com, or api.chatgpt.com is optional. Chrome asks only when you save that destination.
- The privacy policy is at sendtogrokbot.com/privacy.

Free. Open source at github.com/jamespendry/send-to-grok-bot.

Send to Grok Bot is not affiliated with, endorsed by, or sponsored by X, xAI, Anthropic, or OpenAI. Grok, Claude, ChatGPT, Codex, and X are trademarks of their owners.

## What is new (1.2.7)

Safe to leave blank. If you want text:

> Send to Grok Bot is now in the Chrome Web Store. One Send arrow on every X post, to Grok Bot, Claude, ChatGPT, or Codex.

For later updates, use one plain sentence about what changed, for example: "Fixed the menu position on the post page."

## Category

Productivity

## Language

English

## Icon

The package already contains the store icon at `extension/icons/icon128.png`, plus 16, 32, and 48. You do not upload a separate icon if the 128 pixel icon in the zip is accepted. If the dashboard asks for one anyway, upload `extension/icons/icon128.png`.

## Small promo tile (required)

Upload `store/promo/tile-440x280.png`.

440 by 280 pixels, PNG, no transparency.

## Marquee promo tile

Upload `store/promo/marquee-1400x560.png`.

1400 by 560 pixels, PNG, no transparency. The store uses this when an item is featured. It is optional for a first publish, and worth uploading with the tile.

## Screenshots

Five files in `store/screenshots/`, each exactly 1280 by 800, RGB PNG, light mode, in a framed card with a one-line caption. Upload in this order. The first is the one people see in search.

1. `01-send-button.png`: the Send arrow in the action bar of a public post on x.com.
2. `02-destination-menu.png`: the menu open with Send to Grok Bot, Claude, ChatGPT, and Codex.
3. `03-reply-in-claude.png`: a reply arriving in Claude.
4. `04-options.png`: the options page with the disclosure and the four destinations. Sample webhook only.
5. `05-connected.png`: the sendtogrokbot.com connect page saying Connected.

Screenshots are uploaded on the Store listing tab. They do not go in the extension zip. `store/screenshots/README.md` says how each was made.
