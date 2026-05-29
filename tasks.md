# Full Audit Tasks

All tasks completed 2026-05-29.

## Documentation

- [x] Verify all README install instructions use correct filenames
- [x] Verify all file references in README are accurate
- [x] Check all markdown links are valid (no 404s)
- [x] Verify LICENSE matches declared license (AGPLv3)
- [x] Verify CLA.md exists and referenced correctly
- [x] Verify COMMERCIAL-LICENSE.md exists and referenced correctly
- [x] Check CONTRIBUTING.md references are accurate
- [x] Review README for any outdated status claims

## Code Quality

- [x] Run `bun run typecheck` — no errors
- [x] Run `bun run build` — succeeds
- [x] Run `bun test` — all tests pass (14 pass, 0 fail)
- [x] Verify `.js` is in sync with `.ts` (`git diff opencode-auto-review-completed-todos.js` — clean)
- [x] Check no `TODO` or `FIXME` comments left in code
- [x] Check no debug `console.log` or `console.error` calls
- [x] Verify no hardcoded secrets or credentials
- [x] Check error handling is consistent (no silent catches swallowing errors)
- [x] Verify all exported functions are tested or intentionally untested

## TypeScript

- [x] Verify `tsconfig.json` is correct for the project
- [x] Check no implicit `any` types
- [x] Verify `strict` mode is enabled
- [x] Check all imports resolve (no missing modules)

## GitHub / CI

- [x] Verify CI workflow exists and is correct
- [x] Check all GitHub templates exist (issue, PR)
- [x] Verify `CODEOWNERS` is correct
- [x] Check `.github/workflows/` only contains intended files (ci.yml, cla.yml)
- [x] Verify CLA workflow is correctly configured

## Dependencies

- [x] Run `bun install` and verify no extraneous packages
- [x] Check `peerDependencies` are correctly declared
- [x] Verify `devDependencies` are only for development
- [x] Check `engines` field is accurate (node >= 20)
- [x] Verify package version is correct in `package.json`

## Security

- [x] No environment variables or secrets in code
- [x] No code that writes to `/tmp` or sensitive paths
- [x] No code that executes shell commands unsafely
- [x] Verify plugin sandboxing is respected (no Node.js fs/network from plugin)

## Architecture

- [x] Verify sessions Map is bounded (no unbounded growth)
- [x] Check all timeouts are cleared on session cleanup
- [x] Verify `reviewFired` flag correctly prevents double-fire
- [x] Check debounce logic is sound (schedules on complete, cancels on incomplete)
- [x] Verify all event handlers clean up on `session.deleted`, `session.error`, `session.compacted`

## Plugin Contract

- [x] Verify plugin exports default function correctly
- [x] Check plugin returns `{ event: async function }` shape
- [x] Verify plugin handles missing `sessionId` gracefully
- [x] Check plugin handles malformed events gracefully
- [x] Verify plugin handles `session.prompt` failure gracefully

## Tests

- [x] All `allTodosCompleted` edge cases covered
- [x] All `mergeOptions` edge cases covered (null, undefined, invalid types, boundary values)
- [x] Tests use `.js` import path (not `.ts`) to match actual runtime
- [x] Tests pass in CI environment

## Deliverables

- [x] `package.json` has correct `name`, `version`, `description`
- [x] `files` array in `package.json` only includes intended files
- [x] Both `.ts` and `.js` files are tracked in git
- [x] Source map file exists alongside `.js`
- [x] README install instructions match actual filenames
- [x] README "Status" section is up to date (updated BETA → STABLE)