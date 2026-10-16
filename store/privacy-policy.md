# Privacy policy for Send to Grok Bot

**Effective date:** 16 October 2026
**Publisher:** James Pendry
**Applies to:** the Send to Grok Bot Chrome extension
**This page:** https://sendtogrokbot.com/privacy

Send to Grok Bot adds a button on an X post. When you click it and pick a destination, it sends that post to the destination you set up. This policy says what that handles, where it goes, and what the extension does not do.

## What is handled

The extension handles the post you choose to send. On that post's own page it also reads the author's thread and the post being replied to, because those are already on the page. The payload can include:

- the post text, URL, author handle, and display name
- the time the post was published and the time you sent it
- whether the timeline cut the text off with Show more
- expanded links, a link card, and engagement counts shown on the post
- image addresses and alt text, and video or GIF thumbnails and any caption visible in the player
- a quoted post, the reply parent, and the author's thread on that page
- a plain-text digest of those fields

That data is sent only to a destination you configured and then picked in the menu. Destinations are:

- **Grok Bot, or any other webhook you enter.** The extension POSTs the post as JSON to the https URL you saved. If you saved a key, it is sent on that request as `Authorization: Bearer` and `X-Sender-Key`.
- **Claude.** If you leave the routine fields blank, the extension opens a claude.ai tab with the post in the address. If you save a routine URL and token, it POSTs the post to `api.anthropic.com` and sends the token as the credential for that request.
- **ChatGPT.** If you leave the agent fields blank, the extension opens a chatgpt.com tab with the post in the address. If you save a Workspace Agent trigger and token, it POSTs the post to `api.chatgpt.com` and sends the token as the credential for that request.
- **Codex.** The extension opens a chatgpt.com/codex tab with the post in the address. You press Send there.

The extension does not read your direct messages or pages outside X. It reads a post when you click Send on it, and on a post's own page it also reads the author's thread and the reply parent shown there.

## Tokens and keys

Webhook keys and API tokens are stored in `chrome.storage.local` on this device. They are not synced to a Google account. If an older version of the extension still has a webhook URL and key in `chrome.storage.sync`, those two values are copied to local storage once and then deleted from sync.

A token is sent only to the destination it belongs to, and only as the credential on that request. With Relay left off, the publisher does not receive tokens, keys, or posts. The extension has no account system of its own.

## Relay

Relay is off unless you check it and paste a connect code. That code points at a relay you choose, such as https://relay.sendtogrokbot.com. The extension then sends the post to that relay, which forwards it to the Grok Bot webhook or Claude routine saved there. The webhook key and Claude token are stored encrypted on the relay and are not written to its logs. The relay keeps the time, destination, link, author, and result of recent sends. It does not keep the post text. ChatGPT and Codex still open a tab on this computer and do not go through the relay. Leave Relay off and the extension talks only to the destination you set up.

## What the extension does not do

- It does not use analytics, advertising, or tracking.
- It does not sell data, and it does not transfer data for advertising, profiling, credit, or lending.
- It does not collect your name, email, phone number, location, health information, or payment information.
- It does not keep a browsing history. The post URL is sent only as part of the post you chose.
- It does not keep a copy of the post after the request is made or the tab is opened.

Sites you send to (your webhook, Anthropic, OpenAI, or X) keep data under their own policies. The publisher does not control that.

## How long data stays

The post is held in memory only long enough to send it or to open the tab. Tokens, the webhook URL, optional prompts, and which destinations are checked stay in local storage until you change them, clear them and click Save, or remove the extension. Removing the extension deletes its local storage. Clicking Save after you clear a destination also drops Chrome's permission for that site.

## Limited use

The extension complies with the Chrome Web Store User Data Policy, including Limited Use:

- Data is used only to send the post you chose to the destination you chose.
- Data is transferred only when that transfer is the feature you asked for: the request to your webhook, Anthropic, or OpenAI, or the tab opened on Claude, ChatGPT, or Codex. It is also transferred if the law requires it, or to protect security. There is no other transfer.
- Data is not used or transferred for personalized, re-targeted, or interest-based ads.
- With Relay left off, the publisher does not have a server that receives this data, and no person at the publisher reads the posts you send. With Relay on, the post goes to the relay address in your connect code, which forwards it and does not keep the post text.

## Contact

James Pendry, publisher of Send to Grok Bot. Use the support contact on the Chrome Web Store listing, or the project repository at https://github.com/jamespendry/send-to-grok-bot.

This extension is not affiliated with X, xAI, Anthropic, or OpenAI.

---

# Chrome Web Store dashboard — Privacy practices tab

Do not publish this section on sendtogrokbot.com. Paste it into the Privacy practices tab. The hosted page is the policy above, and nothing below the line.

## Single purpose

Paste this into **Single purpose description**:

> Adds one button on an X post. When you click it and choose a destination you have set up, it sends that post to Grok Bot, Claude, ChatGPT, or Codex. That is its only purpose.

## Permission justifications

The dashboard lists one box per permission it finds in the manifest. Paste the matching text. If two content-script hosts are combined into one box, paste both host paragraphs into that box.

**storage**

> Stores, on this device only, the destinations you check, your webhook URL, optional prompts, and any webhook key or API token you paste. chrome.storage.local is used so these values are not synced to a Google account. If an older install still has a webhook URL or key in chrome.storage.sync, that pair is copied to local storage once and then deleted. The publisher has no server and never receives these values.

**https://x.com/\*** (content script)

> The button is added to posts on x.com. The script does not run on other sites. It reads a post only after you click Send on that post, including text, link, author, and the thread, quote, links, and media the page already shows. On a post's own page it also reads the author's thread and the reply parent. It sends that only to the destination you then pick.

**https://twitter.com/\*** (content script)

> Same behavior on twitter.com, which still serves X. The script does not run on other sites. It reads a post only after you click Send on it.

**https://\*/\*** (optional host permission)

> The extension does not read all websites. This pattern is optional. Chrome requires it so an extension can ask, at runtime, for a host the user types. The code never requests https://*/* itself. When you click Save, it asks only for the origins that destination needs: the origin of the https webhook you entered; https://api.anthropic.com/* if a Claude routine URL or token is saved; https://api.chatgpt.com/* if a ChatGPT agent trigger or token is saved; or the relay host if Relay is on. With Relay on, the webhook host and api.anthropic.com are not requested, because those calls are made by the relay. Opening Claude, ChatGPT, or Codex in a tab does not use a host permission. Clearing a destination and clicking Save removes that host. x.com and twitter.com come from the content script, not from this permission.

## Remote code

Select **No, I am not using remote code.**

If a text box is shown anyway, paste:

> Every script is in the extension package. The extension does not load remote scripts, use eval, or run responses. Webhook and API responses are read as data.

## Data usage

Check these:

- **Website content.** The text, URL, author, thread, quote, links, and media addresses of the post you choose to send. On a post's own page this includes the author's thread and the reply parent shown there. It is transmitted only to the destination you configured and picked.
- **Authentication information.** The webhook key or API token you paste. It is stored in chrome.storage.local and sent only as the credential on the request to that destination. The publisher does not receive it.

Leave these unchecked:

- Personally identifiable information. The extension does not collect your name, email, phone, or account. The author's public handle is part of the post and is covered by website content.
- Health information.
- Financial and payment information.
- Personal communications.
- Location.
- Web history. Only the URL of the post you click is sent, as part of that post.
- User activity. There is no analytics, click log, or key logging.

Check all three certification boxes. They match the extension:

- I do not sell or transfer user data to third parties, outside of the approved use cases. The only transfer is the post you chose, to the destination you configured. That transfer is the feature. Nothing is sold, and the publisher receives nothing.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

## Privacy policy URL

`https://sendtogrokbot.com/privacy`

Host the policy above at that URL before you submit. The dashboard checks that the URL is public, and the disclosures there have to match this tab and the extension.
