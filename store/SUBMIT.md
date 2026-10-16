# Submit Send to Grok Bot to the Chrome Web Store

This is the path from this repo to a public listing. The extension code and the zip can be prepared here. The account, the payment, the live privacy page, the x.com screenshots, and the submit click have to be you.

This package is built on the extension in pull request #1 (Claude, ChatGPT, and Codex), plus the store files in `store/`.

## 1. Register a developer account

1. Open https://chrome.google.com/webstore/devconsole while signed in to the Google account you want as the publisher.
2. The first visit shows the registration screen. Read the developer agreement and accept it.
3. Pay the one-time registration fee of $5. You do not pay it again for later updates.
4. Use an email you will keep and actually read. Review results, takedown warnings, and policy mail go there. The publisher email cannot be changed later. Changing it means a new account and a transfer.
5. Registration is only offered in some countries. If yours is not on the list, the dashboard will not let you finish.

A new publisher can only have a small number of public extensions. Google's current default is two. One listing is inside that limit.

## 2. Publish the privacy policy

Host the policy at the top of `store/privacy-policy.md` at:

https://sendtogrokbot.com/privacy

Publish the policy only. Stop before the heading "Chrome Web Store dashboard — Privacy practices tab". That section is for the form, not the website.

The URL has to be public before you submit. The dashboard checks it. If you have a support email you will actually read, add it to the Contact section before you publish the page.

## 3. Build the zip

From the repo root:

```bash
scripts/package.sh
```

That writes `dist/send-to-grok-bot-1.2.1.zip`. The manifest is at the top of the zip. The zip does not contain `store/`, the README, or screenshots. Do not add a `.pem` key.

Version in this upload is `1.2.1`.

## 4. Create the item and upload

1. In the developer dashboard, choose **Add new item** and upload the zip.
2. Chrome runs an install check as soon as the zip is uploaded. If that check fails, fix the package and upload again before you submit for review.
3. Leave the item as a draft until the tabs below are filled in.

## 5. Store listing tab

Copy from `store/listing.md`:

- Name: Send to Grok Bot
- Summary: the short description (99 characters)
- Description: the detailed description
- Category: Productivity
- Language: English

Then upload:

- Small promo tile: `store/promo/tile-440x280.png` (required)
- Marquee: `store/promo/marquee-1400x560.png`
- The five screenshots listed in `store/listing.md`, in that order, once you have taken them

You cannot submit with zero screenshots. The promo tile is also required. The marquee is what the store needs in order to feature the item.

Leave the homepage and support URL as pages you control. The GitHub repository is a fine support URL until you have another. Do not point support at an inbox you do not read.

## 6. Privacy practices tab

Copy from the dashboard section of `store/privacy-policy.md`:

- Single purpose
- A justification for each permission the form lists (`storage`, the x.com and twitter.com content-script hosts, and the optional `https://*/*` host permission)
- Remote code: **No, I am not using remote code**
- Data usage: check **Website content** and **Authentication information** only, then check all three certification statements
- Privacy policy: `https://sendtogrokbot.com/privacy`

The form will not submit if a justification box is empty.

## 7. Distribution tab

- Visibility: Public, unless you want a trusted-testers draft first
- Pricing: Free
- Countries: all, unless you have a reason to limit them

This extension is not for sale. Do not turn on payments.

## 8. Test instructions tab

Paste this so the reviewer can try the extension without your tokens:

```
Load the extension and open its options from the toolbar icon.
The notice at the top says what is sent. Click Save after checking a destination.

Check Send to Claude and leave the routine fields blank, then Save.
Chrome should not ask for access to a website for this path.
Open https://x.com, click the Send button on a post (the arrow in the action bar), and choose Send to Claude.
A claude.ai tab opens with the post in the prompt. Nothing is sent to Anthropic until you press Send on that site.

Optional: check Send to Grok Bot, paste an https webhook you control, and click Save.
Chrome asks to read and change data only on that host. Choose Allow.
Click Send to Grok Bot on a post. The webhook receives version 2 JSON, including source, url, text, author, digest, and sentAt, plus media and thread fields when the page shows them.

ChatGPT with the agent fields blank opens chatgpt.com the same way Claude opens a tab.
Codex opens https://chatgpt.com/codex with the prompt filled in.
Do not use a real API token. The tab paths are enough to see the extension work.
```

## 9. Submit

1. Click **Submit for review**.
2. On the confirm dialog, decide whether the item should publish as soon as review passes. If you clear that checkbox, you have 30 days after approval to publish it yourself. After 30 days the approval expires and you submit again.
3. Watch the publisher email. That is where a rejection or a question arrives.

## How long review takes

Most extensions are reviewed within a few days. Some take up to a few weeks. There is no paid faster queue.

This submission is a new item from a new publisher, and the manifest still contains the optional pattern `https://*/*`. Google's review notes say broad host patterns take longer to review, because the same pattern can be used to read every site. The code does not do that: Save asks only for the one host you typed, or for `api.anthropic.com` or `api.chatgpt.com` when those destinations need a request. That justification is in the Privacy practices tab. Expect a person to read it.

If the item is still pending after three weeks, contact Chrome Web Store developer support from the dashboard and ask them to look.

Promo images are reviewed on their own, often within a week. A rejected image does not by itself unpublish the extension. The dashboard shows the image status on the listing. Fix the image and upload it again if it is rejected.

A rejection email names the policy and how to appeal. Appeal from the item page in the dashboard. Do not upload a new zip as a way around a rejection unless the email tells you to fix the item and resubmit.

## What can slow permission review

- **Optional `https://*/*`.** This is the one permission that can add days. It has to stay. Chrome only allows a runtime request for a webhook host you type if that pattern is declared. The extension requests a single origin, never the wildcard. Removing the pattern would break webhooks on Zapier, Make, n8n, and your own server. Replacing it with a required `https://*/*` would be worse: every install would warn "Read and change all your data on all websites," and review would still be slow.
- **Content scripts on x.com and twitter.com.** These show an install warning limited to those two sites. That matches the button. It should not be controversial. Do not add more sites.
- **`storage`.** No install warning. It holds settings and tokens locally.
- Nothing else is requested. There is no `tabs`, `scripting`, `history`, `cookies`, `webRequest`, or `<all_urls>` grant at install. Do not add them to get a review through faster.

The in-product notice on the options page is there because the store requires a disclosure inside the extension, not only in this policy. Leave it in place.
