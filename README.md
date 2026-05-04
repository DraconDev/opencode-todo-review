# opencode-auto-review-completed-todos

Auto-detect when all session todos are completed and trigger an invisible review. Fires once per session.

## What it does

Listens for OpenCode's internal `todo.updated` events — whenever the todowrite tool creates, updates, or completes todos. When all todos have status `completed` or `cancelled`, it injects a review **via the LLM system prompt** (invisible to the user). If new pending todos appear before the debounce fires, the review is cancelled.

This works with **any** todo source: the AI creating/checking todos via the todowrite tool, the user checking boxes in the UI, or the internal todo-reminder plugin.

**Key difference from other plugins:** The review prompt is injected as a `system` message, so the AI performs the review without showing the raw prompt text in the chat UI.

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
| `reviewPrompt` | `string` | (default message) | System prompt sent to LLM when all todos are done |

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

### Invisible review injection

Instead of sending the review prompt as a visible message:

```javascript
// ❌ Old way — visible in chat
parts: [{ type: "text", text: "All tasks completed...", synthetic: true }]

// ✅ New way — invisible system prompt
body: {
  system: config.reviewPrompt,        // ← LLM sees this, user doesn't
  parts: [{ type: "text", text: " ", synthetic: true }]  // ← minimal trigger
}
```

The `system` field sets the LLM's system context. The AI generates a review response based on these instructions without exposing the raw prompt text in the chat UI.

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

**BETA — confirmed working (5 May 2026).** 

Plugin successfully:
- Detects `todo.updated` events from OpenCode's internal todowrite tool
- Triggers review when all todos are completed
- Uses `system` field for invisible prompt injection

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

**Review text visible in chat:**
- This should not happen with the `system` field approach
- If it does, the `system` field may not be supported by your OpenCode version

## Requirements

- OpenCode with plugin support
- No additional npm dependencies
