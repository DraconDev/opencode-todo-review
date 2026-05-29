# Full Audit Tasks

## Documentation

- [ ] Verify all README install instructions use correct filenames
- [ ] Verify all file references in README are accurate
- [ ] Check all markdown links are valid (no 404s)
- [ ] Verify LICENSE matches declared license (AGPLv3)
- [ ] Verify CLA.md exists and referenced correctly
- [ ] Verify COMMERCIAL-LICENSE.md exists and referenced correctly
- [ ] Check CONTRIBUTING.md references are accurate
- [ ] Review README for any outdated status claims

## Code Quality

- [ ] Run `bun run typecheck` — no errors
- [ ] Run `bun run build` — succeeds
- [ ] Run `bun test` — all tests pass
- [ ] Verify `.js` is in sync with `.ts` (`git diff opencode-auto-review-completed-todos.js`)
- [ ] Check no `TODO` or `FIXME` comments left in code
- [ ] Check no debug `console.log` or `console.error` calls
- [ ] Verify no hardcoded secrets or credentials
- [ ] Check error handling is consistent (no silent catches swallowing errors)
- [ ] Verify all exported functions are tested or intentionally untested

## TypeScript

- [ ] Verify `tsconfig.json` is correct for the project
- [ ] Check no implicit `any` types
- [ ] Verify `strict` mode is enabled
- [ ] Check all imports resolve (no missing modules)

## GitHub / CI

- [ ] Verify CI workflow exists and is correct
- [ ] Check all GitHub templates exist (issue, PR)
- [ ] Verify `CODEOWNERS` is correct
- [ ] Check `.github/workflows/` only contains intended files
- [ ] Verify CLA workflow is correctly configured

## Dependencies

- [ ] Run `bun install` and verify no extraneous packages
- [ ] Check `peerDependencies` are correctly declared
- [ ] Verify `devDependencies` are only for development
- [ ] Check `engines` field is accurate (node >= 20)
- [ ] Verify package version is correct in `package.json`

## Security

- [ ] No environment variables or secrets in code
- [ ] No code that writes to `/tmp` or sensitive paths
- [ ] No code that executes shell commands unsafely
- [ ] Verify plugin sandboxing is respected (no Node.js fs/network from plugin)

## Architecture

- [ ] Verify sessions Map is bounded (no unbounded growth)
- [ ] Check all timeouts are cleared on session cleanup
- [ ] Verify `reviewFired` flag correctly prevents double-fire
- [ ] Check debounce logic is sound (schedules on complete, cancels on incomplete)
- [ ] Verify all event handlers clean up on `session.deleted`, `session.error`, `session.compacted`

## Plugin Contract

- [ ] Verify plugin exports default function correctly
- [ ] Check plugin returns `{ event: async function }` shape
- [ ] Verify plugin handles missing `sessionId` gracefully
- [ ] Check plugin handles malformed events gracefully
- [ ] Verify plugin handles `session.prompt` failure gracefully

## Tests

- [ ] All `allTodosCompleted` edge cases covered
- [ ] All `mergeOptions` edge cases covered (null, undefined, invalid types, boundary values)
- [ ] Tests use `.js` import path (not `.ts`) to match actual runtime
- [ ] Tests pass in CI environment

## Deliverables

- [ ] `package.json` has correct `name`, `version`, `description`
- [ ] `files` array in `package.json` only includes intended files
- [ ] Both `.ts` and `.js` files are tracked in git
- [ ] Source map file exists alongside `.js`
- [ ] README install instructions match actual filenames
- [ ] README "Status" section is up to date