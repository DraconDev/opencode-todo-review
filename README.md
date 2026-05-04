# opencode-auto-review-completed-todos

Auto-detect when all session todos are completed and inject a review prompt. Fires once per session.

## What it does

- **Tracks todos** across all session messages and parts
- **Detects completion** via checkbox changes (`- [x]`), completion phrases (`DONE:`, `fixed:`), and bulk phrases ("all done")
- **Fuzzy matches** todo text with Levenshtein distance tolerance
- **Accumulates streaming text** across delta chunks so todos spanning multiple deltas are caught
- **Cleans up** when messages or parts are removed — no phantom todos
- **Fires exactly once** per session after a configurable debounce

## Install

OpenCode auto-loads plugins from `~/.config/opencode/plugins/`. Copy either the TypeScript source or the compiled JavaScript:

```bash
cp opencode-auto-review-completed-todos.ts ~/.config/opencode/plugins/
# or copy the compiled version:
cp opencode-auto-review-completed-todos.js ~/.config/opencode/plugins/
```

Register in `opencode.json` to activate:

```json
"plugin": [
  "opencode-auto-review-completed-todos"
]
```

Restart OpenCode to load. Two confirmatory lines appear in terminal: `[auto-review] PLUGIN LOADED` and `[auto-review] REVIEW TRIGGERED`.

## Configuration

```json
{
  "plugin": [
    ["opencode-auto-review-completed-todos", {
      "levenshteinThreshold": 3,
      "debounceMs": 500,
      "bulkPhrases": ["all todos done", "all tasks completed", "all done", "all wrapped up", "everything done"],
      "reviewPrompt": "All tasks in this session have been completed..."
    }]
  ]
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `levenshteinThreshold` | `number` | `3` | Max edit distance for fuzzy todo matching. Higher = more lenient. |
| `debounceMs` | `number` | `500` | Milliseconds to wait after last completion before triggering review. |
| `bulkPhrases` | `string[]` | See defaults | Phrases that trigger bulk completion. Fuzzy-matched per-sentence. |
| `reviewPrompt` | `string` | (default message) | The prompt injected when all todos are done. |

## How it works

### Architecture

Per-session state tracks todos and their sources:

```
SessionState
├── todos: Set<string>              ← canonical active todos
├── textSources: Map<sourceKey, text>   ← accumulated text per message/part
├── sourceTodos: Map<sourceKey, string[]>  ← extracted todos per source
├── messageParts: Map<msgId, Set<partId>>  ← which parts belong to which message
├── reviewFired: boolean
└── debounceTimer: Timer | null
```

### Event handling

| Event | Action |
|-------|--------|
| `message.created` / `message.updated` | Extract todos from message text, update source |
| `message.part.delta` | Accumulate text, update source |
| `message.part.updated` / `message.part.added` | Replace text, update source |
| `message.part.removed` | Remove part source, diff todos |
| `message.removed` | Remove message source + all its tracked parts, diff todos |
| `session.idle` | Trigger review if todos empty and not yet fired |
| `session.error` / `ended` / `deleted` / `compacted` | Clean up session state |

### Todo patterns

**Creation (case-insensitive):**
- `- [ ] task` (checkbox with dash)
- `[ ] task` (checkbox without dash)
- `TODO: task`, `todo: task`, `todo task`

**Completion (case-insensitive, fuzzy-matched):**
- `- [x] task`, `[x] task`
- `DONE: task`, `done: task`, `completed: task`, `fixed: task`, `resolved: task`

**Bulk completion phrases (fuzzy-matched per-sentence):**
- "all todos done", "all tasks completed", "all done", "all wrapped up", "everything done", "everything completed"

## Status

**IN PROGRESS — not yet confirmed working**

Plugin implemented and installed but has not been verified to trigger review in a live session.

**Last tested:** Not yet — was blocked on investigation

**Known issue:** Plugin may not load correctly (no `[auto-review] PLUGIN LOADED` seen on restart), or text extraction fails to find message text for `message.created` events. Two fixes applied to address both:

1. Added `event.properties.message.text` and `event.properties.text` paths to `extractTextFromEvent` (previously missing)
2. Removed `&& state.hadTodos` guard from review trigger — review now fires when todos reach zero regardless of whether todos were ever tracked via text patterns (handles case where no text-based todos were created but user still wants review)

## Test flow

1. **Restart OpenCode** — plugins load at startup; existing sessions won't pick up changes
2. Create todos **in message text**: `Here are my tasks: - [ ] fix bug - [ ] update docs`
3. Complete them **via message text**: `done: fix bug` then `all done`
4. Watch for `[auto-review] REVIEW TRIGGERED` in terminal when all todos complete

**Important:** The plugin watches message text only — it does NOT hook into OpenCode's internal todowrite tool. Todo completions via the `[✓]` checkbox UI will NOT trigger review.

## Files

| Path | Description |
|------|-------------|
| `~/.config/opencode/plugins/opencode-auto-review-completed-todos.js` | Main plugin (loaded by OpenCode) |
| `~/.config/opencode/plugins/opencode-auto-review-completed-todos.ts` | TypeScript source (clean, synced with .js) |
| `~/Dev/opencode-auto-review-completed-todos/` | Git-tracked source, synced with plugins folder |
| `~/.config/opencode/opencode.json` | Plugin registered as bare string at line 121 |

## Requirements

- OpenCode with plugin support
- No additional npm dependencies