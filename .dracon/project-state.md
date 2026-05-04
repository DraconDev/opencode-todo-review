# Project State

## Current Focus
Simplified debug logging output in the auto-review plugin

## Context
The plugin previously output verbose debug messages to stderr, which were useful during development but cluttered the terminal. This change reduces the noise while maintaining essential startup and review-triggered confirmation messages.

## Completed
- [x] Reduced debug logging to only two key messages: plugin load and review trigger
- [x] Clarified that messages appear only in terminal (not OpenCode UI)

## In Progress
- [x] Documentation update to reflect simplified logging

## Blockers
- None identified

## Next Steps
1. Verify the simplified logging meets user needs
2. Consider adding a verbose mode for advanced debugging if needed
