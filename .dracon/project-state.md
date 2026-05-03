# Project State

## Current Focus
Updated documentation to clarify the auto-review plugin's runtime confirmation behavior.

## Context
The plugin previously logged debug messages to stderr, but the documentation needed to reflect that these are now purely runtime confirmation messages (not debug logs) and are terminal-only.

## Completed
- [x] Renamed "Debugging" section to "Runtime Confirmation" to better reflect the purpose
- [x] Clarified that messages appear only in terminal stderr (not OpenCode UI)
- [x] Simplified language to focus on confirmation rather than debugging

## In Progress
- [x] Documentation update complete

## Blockers
- None

## Next Steps
1. Verify documentation matches current plugin behavior
2. Ensure users understand the distinction between runtime confirmation and debug logging
