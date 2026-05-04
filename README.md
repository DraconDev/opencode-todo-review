# opencode-auto-review-completed-todos

Auto-detect when all session todos are completed and show a toast notification. Fires once per session.

## What it does

Listens for OpenCode's internal `todo.updated` events — whenever the todowrite tool creates, updates, or completes todos. When all todos have status `completed` or `cancelled`, it shows a toast notification. If new pending todos appear before the debounce fires, the review is cancelled.

This works with **any** todo source: the AI creating/checking todos via the todowrite tool, the user checking boxes in the UI, or the internal todo-reminder plugin.

**Design philosophy:** Non-intrusive. A brief toast appears in the corner — not in the chat conversation. No debug output, no flooding.

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

Restart OpenCode.

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
| `debounceMs` | `number` | `500` | Wait after the last completed todo before showing toast |

## How it works

### Architecture

Per-session state is minimal:

```
SessionState
├── reviewFired: boolean         ← prevent double-fire
└── debounceTimer: Timer | null  ← debounce before showing toast
```

### Event handling

| Event | Action |
|-------|--------|
| `todo.updated` | Check all todos. If all completed/cancelled → schedule toast. If any pending → cancel scheduled toast. |
| `session.deleted` / `session.error` / `session.compacted` | Clean up session state |

### Review trigger flow

1. User/AI completes todos via OpenCode's todowrite tool
2. `todo.updated` event fires with updated todo list
3. Plugin checks `todos.every(t => t.status === "completed" || t.status === "cancelled")`
4. If all done → 500ms debounce timer starts
5. Timer fires → shows toast notification: "All todos are complete. Ready for review."
6. No message sent to chat — notification is a corner toast only

### Why toast instead of chat message?

- **Non-intrusive:** Appears in the corner, not in the conversation
- **Brief:** Disappears automatically after a few seconds
- **No interference:** User's prepared message or work is not disturbed

## Status

**BETA — testing (5 May 2026).**

Plugin:
- Detects `todo.updated` events from OpenCode's internal todowrite tool
- Shows toast notification when all todos are completed
- Debounces to avoid premature triggering
- Fires only once per session
- Clean debug-free operation

## Files

| Path | Description |
|------|-------------|
| `~/.config/opencode/plugins/opencode-auto-review-completed-todos.js` | Main plugin (loaded by OpenCode) |
| `~/.config/opencode/plugins/opencode-auto-review-completed-todos.ts` | TypeScript source |
| `~/Dev/opencode-auto-review-completed-todos/` | Git-tracked source |

## Troubleshooting

**Plugin not loading:**
- Verify `opencode.json` has `"opencode-auto-review-completed-todos"` in the `plugin` array
- Ensure file is at `~/.config/opencode/plugins/opencode-auto-review-completed-todos.js`

**Toast not appearing:**
- Todos must be created via OpenCode's todowrite tool (not raw text like `- [ ]`)
- All todos must have status `"completed"` or `"cancelled"`
- Plugin fires only once per session (new session needed after firing)

## Requirements

- OpenCode with plugin support
- No additional npm dependencies