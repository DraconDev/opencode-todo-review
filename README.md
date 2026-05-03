# opencode-auto-review-completed-todos

Automatically triggers a final review when all session todos are done.

## What it does

1. **Tracks todos** across session messages (creates `- [ ]`, completes `- [x]`)
2. **Detects completion** via checkbox state changes and bulk-completion phrases ("all done", "everything completed")
3. **Fires review** — prompts the AI to summarize accomplishments, flag technical decisions, and list follow-ups

## Install

```bash
# Clone or copy the plugin file
cp opencode-auto-review-completed-todos.ts ~/.config/opencode/plugins/
```

Then add to your `opencode.json`:

```json
{
  "plugin": [
    ["opencode-auto-review-completed-todos", {
      "levenshteinThreshold": 3,
      "debounceMs": 500,
      "bulkPhrases": ["all done", "everything completed"]
    }]
  ]
}
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `levenshteinThreshold` | `number` | `3` | Fuzzy match tolerance for todo text. Higher = more lenient matching. |
| `debounceMs` | `number` | `500` | Milliseconds to wait after last todo change before triggering review. |
| `bulkPhrases` | `string[]` | See code | Phrases that indicate bulk completion (e.g., "all done"). |
| `reviewPrompt` | `string` | See code | The prompt sent to AI when review triggers. |

## How it works

```
User marks last todo complete
        ↓
Plugin detects - [x] or bulk phrase
        ↓
Waits debounceMs (default 500ms)
        ↓
Sends reviewPrompt to AI
        ↓
AI summarizes: what was done, decisions made, follow-ups needed
```

## Requirements

- OpenCode CLI 0.1.0+
- No additional dependencies
