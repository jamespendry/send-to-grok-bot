# Publish the iPhone shortcut

`shortcuts/build.py` writes the editable source, `shortcuts/Send to Grok Bot.shortcut` (unsigned XML). iOS refuses unsigned files, so the site serves `shortcuts/Send to Grok Bot (signed).shortcut`. After any change, rebuild and re-sign on a Mac signed in to iCloud:

```bash
python3 shortcuts/build.py && plutil -convert binary1 -o /tmp/in.shortcut "shortcuts/Send to Grok Bot.shortcut" && shortcuts sign --mode anyone --input /tmp/in.shortcut --output "shortcuts/Send to Grok Bot (signed).shortcut"
```

The name has to stay **Send to Grok Bot**. That is the label in the X share sheet.

The first action is a Text box holding a connect code (`stgbr1.…`, from relay.sendtogrokbot.com). One import question fills it when the shortcut is added; it defaults to `none`, because a blank import question broke every run.

- **With a code:** the shortcut skips the menu and posts the shared text to `https://relay.sendtogrokbot.com/v1/send` with `format: "text"` and the code as the bearer. The relay finds the post link, adds the full context (fxtwitter, then vxtwitter), forwards it to the saved Grok Bot webhook, and answers with one line that the shortcut shows as a notification. The person never leaves X.
- **Without a code:** it asks which AI and posts the link to `https://relay.sendtogrokbot.com/v1/open`, which stores nothing. Claude and ChatGPT get `openUrl`, a link that opens the app with the post filled in. Grok Bot gets `copyText`; the shortcut copies it and opens `grokbot://`, which only reaches Grok Bot's home screen (Grok Bot has no link into a chat), so the person pastes. The share sheet was tried and dropped: too many taps.

The install link is the signed file, served from the site: https://sendtogrokbot.com/send-to-grok-bot.shortcut

## What you do on the iPhone

1. On the iPhone, open https://sendtogrokbot.com/mobile and tap Install Send to Grok Bot.
2. Tap Add Shortcut.
3. In the X app, tap Share on a post, then Send to Grok Bot. Pick Grok Bot, Claude, or ChatGPT.
4. Claude and ChatGPT open with the post filled in. Press Send. For Grok Bot without a code, open a chat in Grok Bot and paste.
5. With a code: replace `none` in the first box with the code from relay.sendtogrokbot.com, share a post, and check the "Sent to Grok Bot" notice and the reply in the routine's Grok Bot chat.
