# Submit Send to Grok Bot to the Chrome Web Store

Click-by-click for the developer dashboard. Every value is ready to paste. Nothing here submits for you. Version in this upload: **1.2.7**.

Before you start:

1. The upload zip is `dist/send-to-grok-bot-1.2.7.zip` (66,960 bytes, 25 files). Rebuild with `scripts/package.sh` if the extension changes. The script checks the manifest, file list, size, icons, and that there is no remote code.
2. This branch edits the privacy policy (new disclosure sentences, see `store/permissions.md`, "Policy additions"). Merge this PR and deploy the site first, so https://sendtogrokbot.com/privacy matches what you tell the dashboard. Reviewers read that page.
3. Sign in to https://chrome.google.com/webstore/devconsole with the Google account that holds the developer registration. Review mail goes to that account's contact email.

## 1. Upload the package

1. Items, then **Add new item**.
2. Choose `dist/send-to-grok-bot-1.2.7.zip` and upload. Chrome runs an install check. If it fails, stop and fix the package.
3. The item opens as a draft. Fill in the tabs below.

## 2. Store listing tab

1. **Description**: paste.

```
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
```

2. **Category**: Productivity.
3. **Language**: English.
4. **Store icon**: from the package (`extension/icons/icon128.png`). If asked, upload that file.
5. **Screenshots**, in this order (1280x800), from `store/screenshots/`:
   1. `01-send-button.png`
   2. `02-destination-menu.png`
   3. `03-reply-in-claude.png`
   4. `04-options.png`
   5. `05-connected.png`
6. **Small promo tile** (required): `store/promo/tile-440x280.png`.
7. **Marquee promo tile**: `store/promo/marquee-1400x560.png`.
8. **Official URL / Homepage**: `https://sendtogrokbot.com`
9. **Support URL**: `https://github.com/jamespendry/send-to-grok-bot`
10. **Summary** (short description, 101 characters). The dashboard may fill this from the manifest; if so, replace it with:

```
Send any X post to Grok Bot, Claude, ChatGPT, or Codex in one click. Only the post you click is sent.
```

    The manifest description (shown at install) is "Adds a native-looking button to X posts that sends the post to Grok Bot, Claude, ChatGPT, or Codex." Both are accurate. See "Decisions" below.

## 3. Privacy practices tab

1. **Single purpose description**:

```
Adds a Send arrow to posts on X. When you click it, the extension sends that post to the destination you turned on: Grok Bot (or your own webhook), Claude, ChatGPT, or Codex. If more than one is on, you pick one. That is its only purpose.
```

2. **storage justification**:

```
Saves your settings in this browser: which destinations are on, your webhook URL, optional keys and tokens, your reply preset or custom prompt, and an optional Relay connect code. It uses chrome.storage.local, so nothing is synced to a Google account. An older install may have a webhook URL and key in chrome.storage.sync; those are copied to local storage once and then deleted from sync. chrome.storage.session holds one short setup message while the options page opens. The extension has no other use for storage.
```

3. **Host permission justification** (the form lists the hosts together; paste both blocks):

```
When you click Send, the extension asks these public X mirror services for the full text of that post, the posts it replies to, and any post it quotes, so the destination gets the whole conversation instead of a shortened or cut-off timeline view. The request is a GET with no cookies or account details (credentials are omitted). It sends only the post's public handle and status ID in the address. api.fxtwitter.com is tried first; api.vxtwitter.com is the fallback. It runs only after you click Send, and it times out after about 2.5 seconds, after which the send continues with what the page already showed. These hosts are not contacted at any other time.
```

```
The Send arrow has to be placed inside the action bar of each post on x.com, so the script runs on x.com. twitter.com is included because it still serves X. It does not run on other sites. The script reads a post only when you click Send on it: its text, link, author, and, when shown, the quoted post, links, and media addresses. On a post's own page it also reads that author's thread and the post being replied to. It does not read direct messages and does not send anything until you click.
```

4. **Optional host permission `https://*/*`** (if the form asks):

```
This permission is optional and is not granted at install. The extension never asks for all sites. It exists only so Chrome can let the extension request one host that you type. When you save or paste a destination, the extension calls chrome.permissions.request for exactly the origin that destination needs: the origin of the https webhook you entered; https://api.anthropic.com/* if you saved a Claude routine; https://api.chatgpt.com/* if you saved a ChatGPT Workspace Agent; or your Relay host if you turned on Relay. Chrome shows its Allow prompt for that one site. When you clear a destination and save, the extension removes the host it no longer needs. Opening Claude, ChatGPT, or Codex in a new tab needs no host permission.
```

5. **sendtogrokbot.com content scripts** (if the form asks, or for the reviewer notes):

```
This is the extension's own setup page. When you paste a webhook URL or key into the box on sendtogrokbot.com/connect, or open a /connect#code link, the script saves it to chrome.storage.local so you do not have to paste it again in the options page. It shows an extension-owned paste box (grant.html) inside the page and shows a Connected message. It does not read any other page on sendtogrokbot.com, and it does not send the pasted value anywhere. Chrome's Allow prompt for the destination host is shown during your paste or your click on Finish.
```

```
The website shows "Installed" and moves you to the next setup step when the extension is present. The script is one line. It sets one attribute (data-stgb-ready="1") on the page's root element. It reads nothing from the page and sends nothing.
```

```
grant.html is the small paste box that the extension inserts into sendtogrokbot.com/connect. It has to be loadable as a frame there, so it is listed for https://sendtogrokbot.com/* and https://www.sendtogrokbot.com/* only. Chrome allows an extension to ask for host access only from an extension page, and a content script cannot ask, so the paste box has to be an extension page. The page contains no secrets, only a text box. Other sites cannot load it.
```

6. **Remote code**: select **No, I am not using remote code**. If a text box appears:

```
All scripts are in the extension package. The extension does not load or run remote scripts, does not use eval or new Function, and does not import code from the network. Responses from webhooks, APIs, and the post mirrors are read only as data.
```

7. **Data usage**: check **Website content** and **Authentication information** only. Leave the other seven unchecked.
8. Check all three certifications: not sold to third parties, not used for unrelated purposes, not used for creditworthiness or lending.
9. **Privacy policy URL**: `https://sendtogrokbot.com/privacy`

## 4. Distribution tab

1. Visibility: **Public**.
2. Pricing: **Free**.
3. Regions: **All regions**.

## 5. Test instructions tab

The reviewer needs no account or token. Paste:

```
Load the extension. Open https://sendtogrokbot.com/connect if you are trying Grok Bot.
With one destination on, the arrow on a post sends on the first click. A menu appears only when two or more destinations are on.

Check Send to Claude and leave the routine fields blank, then Save.
Chrome should not ask for access to a website for this path.
Open https://x.com and click the Send button on a post (the arrow in the action bar).
A claude.ai tab opens with the post in the prompt. Nothing is sent to Anthropic until you press Send on that site.

Optional: on the connect page, paste an https webhook you control and a line that says Authorization: Bearer, then your key.
Chrome asks to read and change data only on that host. Choose Allow. The page says to open x.com and click the arrow.
Click the arrow on a post. The webhook receives version 2 JSON, including source, url, text, author, digest, and sentAt, plus media and thread fields when the page shows them.

ChatGPT with the agent fields blank opens chatgpt.com the same way Claude opens a tab.
Codex opens https://chatgpt.com/codex with the prompt filled in.
Do not use a real API token. The tab paths are enough to see the extension work.
```

## 6. Submit

1. Click **Submit for review**.
2. In the confirm dialog, leave "publish automatically after review" checked unless you want to time the launch. If you clear it, you have 30 days after approval to publish.
3. Watch the contact email for a rejection or a question. Appeal from the item page. Do not upload a new zip to get around a rejection unless the email says to.

## What could cause a rejection or delay

Full list with evidence and fixes: `store/permissions.md`. In short:

- **Optional `https://*/*`** (medium). Slows review. Needed so a user-typed webhook host can be requested at runtime. The code never requests the wildcard. Keep it; the justification above is the answer.
- **Content scripts on sendtogrokbot.com** (medium). Both are justified above. Dropping the one-line `site-ready.js` block would shrink the footprint but stops "Installed" detection on the site.
- **Mirrors api.fxtwitter.com and api.vxtwitter.com** (medium). Receive the post handle and status ID. Now disclosed in the policy and justified above.
- **Trademarks in the name, menu labels, and logos** (medium). "Grok" is in the name. Keep the not-affiliated line. Your call.
- **Policy not deployed** (high if skipped). The dashboard answers assume the updated policy text from this PR is live.
- Low: manifest `description` differs from the store summary; unused match `https://sendtogrokbot.com/docs/connect*`; `grant.js` posts a status message with target origin `*`.

Review usually takes a few days, sometimes weeks for a new publisher with a broad optional host pattern. If it is still pending after three weeks, contact developer support from the dashboard.

## Decisions for James

1. **Manifest description.** Keep "Adds a native-looking button..." (no code change), or change `extension/manifest.json` line 5 to the summary above and bump the version. Recommended: leave it for this first upload.
2. **Delete the dead match** `https://sendtogrokbot.com/docs/connect*` at the next release (needs a version bump).
3. **Trademark risk.** Decide whether to keep the four brand marks in the menu as they are.
4. **Screenshots 03, 04, 05.** 03 is a crop of a real Claude reply with a stray text cursor. 04 hides parts of the options page to fit. 05's Connected box is injected with the extension's own markup, since a real connect needs a secret. See `store/screenshots/README.md`. Retake with a real connect if you want them untouched.
