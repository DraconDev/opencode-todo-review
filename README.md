# opencode-auto-review-completed-todos

Auto-detect when all session todos are completed and inject a review prompt. Fires once per session.

## What it does

Listens for OpenCode's internal `todo.updated` events — whenever the todowrite tool creates, updates, or completes todos. When all todos have status `completed` or `cancelled`, it schedules a review prompt injection. If new pending todos appear before the debounce fires, the review is cancelled.

This works with **any** todo source: the AI creating/checking todos via the todowrite tool, the user checking boxes in the UI, or the internal todo-reminder plugin.

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
      "debounceMs": 500,
      "reviewPrompt": "All tasks in this session have been completed. Please perform a final review..."
    }]
  ]
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `debounceMs` | `number` | `500` | Wait after the last completed todo before triggering review |
| `reviewPrompt` | `string` | (default message) | Prompt injected when all todos are done |

## How it works

### Architecture

Per-session state is minimal:

```
SessionState
├── reviewFired: boolean         ← prevent double-fire
└── debounceTimer: Timer | null  ← debounce before injecting
```

### Event handling

| Event | Action |
|-------|--------|
| `todo.updated` | Check all todos. If all completed/cancelled → schedule review. If any pending → cancel scheduled review. |
| `session.deleted` / `session.error` / `session.compacted` | Clean up session state |

### Todo status detection

The `todo.updated` event carries the full todo list with each item having:
- `content: string` — task description
- `status: string` — `"pending"`, `"in_progress"`, `"completed"`, `"cancelled"`
- `priority: string` — `"high"`, `"medium"`, `"low"`
- `id: string` — unique identifier

The plugin checks `todos.every(t => t.status === "completed" || t.status === "cancelled")`. If `todos.length > 0` and all match, it schedules the review.

### Why not text parsing?

The old version tried to regex-parse user messages for patterns like `- [ ]`, `TODO:`, `all done`. This was fragile, missed todos created via the internal todowrite tool, and required fuzzy matching and source tracking. The new approach hooks directly into OpenCode's todo event system — the **same** system the AI and UI use.

## Status

**ALPHA — refactored to use `todo.updated` event (5 May 2026). Install and test.**

## Files

| Path | Description |
|------|-------------|
| `~/.config/opencode/plugins/opencode-auto-review-completed-todos.js` | Main plugin (loaded by OpenCode) |
| `~/.config/opencode/plugins/opencode-auto-review-completed-todos.ts` | TypeScript source |
| `~/Dev/opencode-auto-review-completed-todos/` | Git-tracked source |

## Requirements

- OpenCode with plugin support
- No additional npm dependencies
