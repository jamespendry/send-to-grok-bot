# Publish the iPhone shortcut

`shortcuts/build.py` writes the editable source, `shortcuts/Send to Grok Bot.shortcut` (unsigned XML). iOS refuses unsigned files, so the site serves `shortcuts/Send to Grok Bot (signed).shortcut`. After any change, rebuild and re-sign on a Mac signed in to iCloud:

```bash
python3 shortcuts/build.py && plutil -convert binary1 -o /tmp/in.shortcut "shortcuts/Send to Grok Bot.shortcut" && shortcuts sign --mode anyone --input /tmp/in.shortcut --output "shortcuts/Send to Grok Bot (signed).shortcut"
```

The name has to stay **Send to Grok Bot**. That is the label in the X share sheet.

The shortcut needs no code and stores nothing. It posts the shared link and the chosen AI to `https://relay.sendtogrokbot.com/v1/open`. The relay looks up the post (fxtwitter, then vxtwitter) and returns `openUrl`, a link that opens Claude or ChatGPT with the post filled in. For Grok Bot it returns `copyText`, which the shortcut copies, and `grokbot://`, which opens the app.

The install link is the signed file, served from the site: https://sendtogrokbot.com/send-to-grok-bot.shortcut

## What you do on the iPhone

1. On the iPhone, open https://sendtogrokbot.com/mobile and tap Install Send to Grok Bot.
2. Tap Add Shortcut.
3. In the X app, tap Share on a post, then Send to Grok Bot. Pick Grok Bot, Claude, or ChatGPT.
4. Claude and ChatGPT open with the post filled in. Press Send. For Grok Bot, paste the copied message and send.
