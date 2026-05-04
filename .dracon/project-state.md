# Project State

## Current Focus
Replaced terminal-only auto-review notifications with user-facing toast notifications.

## Context
The auto-review plugin previously silently marked sessions as reviewed in the terminal, which was invisible to users. This change makes the review completion more visible by showing a toast notification.

## Completed
- [x] Replaced terminal-only review trigger with toast notification
- [x] Updated documentation to clarify the new notification behavior
- [x] Maintained the debounce mechanism for preventing premature triggers
- [x] Kept the silent operation in chat (no chat messages)

## In Progress
- [x] Testing toast notification reliability across different OpenCode versions

## Blockers
- No blockers identified

## Next Steps
1. Verify toast notifications work consistently in different UI environments
2. Consider adding configuration options for toast duration/position
