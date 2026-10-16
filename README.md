# Send to Grok Bot

A small Chrome (Manifest V3) extension that adds a native-looking "Send to Grok Bot" icon to the action bar of every post on x.com. One click sends that post to a Grok Bot routine webhook, so your bot can research it, file it, or act on it. Any webhook that accepts JSON works too (Zapier, Make, n8n, your own server).

## Install (unpacked)
1. Download or clone this repo (or unzip `send-to-grok-bot.zip`).
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the `extension` folder.

## Configure
1. In Grok Bot, create a routine with a webhook trigger and copy its webhook URL and key.
2. Click the extension's toolbar icon (or Details > Extension options).
3. Paste the URL and, optionally, the key, then click **Save**.
4. Refresh x.com. Click the arrow icon in the post's action bar — it uses the same slot, hit area, and icon size as Share. It turns green when sent, red if it failed. A brief toast at the bottom center of the page reads “Sent to Grok Bot”, then fades out after about 3 seconds. If the send fails, the same toast shows the error message on a red background.

## Payload
`POST` with `Content-Type: application/json`:
```json
{
  "source": "x",
  "url": "https://x.com/user/status/123",
  "text": "Post text",
  "author": "user",
  "sentAt": "2026-10-15T23:00:00.000Z"
}
```
If a key is set it is sent as both `Authorization: Bearer <key>` and `X-Sender-Key: <key>`.

## Privacy
The extension sends only the posts you click, and only to the webhook you configure. It does not track browsing, collect analytics, or read anything else. Settings are stored in `chrome.storage.sync`.

## License
MIT
