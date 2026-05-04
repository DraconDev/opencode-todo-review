# Project State

## Current Focus
Refactored the auto-review plugin to use OpenCode's internal todo events instead of text parsing

## Context
The old version tried to regex-parse user messages for patterns like `- [ ]`, `TODO:`, `all done`. This was fragile, missed todos created via the internal todowrite tool, and required fuzzy matching and source tracking. The new approach hooks directly into OpenCode's todo event system — the same system the AI and UI use.

## Completed
- [x] Removed all text parsing logic for todo detection
- [x] Added event listener for `todo.updated` events
- [x] Implemented review trigger when all todos are completed/cancelled
- [x] Added cancellation logic when new pending todos appear
- [x] Simplified session state tracking to just review status and debounce timer
- [x] Updated documentation to reflect the new event-based approach

## In Progress
- [ ] Testing the plugin with various todo creation scenarios

## Blockers
- Need to verify the plugin loads correctly and events are properly received

## Next Steps
1. Test the plugin with different todo creation methods (AI, UI, manual text)
2. Verify the debounce behavior works as expected
3. Confirm the review prompt is injected at the correct time
