# Store screenshots

All 1280x800 RGB PNG. Public posts only, sample values only, nothing blurred except what was already painted over in `docs/img/claude-reply.png`.

- 01, 02: Chrome for Testing, logged out of x.com, extension 1.2.7 loaded unpacked (the button and menu are unchanged in 1.2.8), captured over CDP at 2x and downscaled. Post: https://x.com/AnthropicAI (Oct 15, "Working out how best to use AI in mathematics research").
- 03: crop of `docs/img/claude-reply.png` (a real Claude reply to a public post by @garrytan). A text cursor is visible over one word.
- 04: the real 1.2.8 options page, captured at 2x, with CSS injected to hide the paste box, the Claude fields, the Grok Bot key, the two optional ChatGPT and Codex sections, and Save. All four AIs checked; webhook is `https://example.com/hook`. Framed on a plain background with a title.
- 05: the live connect page with the extension active. The green Connected box was injected with the same markup `extension/site-connect.js` builds on success, because a real connect needs a real secret.
