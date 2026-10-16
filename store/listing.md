# Chrome Web Store listing

Paste these into the Store listing tab. There are no emoji in this copy. Do not add any.

## Name

Send to Grok Bot

## Short description

132 characters is the limit. This is 99.

Adds a native-looking button to X posts that sends the post to Grok Bot, Claude, ChatGPT, or Codex.

Use the same sentence as the summary. It matches the `description` field in the manifest, which is what Chrome shows at install.

## Detailed description

Send to Grok Bot adds one button to the action bar of a post on X. It matches the size and place of Share.

Click it and pick a destination you have set up.

Send to Grok Bot posts the post to an https webhook you provide: text, link, author, and, when the page shows them, the thread, quote, links, and media. Any JSON webhook works, including your own server. Claude, ChatGPT, and Codex receive that same post.

Send to Claude opens Claude with a research prompt and the post filled in. If you save a Claude Code routine URL and token, it starts that routine instead.

Send to ChatGPT needs no setup. It opens ChatGPT with the prompt filled in. You press Send. If you save a Workspace Agent trigger and token, it starts that agent instead.

Send to Codex needs no setup. It opens the Codex cloud task composer with the prompt filled in. You press Send there.

The reply starts with a one-line takeaway. General is the default. Research, Job hunt, Buy or skip, Learn later, and Content ideas are on the options page, and the one you pick is sent with the post.

Only the post you click is sent, and only to the destination you pick. Webhook keys and API tokens stay in this browser. The extension has no analytics and does not sell data.

You choose which destinations appear. If none are set up, the options page opens.

Not affiliated with X, xAI, Anthropic, or OpenAI.

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

You still need to take these. Real x.com screenshots are not in this folder. The store requires at least one and allows five. Take all five, in this order. The first image is the one people see in search.

Each file must be exactly 1280 by 800 pixels, PNG or JPEG, no transparency, square corners, and full bleed. Do not add a caption, border, or emoji. Do not include direct messages, drafts, a real API token, or an account menu that shows a private email. Use a post you are allowed to show. Keep text large enough to read when the store shrinks the image to 640 by 400.

1. **Action bar, light.** A public post on x.com in light theme. The Send button is in the action bar, in the same row as reply, repost, like, and share, and it is the same size as Share. The menu is closed. Show enough of the post that the button clearly belongs to it.
2. **Destination menu, light.** The same kind of post, menu open. All four rows are fully inside the frame: Send to Grok Bot, Send to Claude, Send to ChatGPT, Send to Codex. Light theme.
3. **Success toast, light.** After a successful send. The action-bar icon is green, and the toast at the bottom center is fully visible, including the destination name, for example "Sent to Claude".
4. **Options.** The extension options page in a Chrome window. The disclosure at the top is visible, and all four destinations are visible. Expand Send to Grok Bot. Use a fake webhook such as `https://example.com/hook`. Leave token fields empty. The options page is narrow; center it and let the page background fill the frame. Do not stretch the page.
5. **Destination menu, dark.** x.com in dark theme, menu open, all four rows fully inside the frame.

Suggested filenames, in that order: `01-action-bar-light.png`, `02-menu-light.png`, `03-sent-toast-light.png`, `04-options.png`, `05-menu-dark.png`.

Screenshots are uploaded on the Store listing tab. They do not go in the extension zip.
