# Submit the plugin

Open https://x.ai/bot/marketplace/submit-a-plugin and use these answers. The form was read from that page. Field labels match it.

You still type your name and email, tick the testing confirmation after you have tried the plugin, and click Submit Plugin. That click agrees to the Publisher Terms. This file cannot send the form.

## Exact answers

| Field | Answer |
| --- | --- |
| First Name | Your name. |
| Last Name | Your name. |
| Work Email | Your email. |
| Organization Name | Send to Grok Bot |
| Organization Handle | sendtogrokbot |
| Website URL | https://sendtogrokbot.com |
| Logotype URL | https://sendtogrokbot.com/logo.svg |
| Where do you want to be listed? | Check all three: Grok (coming soon), Grok Bot, and Cursor. |
| MCP Server URL or Public GitHub Repository | https://github.com/jamespendry/send-to-grok-bot |
| Brief Description | Send to Grok Bot adds one button on an X post. This plugin creates a webhook routine named Send to Grok Bot and puts the General prompt on it: classify the post and start with a one-line takeaway. It replies with one connect link, https://sendtogrokbot.com/connect#stgb1. plus a code. Research, Job hunt, Buy or skip, Learn later, and Content ideas ride along on the post, so the routine stays on General. It does not post, follow, or message anyone. |
| Testing Instructions | The plugin directory in https://github.com/jamespendry/send-to-grok-bot is plugin/. Install it, then in Grok Bot say: Set up Send to Grok Bot. It creates a webhook routine of that name and replies with one https://sendtogrokbot.com/connect#stgb1. link. Open the link and click Connect. On x.com, send a post. The reply starts with a one-line takeaway. There is no test password. Do not paste the webhook key into chat. |

The handle has no spaces and no capitals. The logo URL is a 1:1 SVG. A PNG of the same mark is https://sendtogrokbot.com/logo.png. Both files are the extension icon (ink circle, white paper plane) on a white plate, with no empty background. They are committed at `plugin/assets/` and copied to `docs/` so the site serves them.

Brief Description is under the form's 600 character limit. Testing Instructions is under that limit too.

## Before you submit

1. Deploy the site so the logo URL loads: `scripts/build-site.sh` then `npx wrangler deploy --config site/wrangler.toml`. Open https://sendtogrokbot.com/logo.svg and confirm the plane is visible.
2. Push this repository and confirm https://github.com/jamespendry/send-to-grok-bot is public.
3. In Grok Bot, install the plugin from `plugin/` and run the testing steps above.
4. Tick "I've tested this plugin locally and in-app and confirmed it works as expected" only after that run.
5. Submit the form.
