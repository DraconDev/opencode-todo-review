# Project State

## Current Focus
Added debug logging and clarified message text-based todo detection for the auto-review plugin

## Context
The plugin now needs better visibility into its operation and clearer documentation about its message text-based todo detection, as it doesn't hook into OpenCode's internal todo system.

## Completed
- [x] Added `debug` option to enable verbose console logging
- [x] Updated documentation to specify message text-based todo detection
- [x] Clarified that checkbox UI completions won't trigger review

## In Progress
- [x] Documentation updates for debug logging and message text requirements

## Blockers
- None identified

## Next Steps
1. Test debug logging in various scenarios
2. Verify message text-based todo detection works as documented
