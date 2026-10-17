# Publish the iPhone shortcut

The shortcut is an unsigned Shortcuts file: `shortcuts/Send to Grok Bot.shortcut`. The name has to stay **Send to Grok Bot**. That is the label in the X share sheet.

Apple does not let this repository mint an iCloud link. The install link is the file itself, served from the site:

https://sendtogrokbot.com/send-to-grok-bot.shortcut

`scripts/build-site.sh` copies the shortcut into the site. The site sends it as a download (`docs/_headers`). Deploy with the commands in the repository README. Until that deploy, the link 404s.

## What you do on the iPhone

1. On a computer, open https://relay.sendtogrokbot.com and copy the code. It starts with `stgbr1.`. Save Grok Bot or Claude on that page if you want those. ChatGPT and Codex need nothing saved. This is the only code.
2. On the iPhone, tap https://sendtogrokbot.com/send-to-grok-bot.shortcut.
3. Tap the downloaded file, then tap Add Shortcut.
4. When Shortcuts asks, paste the code. Paste it once. Do not paste a webhook URL or a key.
5. If iOS says the shortcut is untrusted, open Settings, tap Shortcuts, and turn on **Allow Untrusted Shortcuts**. Tap the link again. If that switch is missing, open the downloaded file from the Files app and tap Add Shortcut.
6. In the X app, open a post and tap Share. Tap **Send to Grok Bot**. Pick Grok Bot, Claude, ChatGPT, or Codex.
7. A notification names what happened. ChatGPT and Codex then open with the post filled in. You press Send in that app. Grok Bot and Claude are sent for you.

The same page is https://sendtogrokbot.com/mobile.

## If the file will not import

Build the same shortcut by hand. Add the actions in this order. Names in bold are the Shortcuts actions.

1. Open Shortcuts and tap the plus button.
2. Tap the name at the top and rename it to `Send to Grok Bot`.
3. Tap the info button. Turn on **Show in Share Sheet**. Accept URLs, text, and Safari web pages. Tap Done.
4. Add **Text**. Leave it as the first action. Paste the relay code into it. This is the only secret in the shortcut.
5. Add **Set Variable**. Name it `Relay Code`.
6. Add **Get URLs from Input**. Set Input to Shortcut Input.
7. Add **Set Variable**. Name it `Links`.
8. Add **If**. Set it to `Links` **has any value**.
9. Inside that If, add **Get Item from List**. Choose First Item. Set the input to `Links`.
10. Add **Set Variable**. Name it `Post URL`.
11. Add **Choose from Menu**. Prompt: `Send this post to`. The four lines are `Grok Bot`, `Claude`, `ChatGPT`, and `Codex`.
12. Under Grok Bot, add **Text** with the exact text `grokbot`, then **Set Variable** named `Destination`.
13. Under Claude, **Text** `claude`, then **Set Variable** `Destination`.
14. Under ChatGPT, **Text** `chatgpt`, then **Set Variable** `Destination`.
15. Under Codex, **Text** `codex`, then **Set Variable** `Destination`.
16. Below **End Menu**, still inside the If, add **Get Contents of URL**.
    - URL: `https://relay.sendtogrokbot.com/v1/send`
    - Method: POST
    - Headers: `Authorization` is the word `Bearer`, a space, then the `Relay Code` variable. `Content-Type` is `application/json`.
    - Request Body: JSON
    - `destination` is the `Destination` variable
    - `url` is the `Post URL` variable
    - `source` is the text `shortcut`
17. Add **Get Dictionary from Input**.
18. Add **Set Variable** named `Response`.
19. Add **Get Dictionary Value**. Key `notice`. Input `Response`. Then **Set Variable** named `Notice`.
20. Add **Get Dictionary Value**. Key `openUrl`. Input `Response`. Then **Set Variable** named `Open URL`.
21. Add **Show Notification**. Title `Send to Grok Bot`. Body is the `Notice` variable.
22. Add **If**. `Open URL` **has any value**. Inside it, add **Open URLs** and pass the `Open URL` variable.
23. In the Otherwise of the first If, add **Show Notification**. Title `Send to Grok Bot`. Body: `No post link was shared.`

## A signed iCloud link, later

iOS sometimes refuses an unsigned file, and `shortcuts://import-shortcut` only accepts an iCloud link. This repository cannot create that link. On a Mac, after the shortcut imports:

1. Open the shortcut in Shortcuts.
2. Tap the Share button.
3. Tap **Copy iCloud Link**.
4. Replace the href of `#install-link` in `docs/mobile.html` with that `https://www.icloud.com/shortcuts/` URL, then deploy the site again.

Do not put a relay code, a webhook, or a token in the shortcut file in this repository. Each person pastes their own code when they add the shortcut.
