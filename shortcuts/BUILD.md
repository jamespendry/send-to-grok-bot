# Publish the iPhone shortcut

`shortcuts/build.py` writes the editable source, `shortcuts/Send to Grok Bot.shortcut` (unsigned XML). iOS refuses unsigned files, so the site serves `shortcuts/Send to Grok Bot (signed).shortcut`. After any change, rebuild and re-sign on a Mac signed in to iCloud:

```bash
python3 shortcuts/build.py && plutil -convert binary1 -o /tmp/in.shortcut "shortcuts/Send to Grok Bot.shortcut" && shortcuts sign --mode anyone --input /tmp/in.shortcut --output "shortcuts/Send to Grok Bot (signed).shortcut"
```

The name has to stay **Send to Grok Bot**. That is the label in the X share sheet.

There is no import question (a blank one broke every run). Setup happens on sendtogrokbot.com/mobile: its Finish button opens `shortcuts://run-shortcut?name=Send%20to%20Grok%20Bot&input=text&text=<connect code>`, so the code (`stgbr1.…`) arrives in the link itself; iPhone browsers did not fill the clipboard reliably. When the input contains `stgbr1.`, the shortcut saves it to `Send to Grok Bot/connect-code.txt` in the Shortcuts folder of iCloud Drive, then posts `{"test": "setup"}` to `/v1/send`, which sends Grok Bot a test message and answers "Connected…". That brings up iOS's one-time permission questions during setup. Run with no input at all, the shortcut says "Nothing came through" instead of showing the menu. sendtogrokbot.com/iphone-test checks copy, paste and this handoff on a real iPhone.

- **With a saved code:** the shortcut skips the menu and posts the shared text to `https://relay.sendtogrokbot.com/v1/send` with `format: "text"` and the code as the bearer. The relay finds the post link, adds the full context (fxtwitter, then vxtwitter), forwards it to the saved Grok Bot webhook, and answers with one line that the shortcut shows as a notification. The person never leaves X.
- **Without a code:** it asks which AI and posts the link to `https://relay.sendtogrokbot.com/v1/open`, which stores nothing. Claude and ChatGPT get `openUrl`, a link that opens the app with the post filled in. Grok Bot gets `copyText`; the shortcut copies it and opens `grokbot://`, which only reaches Grok Bot's home screen (Grok Bot has no link into a chat), so the person pastes. The share sheet was tried and dropped: too many taps.

The install link is the signed file, served from the site: https://sendtogrokbot.com/send-to-grok-bot.shortcut

## What you do on the iPhone

1. On the iPhone, open https://sendtogrokbot.com/mobile and tap Install Send to Grok Bot.
2. Tap Add Shortcut.
3. In the X app, tap Share on a post, then Send to Grok Bot. Pick Grok Bot, Claude, or ChatGPT.
4. Claude and ChatGPT open with the post filled in. Press Send. For Grok Bot without a code, open a chat in Grok Bot and paste.
5. Connected: run steps 2 to 4 on sendtogrokbot.com/mobile, check "Connected to Grok Bot", share a post, and check the "Sent to Grok Bot" notice and the reply in the routine's Grok Bot chat.
