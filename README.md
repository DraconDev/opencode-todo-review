# opencode-todo-review

> **Topic:** OpenCode Plugins · **Tags:** todo, review, productivity, automation

Auto-detect when all session todos are completed and send a review message. Fires once per session.

**Site:** [dracon.uk](https://dracon.uk)

## About

`opencode-todo-review` is an OpenCode plugin that automatically triggers a session review when all tasks are completed. It listens for OpenCode's internal `todo.updated` events — the same system used by the AI and UI — and sends a visible chat message prompting the AI to summarize the session.

Designed as the yin to [`opencode-todo-reminder`](https://www.npmjs.com/package/opencode-todo-reminder)'s yang: where todo-reminder nudges when tasks remain incomplete, this plugin triggers a review when all tasks are done.

## What it does

Listens for OpenCode's internal `todo.updated` events — whenever the todowrite tool creates, updates, or completes todos. When all todos have status `completed` or `cancelled`, it sends a review message to the chat. If new pending todos appear before the debounce fires, the review is cancelled.

This works with **any** todo source: the AI creating/checking todos via the todowrite tool, the user checking boxes in the UI, or the internal todo-reminder plugin.

**Design philosophy:** Pairs with `opencode-todo-reminder` as its complement. Todo-reminder nudges when tasks remain incomplete; this plugin triggers a review when all tasks are done.

## Install

```bash
cp opencode-todo-review.ts ~/.config/opencode/plugins/
# or the compiled version:
cp opencode-todo-review.js ~/.config/opencode/plugins/
```

Register in `opencode.json`:

```json
"plugin": [
  "opencode-todo-review"
]
```

Restart OpenCode.

## Configuration

```json
{
  "plugin": [
    ["opencode-todo-review", {
      "debounceMs": 500
    }]
  ]
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `debounceMs` | `number` | `500` | Wait after the last completed todo before sending message |

## How it works

### Architecture

Per-session state is minimal:

```
SessionState
├── reviewFired: boolean         ← prevent double-fire
└── debounceTimer: Timer | null  ← debounce before sending
```

### Event handling

| Event | Action |
|-------|--------|
| `todo.updated` | Check all todos. If all completed/cancelled → schedule message. If any pending → cancel scheduled message. |
| `session.deleted` / `session.error` / `session.compacted` | Clean up session state |

### Review trigger flow

1. User/AI completes todos via OpenCode's todowrite tool
2. `todo.updated` event fires with updated todo list
3. Plugin checks `todos.every(t => t.status === "completed" || t.status === "cancelled")`
4. If all done → 500ms debounce timer starts
5. Timer fires → sends message to chat: "All tasks in this session have been completed. Please perform a final review..."
6. AI responds with a session review summary

### How the message appears

Uses `client.session.prompt()` with `synthetic: false` — the same approach as `opencode-todo-reminder`. The message appears as a **normal chat message** that the AI responds to naturally.

## Yin and yang

| Plugin | When it triggers | What it does |
|--------|-----------------|--------------|
| `opencode-todo-reminder` | Todos remain incomplete | Nudges to complete tasks |
| `opencode-todo-review` | All todos complete | Triggers review |

## Status

**BETA — confirmed working (5 May 2026).**

Plugin:
- Detects `todo.updated` events from OpenCode's internal todowrite tool
- Sends visible chat message when all todos are completed
- AI responds with a session review summary
- Debounces to avoid premature triggering
- Fires only once per session

## Files

| Path | Description |
|------|-------------|
| `~/.config/opencode/plugins/opencode-todo-review.js` | Main plugin (loaded by OpenCode) |
| `~/.config/opencode/plugins/opencode-todo-review.ts` | TypeScript source |
| `~/Dev/opencode-todo-review/` | Git-tracked source |

## Troubleshooting

**Plugin not loading:**
- Verify `opencode.json` has `"opencode-todo-review"` in the `plugin` array
- Ensure file is at `~/.config/opencode/plugins/opencode-todo-review.js`

**Message not appearing:**
- Todos must be created via OpenCode's todowrite tool (not raw text like `- [ ]`)
- All todos must have status `"completed"` or `"cancelled"`
- Plugin fires only once per session (new session needed after firing)

## Requirements

- OpenCode with plugin support
- No additional npm dependencies

## License

This project is dual-licensed:

- **AGPL-3.0-only** — See [LICENSE](LICENSE) for the full text. This is the default license for open source use.
- **Commercial License** — For organizations that prefer not to comply with AGPLv3's source disclosure requirements. See [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md) for details.

By contributing to this project, you agree to the terms in [CLA.md](CLA.md).
