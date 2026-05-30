// @bun
// opencode-auto-review-completed-todos.ts
import type { Plugin } from "@opencode-ai/plugin";
import type { Todo } from "@opencode-ai/sdk";

interface SessionState {
  reviewFired: boolean;
  debounceTimer: ReturnType<typeof setTimeout> | null;
  createdAt: number;
}

interface Options {
  debounceMs: number;
  maxSessions?: number;
  maxRetries?: number;
}

const DEFAULT_OPTIONS: Options = {
  debounceMs: 500,
  maxSessions: 100,
  maxRetries: 2,
};

const MAX_SESSIONS_CAP = 1000;

function log(level: "error" | "warn", message: string): void {
  const timestamp = new Date().toISOString();
  process.stderr.write(`[auto-review] [${timestamp}] [${level}] ${message}\n`);
}

export function mergeOptions(raw: unknown): Options {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_OPTIONS };
  const o = raw as Record<string, unknown>;
  const maxSessions =
    typeof o.maxSessions === "number" && o.maxSessions > 0
      ? Math.min(o.maxSessions, MAX_SESSIONS_CAP)
      : DEFAULT_OPTIONS.maxSessions ?? 100;
  const maxRetries =
    typeof o.maxRetries === "number" && o.maxRetries >= 0
      ? Math.min(o.maxRetries, 5)
      : DEFAULT_OPTIONS.maxRetries ?? 2;
  return {
    debounceMs:
      typeof o.debounceMs === "number" && o.debounceMs > 0
        ? o.debounceMs
        : DEFAULT_OPTIONS.debounceMs,
    maxSessions,
    maxRetries,
  };
}

export function allTodosCompleted(todos: Todo[]): boolean {
  return (
    Array.isArray(todos) &&
    todos.length > 0 &&
    todos.every(
      (t: Todo) => t.status === "completed" || t.status === "cancelled",
    )
  );
}

function extractSessionId(event: Record<string, unknown>): string | undefined {
  const props = event.properties as Record<string, unknown> | undefined;
  return (
    (props?.sessionID as string) ??
    ((props?.info as Record<string, unknown>)?.id as string) ??
    ((props?.path as Record<string, unknown>)?.id as string)
  );
}

const AutoReviewCompletedTodosPlugin: Plugin = async (input, rawOptions) => {
  const config = mergeOptions(rawOptions);
  const sessions = new Map<string, SessionState>();

  function evictOldestSessions(count: number): void {
    const entries = Array.from(sessions.entries()).sort(
      (a, b) => a[1].createdAt - b[1].createdAt,
    );
    for (let i = 0; i < count && i < entries.length; i++) {
      cleanupSession(entries[i][0]);
    }
  }

  function ensureSession(sessionId: string): SessionState {
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

  function cleanupSession(sessionId: string): void {
    const state = sessions.get(sessionId);
    if (state?.debounceTimer) {
      clearTimeout(state.debounceTimer);
    }
    sessions.delete(sessionId);
  }

  async function triggerReview(sessionId: string): Promise<void> {
    const state = sessions.get(sessionId);
    if (!state || state.reviewFired) return;

    state.reviewFired = true;
    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = null;
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= (config.maxRetries ?? 2); attempt++) {
      try {
        await input.client.session.prompt({
          path: { id: sessionId },
          query: { directory: input.directory },
          body: {
            parts: [
              {
                type: "text" as const,
                text: "AUDIT REQUIRED. Review what was done for obvious problems: unhandled edge cases, badly named variables, incomplete implementations, commented-out code, missing error handling, duplicated logic. For each problem found, use todowrite to create a todo before moving on. Only if you find nothing worth fixing should you summarize what was accomplished and note follow-up tasks worth doing.",
                synthetic: false,
              },
            ],
          },
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

  function scheduleReview(sessionId: string): void {
    const state = sessions.get(sessionId);
    if (!state) return;

    if (state.debounceTimer) clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => {
      state.debounceTimer = null;
      triggerReview(sessionId);
    }, config.debounceMs);
  }

  function cancelScheduledReview(sessionId: string): void {
    const state = sessions.get(sessionId);
    if (state?.debounceTimer) {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = null;
    }
  }

  return {
    event: async ({ event }) => {
      const e = event as Record<string, unknown>;
      const sessionId = extractSessionId(e);

      if (!sessionId) return;

      if (
        e.type === "session.deleted" ||
        e.type === "session.error" ||
        e.type === "session.compacted"
      ) {
        cleanupSession(sessionId);
        return;
      }

      if (e.type === "todo.updated") {
        const todos = (e.properties as { todos?: Todo[] }).todos;
        if (!Array.isArray(todos)) return;

        ensureSession(sessionId);

        if (allTodosCompleted(todos)) {
          scheduleReview(sessionId);
        } else {
          cancelScheduledReview(sessionId);
        }
        return;
      }
    },
  };
};

export { AutoReviewCompletedTodosPlugin };
export default AutoReviewCompletedTodosPlugin;
