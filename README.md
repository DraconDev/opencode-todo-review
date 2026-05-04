# opencode-auto-review-completed-todos

Auto-detect when all session todos are completed. Fires once per session.

## What it does

Listens for OpenCode's internal `todo.updated` events — whenever the todowrite tool creates, updates, or completes todos. When all todos have status `completed` or `cancelled`, it silently marks the session as reviewed. If new pending todos appear before the debounce fires, the review is cancelled.

This works with **any** todo source: the AI creating/checking todos via the todowrite tool, the user checking boxes in the UI, or the internal todo-reminder plugin.

**Design philosophy:** Silent and invisible. No terminal output, no chat message, no AI review generation. The user can continue their work uninterrupted, or choose to trigger a review manually.

## Install

```bash
cp opencode-auto-review-completed-todos.ts ~/.config/opencode/plugins/
# or the compiled version:
cp opencode-auto-review-completed-todos.js ~/.config/opencode/plugins/
```

Register in `opencode.json`:

```json
"plugin": [
  "opencode-auto-review-completed-todos"
]
```

Restart OpenCode. Confirm: `[auto-review] PLUGIN LOADED` in terminal.

## Configuration

```json
{
  "plugin": [
    ["opencode-auto-review-completed-todos", {
      "debounceMs": 500
    }]
  ]
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `debounceMs` | `number` | `500` | Wait after the last completed todo before marking review complete |

## How it works

### Architecture

Per-session state is minimal:

```
SessionState
├── reviewFired: boolean         ← prevent double-fire
└── debounceTimer: Timer | null  ← debounce before marking complete
```

### Event handling

| Event | Action |
|-------|--------|
| `todo.updated` | Check all todos. If all completed/cancelled → schedule review. If any pending → cancel scheduled review. |
| `session.deleted` / `session.error` / `session.compacted` | Clean up session state |

### Review trigger flow

1. User/AI completes todos via OpenCode's todowrite tool
2. `todo.updated` event fires with updated todo list
3. Plugin checks `todos.every(t => t.status === "completed" || t.status === "cancelled")`
4. If all done → 500ms debounce timer starts
5. Timer fires → outputs `[auto-review] REVIEW TRIGGERED` to terminal
6. No message sent to chat — the notification is terminal-only

### Why not text parsing?

The old version tried to regex-parse user messages for patterns like `- [ ]`, `TODO:`, `all done`. This was fragile, missed todos created via the internal todowrite tool, and required fuzzy matching and source tracking. The new approach hooks directly into OpenCode's todo event system — the **same** system the AI and UI use.

## Status

**BETA — confirmed working (5 May 2026).**

Plugin is silent in chat but outputs to terminal when triggered:
- No chat message — completely invisible to user in the conversation
- Terminal output: `[auto-review] REVIEW TRIGGERED`
- Fires once per session

Plugin successfully:
- Detects `todo.updated` events from OpenCode's internal todowrite tool
- Outputs `[auto-review] REVIEW TRIGGERED` to terminal when all todos are completed
- Debounces to avoid premature triggering
- Fires only once per session

## Files

| Path | Description |
|------|-------------|
| `~/.config/opencode/plugins/opencode-auto-review-completed-todos.js` | Main plugin (loaded by OpenCode) |
| `~/.config/opencode/plugins/opencode-auto-review-completed-todos.ts` | TypeScript source |
| `~/Dev/opencode-auto-review-completed-todos/` | Git-tracked source |

## Troubleshooting

**Plugin not loading:**
- Check terminal for `[auto-review] PLUGIN LOADED` on OpenCode startup
- Verify `opencode.json` has `"opencode-auto-review-completed-todos"` in the `plugin` array
- Ensure file is at `~/.config/opencode/plugins/opencode-auto-review-completed-todos.js`

**Review not triggering:**
- Todos must be created via OpenCode's todowrite tool (not raw text like `- [ ]`)
- All todos must have status `"completed"` or `"cancelled"`
- Plugin fires only once per session

## Requirements

- OpenCode with plugin support
- No additional npm dependencies