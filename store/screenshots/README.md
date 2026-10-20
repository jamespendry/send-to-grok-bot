# Store screenshots

All 1280x800 RGB PNG. Public posts only, sample values only, nothing blurred except what was already painted over in `docs/img/claude-reply.png`.

- 01, 02: Chrome for Testing, logged out of x.com, extension 1.2.7 loaded unpacked, captured over CDP at 2x and downscaled. Post: https://x.com/AnthropicAI (Oct 15, "Working out how best to use AI in mathematics research").
- 03: crop of `docs/img/claude-reply.png` (a real Claude reply to a public post by @garrytan). A text cursor is visible over one word.
- 04: the real options page, with CSS injected to hide the paste box, Replies, Relay, Save and the other destinations' fields, and to lay the page out in two columns. Webhook is `https://example.com/hook`. This is not the default layout.
- 05: the live connect page with the extension active. The green Connected box was injected with the same markup `extension/site-connect.js` builds on success, because a real connect needs a real secret.
