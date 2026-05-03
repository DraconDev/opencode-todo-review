# opencode-auto-review-completed-todos

OpenCode plugin that triggers a final review when all todos are completed.

## What it does

1. Tracks todo creation (`- [ ]`) and completion (`- [x]`) in session messages
2. Detects bulk-completion phrases ("all done", "everything completed", etc.)
3. Fires a review prompt summarizing accomplishments, decisions, and follow-ups

## Configuration

```json
{
  "plugin": [
    ["opencode-auto-review-completed-todos", {
      "levenshteinThreshold": 3,
      "debounceMs": 500
    }]
  ]
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `levenshteinThreshold` | 3 | Fuzzy match tolerance for todo text |
| `debounceMs` | 500 | Delay before firing review |

## Install

Copy `opencode-auto-review-completed-todos.ts` to `~/.config/opencode/plugins/`.
