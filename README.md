# opencode-auto-review-completed-todos

Never forget what you accomplished. This OpenCode plugin auto-reviews your session when all todos are done.

## What it does

- **Tracks todos** across all session messages and parts
- **Detects completion** via checkbox changes (`- [x]`), completion phrases (`DONE:`, `fixed:`), and bulk phrases ("all done")
- **Fuzzy matches** todo text with Levenshtein distance tolerance
- **Accumulates streaming text** across delta chunks so todos spanning multiple deltas are caught
- **Cleans up** when messages or parts are removed — no phantom todos
- **Fires exactly once** per session after a configurable debounce

## Install

OpenCode auto-loads TypeScript plugins from `~/.config/opencode/plugins/`. Either file works:

```bash
cp opencode-auto-review-completed-todos.ts ~/.config/opencode/plugins/
# or copy the compiled version:
cp opencode-auto-review-completed-todos.js ~/.config/opencode/plugins/
```

Restart OpenCode to load the plugin. Debug logs (plugin load, event types, session IDs, scheduling diagnostics) appear in your terminal.

## Configuration

The plugin auto-loads from `~/.config/opencode/plugins/` and needs no explicit entry in `opencode.json`. However, you can override defaults in your config:

```json
{
  "plugin": [
    ["opencode-auto-review-completed-todos", {
      "levenshteinThreshold": 3,
      "debounceMs": 500,
      "bulkPhrases": ["all todos done", "all tasks completed", "all done", "all wrapped up", "everything done"],
      "reviewPrompt": "All tasks in this session have been completed. Please perform a final review..."
    }]
  ]
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `levenshteinThreshold` | `number` | `3` | Max edit distance for fuzzy todo matching. Higher = more lenient. |
| `debounceMs` | `number` | `500` | Milliseconds to wait after last completion before triggering review. |
| `bulkPhrases` | `string[]` | See defaults | Phrases that trigger bulk completion. Fuzzy-matched per-sentence. |
| `reviewPrompt` | `string` | See defaults | The prompt injected when all todos are done. |

## How it works

### Architecture

The plugin maintains per-session state:

```
SessionState
├── todos: Set<string>              ← canonical active todos
├── textSources: Map<sourceKey, text>   ← accumulated text per message/part
├── sourceTodos: Map<sourceKey, string[]>  ← extracted todos per source
├── messageParts: Map<msgId, Set<partId>>  ← which parts belong to which message
├── reviewFired: boolean
├── hadTodos: boolean
└── debounceTimer: Timer | null
```

### Source tracking

Every text source gets a unique key:
- Part events: `part:${partId}`
- Message events: `msg:${messageId}`
- Orphan events: `orphan:${randomId}`

When a source updates, the plugin diffs its old extracted todos against its new ones. Todos are removed from the canonical set only if they disappeared from this source **and** don't exist in any other source.

### Delta accumulation

`message.part.delta` events append text incrementally. The plugin accumulates text per source so todo patterns spanning multiple delta chunks (e.g. `- [` then ` ] fix bug`) are detected correctly.

### Event handling

| Event | Action |
|-------|--------|
| `message.created` / `message.updated` | Extract todos from message text, update source |
| `message.part.delta` | Accumulate text, update source |
| `message.part.updated` / `message.part.added` | Replace text, update source |
| `message.part.removed` | Remove part source, rebuild todos |
| `message.removed` | Remove message source + all tracked parts |
| `session.idle` | Trigger review if todos empty and not yet fired |
| `session.error` / `ended` / `deleted` / `compacted` | Clean up session state |

### Todo detection

**Creation patterns (case-insensitive):**
- `- [ ] task`
- `[ ] task` (no dash)
- `TODO: task`
- `todo: task`

**Completion patterns (case-insensitive, fuzzy-matched):**
- `- [x] task`
- `[x] task` (no dash)
- `DONE: task`
- `done: task`
- `completed: task`
- `fixed: task`
- `resolved: task`

**Bulk completion phrases (fuzzy-matched per-sentence):**
- "all todos done"
- "all tasks completed"
- "all done"
- "all tasks done"
- "all wrapped up"
- "everything done"
- "everything completed"

## Example flow

```
Model: "Here are the tasks:
        - [ ] fix auth bug
        - [ ] update docs"

User:  "done: fix auth bug"

Plugin:
  1. Detects "fix auth bug" completed (fuzzy match)
  2. Schedules review in 500ms
  3. 500ms passes, "update docs" still active
  4. Review NOT triggered

User:  "all done"

Plugin:
  1. Detects bulk completion phrase
  2. Clears all todos
  3. Schedules review in 500ms
  4. No new todos appear
  5. Triggers review prompt → AI summarizes session
```

## Requirements

- OpenCode with TypeScript plugin support
- No additional npm dependencies

## Test flow

To verify the plugin works:

1. Start a new OpenCode session (plugins load at startup)
2. Create todos: `Here are my tasks: - [ ] fix bug - [ ] update docs`
3. Complete them: `done: fix bug` then `all done`
4. Watch for the review prompt when all todos complete
