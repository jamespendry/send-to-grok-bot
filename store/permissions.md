# Chrome Web Store: Privacy practices tab and permissions review

Reviewed against extension 1.2.7 (`extension/manifest.json`) and `store/privacy-policy.md`. Paste the quoted text into the dashboard. Everything below the quotes is for you and is not pasted.

## Single purpose

> Adds a Send arrow to posts on X. When you click it, the extension sends that post to the destination you turned on: Grok Bot (or your own webhook), Claude, ChatGPT, or Codex. If more than one is on, you pick one. That is its only purpose.

## Permission justifications

### storage (permissions, manifest.json:7)

> Saves your settings in this browser: which destinations are on, your webhook URL, optional keys and tokens, your reply preset or custom prompt, and an optional Relay connect code. It uses chrome.storage.local, so nothing is synced to a Google account. An older install may have a webhook URL and key in chrome.storage.sync; those are copied to local storage once and then deleted from sync. chrome.storage.session holds one short setup message while the options page opens. The extension has no other use for storage.

Verified: `background.js:42-58,115`, `options.js:292`, `hosts.js:migrate`, `grant.js:23`, `site-connect.js:27`.

### https://api.fxtwitter.com/* and https://api.vxtwitter.com/* (host_permissions, manifest.json:10-11)

> When you click Send, the extension asks these public X mirror services for the full text of that post, the posts it replies to, and any post it quotes, so the destination gets the whole conversation instead of a shortened or cut-off timeline view. The request is a GET with no cookies or account details (credentials are omitted). It sends only the post's public handle and status ID in the address. api.fxtwitter.com is tried first; api.vxtwitter.com is the fallback. It runs only after you click Send, and it times out after about 2.5 seconds, after which the send continues with what the page already showed. These hosts are not contacted at any other time.

Verified: `enrich.js:6-7,90-110,129-170`, `background.js:8-45` (enrichPost is called only from `deliver`, and from `enrichFor` when the menu opens on a click).

### https://*/* (optional_host_permissions, manifest.json:13-15)

> This permission is optional and is not granted at install. The extension never asks for all sites. It exists only so Chrome can let the extension request one host that you type. When you save or paste a destination, the extension calls chrome.permissions.request for exactly the origin that destination needs: the origin of the https webhook you entered; https://api.anthropic.com/* if you saved a Claude routine; https://api.chatgpt.com/* if you saved a ChatGPT Workspace Agent; or your Relay host if you turned on Relay. Chrome shows its Allow prompt for that one site. When you clear a destination and save, the extension removes the host it no longer needs. Opening Claude, ChatGPT, or Codex in a new tab needs no host permission.

Verified: requests are built from `hosts.js:stgbNeededOrigins` (`options.js:173-176`, `grant.js:55`, `background.js:188`); removal at `options.js:258-264`; every call site passes specific origins, never `https://*/*`. A webhook origin is chosen by the user, so it can be any https site, which is why the pattern must be declared.

### Content script: https://x.com/* and https://twitter.com/* (manifest.json:22-23, scripts logos.js, content.js, content.css)

> The Send arrow has to be placed inside the action bar of each post on x.com, so the script runs on x.com. twitter.com is included because it still serves X. It does not run on other sites. The script reads a post only when you click Send on it: its text, link, author, and, when shown, the quoted post, links, and media addresses. On a post's own page it also reads that author's thread and the post being replied to. It does not read direct messages and does not send anything until you click.

Verified: `content.js` (messages at lines 457 and 473 are triggered by the button click); `content.js:217-221` reads author fields from the post.

### Content script: https://sendtogrokbot.com/connect* and https://www.sendtogrokbot.com/connect* (manifest.json:37-38, 39; scripts hosts.js, connect.js, relay.js, site-connect.js)

> This is the extension's own setup page. When you paste a webhook URL or key into the box on sendtogrokbot.com/connect, or open a /connect#code link, the script saves it to chrome.storage.local so you do not have to paste it again in the options page. It shows an extension-owned paste box (grant.html) inside the page and shows a Connected message. It does not read any other page on sendtogrokbot.com, and it does not send the pasted value anywhere. Chrome's Allow prompt for the destination host is shown during your paste or your click on Finish.

Verified: `site-connect.js` (reads only `location.hash` matching `stgb1.` or `stgbr1.` codes, then removes it from the address bar at line 19-20; saves to chrome.storage.local; `onMessage` accepts only messages from the extension's own origin). `grant.js:107-110` accepts a code only from `https://sendtogrokbot.com` or `https://www.sendtogrokbot.com`. Note `manifest.json:39` also matches `https://sendtogrokbot.com/docs/connect*`; see problem 9 below.

### Content script: https://sendtogrokbot.com/* and https://www.sendtogrokbot.com/* (manifest.json:52-53, script site-ready.js)

> The website shows "Installed" and moves you to the next setup step when the extension is present. The script is one line. It sets one attribute (data-stgb-ready="1") on the page's root element. It reads nothing from the page and sends nothing.

Verified: `site-ready.js` is 3 lines, one assignment.

### web_accessible_resources: grant.html (manifest.json:64-71)

> grant.html is the small paste box that the extension inserts into sendtogrokbot.com/connect. It has to be loadable as a frame there, so it is listed for https://sendtogrokbot.com/* and https://www.sendtogrokbot.com/* only. Chrome allows an extension to ask for host access only from an extension page, and a content script cannot ask, so the paste box has to be an extension page. The page contains no secrets, only a text box. Other sites cannot load it.

Verified: `site-connect.js:mount` creates the iframe from `chrome.runtime.getURL('grant.html')`; `grant.js` posts result messages to the parent with targetOrigin `*` (line 15), which carries only a status message and no pasted value.

## Remote code

Select **No, I am not using remote code.**

If a text box is shown:

> All scripts are in the extension package. The extension does not load or run remote scripts, does not use eval or new Function, and does not import code from the network. Responses from webhooks, APIs, and the post mirrors are read only as data.

Verified by grep over `extension/`: no `eval`, `new Function`, `importScripts` of a URL (only local files at `background.js:1`), no dynamic `import()`, no remote `<script src>` in options.html or grant.html. The manifest has no `content_security_policy` override. `innerHTML` is not used in `content.js` (text is set with textContent).

## Data usage

Check:

- **Website content.** The text, link, author, thread, quoted post, links, and media addresses of the post you choose to send. Sent only to the destination you turned on or picked. The post's public URL goes to api.fxtwitter.com and api.vxtwitter.com to fetch the full post.
- **Authentication information.** The webhook key, API token, or Relay code you paste. Kept in chrome.storage.local and sent only as the credential to the destination it belongs to.

Leave unchecked: personally identifiable information, health information, financial and payment information, personal communications, location, web history, user activity. Reasoning: the post URL goes out only as part of the post you chose, and there is no click log or analytics. If a reviewer pushes back on web history, reply that only the single clicked post URL is transmitted and nothing is collected in the background.

Check all three certification boxes. They are accurate for the code. With Relay on, the Relay operator receives the post to forward it, which the policy discloses.

## Privacy policy URL

`https://sendtogrokbot.com/privacy`

## Consistency check against store/privacy-policy.md

| Item | Policy says | Code does | Status |
| --- | --- | --- | --- |
| fxtwitter and vxtwitter mirrors | Disclosed (What is handled, paragraph 2) | Fetches both, `credentials: 'omit'` | Consistent in the policy. The old dashboard section of privacy-policy.md had no justification for these two host permissions. This file adds them. |
| Mirrors receive "only the post's public URL" | Yes | The request path carries the handle and status ID, which are part of that URL. Replied-to post IDs are also requested | Slightly narrower than reality. See fix in "Policy additions". |
| sendtogrokbot.com content scripts | Only "On sendtogrokbot.com/connect, pasting into the box reads that paste" | Also runs `site-ready.js` on every page of the site, and `connect.js` and others on /connect and /docs/connect | Policy omits site-ready.js. Add a sentence. |
| grant.html | Not mentioned | Extension iframe on /connect, web accessible | Policy omits it. Add a sentence. |
| Old optional-host justification | "x.com and twitter.com come from the content script" | True | Fine, but it never listed the mirror hosts. |
| Hosts requested | webhook host, api.anthropic.com, api.chatgpt.com, relay host | Same (`hosts.js:stgbNeededOrigins`) | Consistent. |
| storage.session | Not mentioned | One setup message string | Immaterial. Optional one-clause mention. |
| docs/privacy.html | Same text as the policy for the mirror and relay paragraphs (verified by reading both) | n/a | Must receive the same additions as the policy. |

## Likely review problems and proposed fixes

Ranked most to least likely to cause a rejection or a delay. Proposed fixes are descriptions only. Nothing has been applied.

1. **Optional `https://*/*` host permission.** Severity: medium. Reviewers flag broad host access even when optional. Evidence: `manifest.json:13-15`; every request passes narrow origins (`hosts.js:stgbNeededOrigins`, `options.js:173`, `grant.js:55`, `background.js:188`). Fix: keep it, because a user-typed webhook host cannot be listed in advance, and use the justification above. No code change. Optional hardening: none is cheap.

2. **Content scripts on sendtogrokbot.com, including `https://sendtogrokbot.com/*`.** Severity: medium. Reviewers check that a content script on your own site is needed. Evidence: `manifest.json:36-60`; `site-ready.js` (3 lines). Fix: the justifications above state exactly what each does. To lower the footprint, delete the third content_scripts block and have the site detect the extension from the `/connect` script only. This would mean "Installed" detection on `/` and `/install` stops working, so decide whether you need it.

3. **Third-party mirrors receive the post URL.** Severity: medium. Evidence: `enrich.js:6-7,90-110`, `manifest.json:10-11`, the policy paragraph. Fix: the policy already discloses it. Add the sentences below so the Limited Use section and data-usage answers name the mirrors, and list fxtwitter and vxtwitter as recipients in the "transferred" sentence, which currently names only the webhook, Anthropic, and OpenAI.

4. **User-data policy disclosures.** Severity: medium. Evidence: `store/privacy-policy.md` Limited use section lists only "your webhook, Anthropic, or OpenAI". Fix: add the Policy additions below.

5. **Trademark use of Grok, Claude, ChatGPT, Codex, and X.** Severity: medium. Evidence: the name "Send to Grok Bot" (`manifest.json:3`); brand marks in `logos.js:1-10` (lobehub MIT and Simple Icons CC0 licenses cover the artwork files, not the companies' trademark rights); menu rows read "Send to Claude", "Send to ChatGPT", "Send to Codex". Fix: the name and the menu labels are descriptive ("send to X") but "Grok" appears in the extension name. Keep the "not affiliated" line (now in the listing). Do not use any brand mark in the store icon or promo tiles. Consider whether the four marks in the menu should be replaced by plain text or generic icons if a reviewer or a brand owner objects. This is a legal call for you.

6. **Description mismatch.** Severity: low. Evidence: manifest description (`manifest.json:5`, 99 characters) differs from the store short description. Fix: either leave it, because both are accurate, or replace the manifest `description` line with `"Send any X post to Grok Bot, Claude, ChatGPT, or Codex in one click. Only the post you click is sent."` (101 characters). Note the old description's "native-looking button" phrase is an odd selling point.

7. **web_accessible_resources: grant.html.** Severity: low to medium. Evidence: `manifest.json:64-71`. Scoped to your own origins, not `<all_urls>`. Fix: none required. The risk is that any page on sendtogrokbot.com, if compromised, can frame it. The page only accepts code messages from the two sendtogrokbot.com origins (`grant.js:107-110`).

8. **Remote code, eval, dynamic import.** Severity: none found. Evidence: grep found none (see Remote code). Fix: none.

9. **Permission or pattern with no use.** Severity: low. Evidence: `manifest.json:39` matches `https://sendtogrokbot.com/docs/connect*`. The site is served from `docs/` as its root (README line "docs/ ... the website"), so `/docs/connect` is probably not a live URL. Fix: delete the line `"https://sendtogrokbot.com/docs/connect*"` from the second content_scripts block (it needs a version bump, so combine it with the next release). Also `https://sendtogrokbot.com/connect*` matches `/connectXYZ`, which is harmless. Everything else is used: storage, both mirror hosts, both content-script groups, grant.html.

10. **`grant.js` posts with targetOrigin `*`.** Severity: low. Evidence: `grant.js:15`. The message holds only a status string, no secrets. Fix: optional, change `'*'` to the parent origin sent at message time, but a reviewer is unlikely to flag it.

## Policy additions

Add to `store/privacy-policy.md` and `docs/privacy.html` (keep the two in step), then redeploy the site. Suggested exact sentences:

1. In "What is handled", after the mirrors sentence, replace "Only the post's public URL is sent to them." with:

   > The address of each request holds only the public handle and status ID of the post, and of each post it replies to or quotes. No cookies, account details, or settings are sent.

2. After the paragraph that ends "It does not read other pages on that site.", add:

   > On every page of sendtogrokbot.com, a one-line script sets a single marker on the page so the site can show that the extension is installed. It reads nothing from the page and sends nothing. On /connect, the extension places its own paste box (an extension page, grant.html) in the page. That box is the only place the extension accepts a pasted code from the site, and only from sendtogrokbot.com.

3. In "Limited use", second bullet, replace "the request to your webhook, Anthropic, or OpenAI, or the tab opened on Claude, ChatGPT, or Codex" with:

   > the request to your webhook, Anthropic, or OpenAI, the lookup of the post's public text from api.fxtwitter.com or api.vxtwitter.com, or the tab opened on Claude, ChatGPT, or Codex

4. In "Sites you send to ... keep data under their own policies", add:

   > The public mirrors api.fxtwitter.com and api.vxtwitter.com also keep data under their own policies.

5. Optional, in "How long data stays":

   > One short setup message is held in session storage while the options page opens, and Chrome clears it when the browser closes.

## Bottom line

Nothing in the code is outside what the permissions justify. The main gaps are paperwork: the old dashboard text had no justification for the two mirror hosts, the three sendtogrokbot.com content-script entries, or grant.html, and the policy does not name the mirrors in Limited use or mention site-ready.js and grant.html.
