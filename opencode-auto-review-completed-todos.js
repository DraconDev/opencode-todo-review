// @bun
// opencode-auto-review-completed-todos.ts
var DEFAULT_OPTIONS = {
  debounceMs: 500
};
function mergeOptions(raw) {
  if (!raw || typeof raw !== "object")
    return { ...DEFAULT_OPTIONS };
  return {
    debounceMs: typeof raw.debounceMs === "number" && raw.debounceMs > 0 ? raw.debounceMs : DEFAULT_OPTIONS.debounceMs
  };
}
export default async function AutoReviewCompletedTodosPlugin(input, rawOptions) {
  const config = mergeOptions(rawOptions);
  const sessions = /* @__PURE__ */ new Map();
  function getSession(sessionId) {
    return sessions.get(sessionId) || null;
  }
  function ensureSession(sessionId) {
    let state = sessions.get(sessionId);
    if (!state) {
      state = { reviewFired: false, debounceTimer: null };
      sessions.set(sessionId, state);
    }
    return state;
  }
  function cleanupSession(sessionId) {
    const state = sessions.get(sessionId);
    if (state?.debounceTimer) {
      clearTimeout(state.debounceTimer);
    }
    sessions.delete(sessionId);
  }
  function allTodosCompleted(todos) {
    return Array.isArray(todos) && todos.length > 0 && todos.every((t) => t.status === "completed" || t.status === "cancelled");
  }
  async function triggerReview(sessionId) {
    const state = sessions.get(sessionId);
    if (!state || state.reviewFired)
      return;
    state.reviewFired = true;
    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = null;
    }
    try {
      await input.client.session.prompt({
        path: { id: sessionId },
        query: { directory: input.directory },
        body: {
          parts: [
            {
              type: "text",
              text: "All tasks in this session have been completed. Please perform a final review: summarize what was accomplished, note any technical decisions or trade-offs made, flag anything that should be documented, and list any follow-up tasks or improvements for next time.",
              synthetic: false
            }
          ]
        }
      });
    } catch (e) {
      process.stderr.write("[auto-review] REVIEW TRIGGERED (prompt failed)\n");
    }
  }
  function scheduleReview(sessionId) {
    const state = sessions.get(sessionId);
    if (!state)
      return;
    if (state.debounceTimer)
      clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => {
      state.debounceTimer = null;
      triggerReview(sessionId);
    }, config.debounceMs);
  }
  function cancelScheduledReview(sessionId) {
    const state = sessions.get(sessionId);
    if (state?.debounceTimer) {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = null;
    }
  }
  return {
    event: async ({ event }) => {
      const e = event;
      const sessionId = e?.properties?.sessionID ?? e?.properties?.info?.id ?? e?.properties?.path?.id;
      if (!sessionId)
        return;
      if (e.type === "session.deleted" || e.type === "session.error" || e.type === "session.compacted") {
        cleanupSession(sessionId);
        return;
      }
      if (e.type === "todo.updated") {
        const todos = e?.properties?.todos;
        if (!Array.isArray(todos))
          return;
        const state = ensureSession(sessionId);
        if (allTodosCompleted(todos)) {
          scheduleReview(sessionId);
        } else {
          cancelScheduledReview(sessionId);
        }
        return;
      }
    }
  };
}
