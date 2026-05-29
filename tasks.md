# Cleanup Tasks

## High Priority

- [ ] Fix README install instructions — filenames say `opencode-todo-review.ts/.js` but actual files are `opencode-auto-review-completed-todos.ts/.js`
- [ ] Remove or create missing `COMMERCIAL-LICENSE.md` (referenced in README.md:136 and CONTRIBUTING.md:35)
- [ ] Remove or create missing `CLA.md` (referenced in README.md:138 and CONTRIBUTING.md:8,14)

## Medium Priority

- [ ] Add `tsconfig.json` for TypeScript compilation
- [ ] Add `scripts` to `package.json`: `build`, `typecheck`, `test`
- [ ] Add build step to verify `.js` stays in sync with `.ts` (pre-commit hook or CI)
- [ ] Update `.dracon/project-state.md` — "Implementation" is marked "In Progress" but it's shipped
- [ ] Add session TTL or max-size cap to prevent memory leak in `sessions` Map

## Low Priority

- [ ] Add `.github/ISSUE_TEMPLATE.md`
- [ ] Add `.github/PULL_REQUEST_TEMPLATE.md`
- [ ] Add `.github/CODEOWNERS`
- [ ] Add at least one smoke/integration test
- [ ] Consider renaming package to match repo name (`opencode-auto-review-completed-todos` vs `opencode-todo-review`)

## Nice to Have

- [ ] Structured logging instead of `process.stderr.write` in error handler
- [ ] Retry logic on `session.prompt` failure
- [ ] Reduce fragile double-cast `(e as unknown as EventTodoUpdated)` with a typed event parser helper
