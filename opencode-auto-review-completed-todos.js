// opencode-auto-review-completed-todos.ts
var DEFAULT_OPTIONS = {
  debounceMs: 500,
  maxSessions: 100
};
var MAX_SESSIONS_CAP = 1000;
function mergeOptions(raw) {
  if (!raw || typeof raw !== "object")
    return { ...DEFAULT_OPTIONS };
  const o = raw;
  const maxSessions = typeof o.maxSessions === "number" && o.maxSessions > 0 ? Math.min(o.maxSessions, MAX_SESSIONS_CAP) : DEFAULT_OPTIONS.maxSessions ?? 100;
  return {
    debounceMs: typeof o.debounceMs === "number" && o.debounceMs > 0 ? o.debounceMs : DEFAULT_OPTIONS.debounceMs,
    maxSessions
  };
}
function allTodosCompleted(todos) {
  return Array.isArray(todos) && todos.length > 0 && todos.every((t) => t.status === "completed" || t.status === "cancelled");
}
var AutoReviewCompletedTodosPlugin = async (input, rawOptions) => {
  const config = mergeOptions(rawOptions);
  const sessions = new Map;
  function getSession(sessionId) {
    return sessions.get(sessionId) ?? null;
  }
  function evictOldestSessions(count) {
    const entries = Array.from(sessions.entries()).sort((a, b) => a[1].createdAt - b[1].createdAt);
    for (let i = 0;i < count && i < entries.length; i++) {
      cleanupSession(entries[i][0]);
    }
  }
  function ensureSession(sessionId) {
    let state = sessions.get(sessionId);
    if (!state) {
      if (sessions.size >= (config.maxSessions ?? 100)) {
        evictOldestSessions(Math.ceil((config.maxSessions ?? 100) * 0.2));
      }
      state = { reviewFired: false, debounceTimer: null, createdAt: Date.now() };
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
    } catch {
      process.stderr.write(`[auto-review] REVIEW TRIGGERED (prompt failed)
`);
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
      const props = e?.properties;
      const sessionId = props?.sessionID ?? props?.info?.id ?? props?.path?.id;
      if (!sessionId)
        return;
      if (e.type === "session.deleted" || e.type === "session.error" || e.type === "session.compacted") {
        cleanupSession(sessionId);
        return;
      }
      if (e.type === "todo.updated") {
        const todos = e.properties.todos;
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
};
var opencode_auto_review_completed_todos_default = AutoReviewCompletedTodosPlugin;
export {
  opencode_auto_review_completed_todos_default as default,
  AutoReviewCompletedTodosPlugin
};

//# debugId=3E0BDF0BE99D4A2464756E2164756E21
//# sourceMappingURL=opencode-auto-review-completed-todos.js.map
