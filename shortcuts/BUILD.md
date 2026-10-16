# Publish the iPhone shortcut

The shortcut is an unsigned Shortcuts file: `shortcuts/Send to Grok Bot.shortcut`. Apple does not let a repository mint the iCloud install link. You import or rebuild the shortcut on a phone or a Mac, then Shortcuts creates the link.

The name has to stay **Send to Grok Bot**. That is the label in the X share sheet.

## Install the file

1. Copy `shortcuts/Send to Grok Bot.shortcut` onto the iPhone (AirDrop, Mail, or the Files app).
2. Tap the file. Shortcuts asks to add **Send to Grok Bot**.
3. If iOS refuses it, open Settings, tap Shortcuts, and turn on **Allow Untrusted Shortcuts**. Tap the file again.
4. When it asks, paste the relay code from https://relay.sendtogrokbot.com. The code starts with `stgbr1.`. Paste it once. Do not paste a webhook URL or a key.

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

## Copy the iCloud link

1. Open the shortcut in Shortcuts.
2. Tap the Share button.
3. Tap **Copy iCloud Link**.
4. The link looks like `https://www.icloud.com/shortcuts/` followed by a code Apple assigns. There is no way to know that code before this step.
5. In `docs/mobile.html`, replace the paragraph whose id is `install-link` with a link to that URL:

```html
<p id="install-link"><a href="PASTE_THE_ICLOUD_LINK">Install Send to Grok Bot</a></p>
```

6. Deploy the site again with the commands in the repository README. Until that link is pasted, the mobile page says the install link is not published yet.

Do not put a relay code, a webhook, or a token in the shortcut file in this repository. Each person pastes their own code when they add the shortcut.
