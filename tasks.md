# Cleanup Tasks

## High Priority

- [x] Fix README install instructions — filenames say `opencode-todo-review.ts/.js` but actual files are `opencode-auto-review-completed-todos.ts/.js`
- [x] Remove or create missing `COMMERCIAL-LICENSE.md` (referenced in README.md and CONTRIBUTING.md)
- [x] Remove or create missing `CLA.md` (referenced in README.md and CONTRIBUTING.md)

## Medium Priority

- [x] Add `tsconfig.json` for TypeScript compilation
- [x] Add `scripts` to `package.json`: `build`, `typecheck`, `test`
- [x] Add build step to verify `.js` stays in sync with `.ts` (CI + precommit hook)
- [x] Update `.dracon/project-state.md` — "Implementation" was marked "In Progress" but was shipped
- [x] Add session TTL or max-size cap to prevent memory leak in `sessions` Map

## Low Priority

- [x] Add `.github/ISSUE_TEMPLATE.md`
- [x] Add `.github/PULL_REQUEST_TEMPLATE.md`
- [x] Add `.github/CODEOWNERS`
- [x] Add at least one smoke/integration test
- [x] Structured logging instead of `process.stderr.write` in error handler
- [x] Retry logic on `session.prompt` failure
- [x] Reduce fragile double-cast with typed event parser helper
- [x] Add CI workflow
- [x] Add dev dependencies for type checking

## Skipped

- Consider renaming package to match repo name — deferred (breaking change, low value)