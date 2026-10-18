# Send to Grok Bot plugin

This is the marketplace plugin for Grok Bot and Cursor. The Chrome extension lives in `extension/` at the repository root. This folder is the plugin.

It has one skill, `send-to-grok-bot`. The skill creates a webhook routine named Send to Grok Bot and puts the General prompt on it. The bot cannot read the webhook key, so it cannot build a connect link. After the routine exists, it sends one message: install the extension first at sendtogrokbot.com/install, open the routine from Routines in the bot's info pane, then copy POST to and header and paste them one at a time at sendtogrokbot.com/connect.

Research, Job hunt, Buy or skip, Learn later, and Content ideas travel on the post. The routine stays on General. The skill also says how to answer a post that arrives on that routine.

## Layout

Cursor finds `.cursor-plugin/plugin.json`. Grok and other Agent Plugins hosts find `plugin.json` at this folder's root. The repository root `.cursor-plugin/marketplace.json` points at this folder, because the plugin is not the only thing in the repo.

```text
plugin/
├── plugin.json
├── .cursor-plugin/plugin.json
├── assets/logo.svg
├── assets/logo.png
├── skills/send-to-grok-bot/SKILL.md
├── skills/send-to-grok-bot/routine-prompt.md
├── README.md
└── SUBMIT.md
```

The logo files are also on the site as `/logo.svg` and `/logo.png`. Form answers for https://x.ai/bot/marketplace/submit-a-plugin are in [SUBMIT.md](SUBMIT.md).

## Try it

In Grok Bot, with this plugin installed, say: Set up Send to Grok Bot.

After the routine exists, the reply is one message. Install the extension first: sendtogrokbot.com/install. It is not in the Chrome Web Store yet. Click the bot's name at the top, then Routines, then Send to Grok Bot. Copy POST to and paste it at sendtogrokbot.com/connect. Copy header and paste it in the same box. The page then says: Now open x.com and click the arrow. On x.com, click the arrow on a post and choose Send to Grok Bot.
