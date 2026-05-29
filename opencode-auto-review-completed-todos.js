// opencode-auto-review-completed-todos.ts
var DEFAULT_OPTIONS = {
  debounceMs: 500,
  maxSessions: 100,
  maxRetries: 2
};
var MAX_SESSIONS_CAP = 1000;
function log(level, message) {
  const timestamp = new Date().toISOString();
  process.stderr.write(`[auto-review] [${timestamp}] [${level}] ${message}
`);
}
function mergeOptions(raw) {
  if (!raw || typeof raw !== "object")
    return { ...DEFAULT_OPTIONS };
  const o = raw;
  const maxSessions = typeof o.maxSessions === "number" && o.maxSessions > 0 ? Math.min(o.maxSessions, MAX_SESSIONS_CAP) : DEFAULT_OPTIONS.maxSessions ?? 100;
  const maxRetries = typeof o.maxRetries === "number" && o.maxRetries >= 0 ? Math.min(o.maxRetries, 5) : DEFAULT_OPTIONS.maxRetries ?? 2;
  return {
    debounceMs: typeof o.debounceMs === "number" && o.debounceMs > 0 ? o.debounceMs : DEFAULT_OPTIONS.debounceMs,
    maxSessions,
    maxRetries
  };
}
function allTodosCompleted(todos) {
  return Array.isArray(todos) && todos.length > 0 && todos.every((t) => t.status === "completed" || t.status === "cancelled");
}
function extractSessionId(event) {
  const props = event.properties;
  return props?.sessionID ?? props?.info?.id ?? props?.path?.id;
}
var AutoReviewCompletedTodosPlugin = async (input, rawOptions) => {
  const config = mergeOptions(rawOptions);
  const sessions = new Map;
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
    let lastError;
    for (let attempt = 0;attempt <= (config.maxRetries ?? 2); attempt++) {
      try {
        await input.client.session.prompt({
          path: { id: sessionId },
          query: { directory: input.directory },
          body: {
            parts: [
              {
                type: "text",
                text: "All tasks in this session have been completed. Please perform a final review: summarize what was accomplished, note any technical decisions or trade-offs made, flag anything that should be documented, and list any follow-up tasks or improvements for next time. If you identify any issues, bugs, or improvements during the review, use the todowrite tool to create todos for them immediately — do not simply note them in the review response.",
                synthetic: false
              }
            ]
          }
        });
        return;
      } catch (err) {
        lastError = err;
        if (attempt < (config.maxRetries ?? 2)) {
          await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
        }
      }
    }
    log("error", `Review trigger failed after ${(config.maxRetries ?? 2) + 1} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
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
      const sessionId = extractSessionId(e);
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
        ensureSession(sessionId);
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
  mergeOptions,
  opencode_auto_review_completed_todos_default as default,
  allTodosCompleted,
  AutoReviewCompletedTodosPlugin
};

//# debugId=36A02AD60769D00B64756E2164756E21
//# sourceMappingURL=opencode-auto-review-completed-todos.js.map
